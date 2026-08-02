"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitationSchema } from "@/lib/validation/auth";

export type AcceptInvitationState = {
  message?: string;
  errors?: {
    fullName?: string[];
    password?: string[];
    passwordConfirmation?: string[];
  };
};

export async function acceptInvitation(
  _: AcceptInvitationState,
  formData: FormData,
): Promise<AcceptInvitationState> {
  const user = await requireUser();
  const validated = acceptInvitationSchema.safeParse({
    invitationId: formData.get("invitationId"),
    fullName: formData.get("fullName"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: invitation, error: invitationError } = await supabase
    .from("business_invitations")
    .select("id, email, status, expires_at")
    .eq("id", validated.data.invitationId)
    .maybeSingle();

  if (
    invitationError ||
    !invitation ||
    invitation.email.toLowerCase() !== user.email.toLowerCase() ||
    invitation.status !== "pending" ||
    new Date(invitation.expires_at) <= new Date()
  ) {
    return { message: "This invitation is invalid or has expired." };
  }

  const { error: passwordError } = await supabase.auth.updateUser({
    password: validated.data.password,
  });

  if (passwordError) {
    return {
      message: passwordError.code === "weak_password"
        ? "Choose a stronger password that has not appeared in a data breach."
        : "Your password could not be saved. Please try again.",
    };
  }

  const { error: acceptanceError } = await supabase.rpc(
    "accept_business_invitation",
    {
      invitation_id: validated.data.invitationId,
      member_full_name: validated.data.fullName,
    },
  );

  if (acceptanceError) {
    return { message: "The invitation could not be accepted. Ask the owner to send a new one." };
  }

  redirect("/dashboard");
}
