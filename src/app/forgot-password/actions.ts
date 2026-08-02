"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/urls";
import { passwordResetRequestSchema } from "@/lib/validation/auth";

export type ForgotPasswordState = {
  message?: string;
  success?: boolean;
  errors?: { email?: string[] };
};

export async function requestPasswordReset(
  _: ForgotPasswordState,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const validated = passwordResetRequestSchema.safeParse({
    email: formData.get("email"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(validated.data.email, {
    redirectTo: `${getSiteUrl()}/auth/callback?next=/account/update-password`,
  });

  return {
    success: true,
    message: "If that email belongs to an account, a password reset link is on its way.",
  };
}
