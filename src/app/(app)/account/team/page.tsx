import type { Metadata } from "next";
import { requireBusinessContext } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { InviteForm } from "./invite-form";
import { RemoveMemberButton } from "./remove-member-button";

export const metadata: Metadata = { title: "Team" };

type MemberRow = {
  id: number;
  role: string;
  email: string;
  fullName: string | null;
};

async function loadMembers(businessId: number): Promise<MemberRow[]> {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("business_members")
    .select("id, user_id, role, created_at")
    .eq("business_id", businessId)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (!members?.length) return [];

  const userIds = members.map((member) => member.user_id);
  const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
  const nameById = new Map((profiles ?? []).map((profile) => [profile.id, profile.full_name]));

  let emailById = new Map<string, string>();
  try {
    const admin = createAdminClient();
    const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    emailById = new Map(users.users.map((user) => [user.id, user.email ?? ""]));
  } catch {
    // Team directory shows names only when invitations aren't configured.
  }

  return members.map((member) => ({
    id: member.id,
    role: member.role,
    email: emailById.get(member.user_id) ?? "",
    fullName: nameById.get(member.user_id) ?? null,
  }));
}

export default async function TeamPage() {
  const context = await requireBusinessContext();
  const supabase = await createClient();
  const [{ data: invitations }, members] = await Promise.all([
    supabase
      .from("business_invitations")
      .select("id, email, role, status, expires_at, created_at")
      .eq("business_id", context.business.id)
      .order("created_at", { ascending: false }),
    context.role === "owner" ? loadMembers(context.business.id) : Promise.resolve<MemberRow[]>([]),
  ]);

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

      {context.role === "owner" && (
        <section className="border-b border-line py-7">
          <h2 className="text-lg font-bold">Team members</h2>
          <p className="mt-1 text-sm text-muted">Interns have read-only access: they can view business records but cannot add, edit, or delete them.</p>
          {members.length ? (
            <div className="mt-4 overflow-hidden rounded-lg border border-line bg-surface">
              <div className="divide-y divide-line">
                {members.map((member) => (
                  <div className="grid gap-2 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_110px_auto] sm:items-center" key={member.id}>
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{member.fullName || member.email || "Team member"}</p>
                      {member.fullName && member.email ? <p className="truncate text-sm text-muted">{member.email}</p> : null}
                    </div>
                    <p className="text-sm capitalize text-muted">{member.role}</p>
                    <div className="sm:justify-self-end">
                      {member.role === "owner" ? <p className="text-sm text-muted">Owner</p> : <RemoveMemberButton memberId={member.id} />}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">No team members yet.</p>
          )}
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
