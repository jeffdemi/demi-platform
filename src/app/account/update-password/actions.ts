"use server";

import { createClient } from "@/lib/supabase/server";
import { updatePasswordSchema } from "@/lib/validation/auth";

export type UpdatePasswordState = {
  message?: string;
  success?: boolean;
  errors?: {
    password?: string[];
    passwordConfirmation?: string[];
  };
};

export async function updatePassword(
  _: UpdatePasswordState,
  formData: FormData,
): Promise<UpdatePasswordState> {
  const validated = updatePasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: validated.data.password,
  });

  if (error) {
    return {
      message: error.code === "same_password"
        ? "Choose a password you have not used for this account."
        : "Your password could not be updated. Request a new reset link and try again.",
    };
  }

  return { success: true, message: "Your password has been updated securely." };
}
