"use server";

import { isInitialOwnerEmail } from "@/lib/auth-config";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/urls";
import { initialSetupSchema } from "@/lib/validation/auth";

export type SetupState = {
  message?: string;
  success?: boolean;
  errors?: {
    email?: string[];
    fullName?: string[];
    businessName?: string[];
    password?: string[];
    passwordConfirmation?: string[];
  };
};

export async function completeInitialSetup(
  _: SetupState,
  formData: FormData,
): Promise<SetupState> {
  const validated = initialSetupSchema.safeParse({
    email: formData.get("email"),
    fullName: formData.get("fullName"),
    businessName: formData.get("businessName"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  if (!isInitialOwnerEmail(validated.data.email)) {
    return { message: "This email is not authorized for initial setup." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: validated.data.email,
    password: validated.data.password,
    options: {
      data: {
        full_name: validated.data.fullName,
        initial_business_name: validated.data.businessName,
      },
      emailRedirectTo: `${getSiteUrl()}/auth/callback?next=/onboarding`,
    },
  });

  if (error) {
    return { message: "The owner account could not be started. Try again in a moment." };
  }

  return {
    success: true,
    message: "Check jeffdemi@gmail.com for the confirmation link to finish setup.",
  };
}
