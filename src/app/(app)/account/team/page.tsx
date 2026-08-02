import type { Metadata } from "next";
import { requireBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage() {
  const context = await requireBusinessContext();
  const supabase = await createClient();
  const { data: invitations } = await supabase
    .from("business_invitations")
    .select("id, email, role, status, expires_at, created_at")
    .eq("business_id", context.business.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-5xl px-5 py-7 sm:px-8 sm:py-9">
      <header className="border-b border-line pb-5">
        <p className="text-sm font-semibold text-muted">Account access</p>
        <h1 className="mt-1 text-2xl font-bold">Team</h1>
      </header>

      {context.role === "owner" && (
        <section className="border-b border-line py-7">
          <h2 className="text-lg font-bold">Invite a team member</h2>
          <p className="mt-1 text-sm text-muted">Invitations expire after seven days. Only invite people who should access business records.</p>
          <InviteForm />
        </section>
      )}

      <section className="py-7">
        <h2 className="text-lg font-bold">Invitations</h2>
        {invitations?.length ? (
          <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
            <div className="divide-y divide-line">
              {invitations.map((invitation) => (
                <div className="grid gap-1 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_120px_120px] sm:items-center" key={invitation.id}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{invitation.email}</p>
                    <p className="mt-1 text-sm text-muted">Expires {new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(invitation.expires_at))}</p>
                  </div>
                  <p className="text-sm capitalize text-muted">{invitation.role}</p>
                  <p className="text-sm font-semibold capitalize text-brand">{invitation.status}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No invitations have been sent.</p>
        )}
      </section>
    </div>
  );
}
