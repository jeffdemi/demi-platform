import type { Metadata } from "next";
import Link from "next/link";
import { AccountCard } from "@/components/account-card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AcceptInviteForm } from "./accept-invite-form";

export const metadata: Metadata = { title: "Accept invitation" };

export default async function AcceptInvitePage() {
  const user = await requireUser();
  const supabase = await createClient();
  let query = supabase
    .from("business_invitations")
    .select("id, email, status, expires_at")
    .eq("email", user.email.toLowerCase())
    .order("created_at", { ascending: false })
    .limit(1);

  if (user.invitationId) {
    query = query.eq("id", user.invitationId);
  }

  const { data } = await query.maybeSingle();
  const available = data &&
    data.status === "pending" &&
    new Date(data.expires_at) > new Date();

  return (
    <AccountCard
      description={available
        ? `Finish setting up the account for ${user.email}.`
        : "This invitation is unavailable or has expired."}
      title={available ? "Join the team" : "Invitation unavailable"}
    >
      {available ? (
        <AcceptInviteForm invitationId={data.id} />
      ) : (
        <div className="mt-6">
          <p className="rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-strong" role="alert">
            Ask the business owner to send a new invitation.
          </p>
          <Link className="mt-5 inline-block text-sm font-semibold text-brand underline-offset-4 hover:underline" href="/login">Return to sign in</Link>
        </div>
      )}
    </AccountCard>
  );
}
