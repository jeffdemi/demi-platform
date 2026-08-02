"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/urls";
import { invitationSchema } from "@/lib/validation/auth";

export type InvitationState = {
  message?: string;
  success?: boolean;
  errors?: { email?: string[]; role?: string[] };
};

export async function inviteTeamMember(
  _: InvitationState,
  formData: FormData,
): Promise<InvitationState> {
  const context = await requireBusinessContext();

  if (context.role !== "owner") {
    return { message: "Only the business owner can invite team members." };
  }

  const validated = invitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  if (validated.data.email === context.user.email.toLowerCase()) {
    return { message: "You already belong to this workspace." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    return { message: "Team invitations are not configured yet." };
  }

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (usersError) {
    return { message: "The account directory could not be checked. Try again." };
  }

  const existingUser = users.users.find(
    (user) => user.email?.toLowerCase() === validated.data.email,
  );
  const supabase = await createClient();

  if (existingUser) {
    const { data: existingMembership } = await supabase
      .from("business_members")
      .select("id, active")
      .eq("business_id", context.business.id)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMembership?.active) {
      return { message: "That account already belongs to this workspace." };
    }

    const membership = {
      business_id: context.business.id,
      user_id: existingUser.id,
      role: validated.data.role,
      active: true,
    };
    const membershipResult = existingMembership
      ? await supabase.from("business_members").update(membership).eq("id", existingMembership.id)
      : await supabase.from("business_members").insert(membership);

    if (membershipResult.error) {
      return { message: "The existing account could not be added to this workspace." };
    }

    revalidatePath("/account/team");
    return { success: true, message: "The existing account was added to the workspace." };
  }

  const { data: invitation, error: invitationError } = await supabase
    .from("business_invitations")
    .insert({
      business_id: context.business.id,
      email: validated.data.email,
      role: validated.data.role,
      invited_by: context.user.id,
    })
    .select("id")
    .single();

  if (invitationError) {
    return {
      message: invitationError.code === "23505"
        ? "A pending invitation already exists for that email."
        : "The invitation could not be created.",
    };
  }

  const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(
    validated.data.email,
    {
      data: { invitation_id: invitation.id },
      redirectTo: getSiteUrl(),
    },
  );

  if (inviteError) {
    await supabase.from("business_invitations").delete().eq("id", invitation.id);
    return { message: "The invitation email could not be sent. Try again." };
  }

  revalidatePath("/account/team");
  return { success: true, message: "Invitation sent." };
}
