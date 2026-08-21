import { AppShell } from "@/components/app-shell";
import { requireBusinessContext } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await requireBusinessContext();

  return (
    <AppShell
      activeBusinessId={context.business.id}
      businessName={context.business.name}
      memberships={context.memberships}
      role={context.role}
      userEmail={context.user.email}
    >
      {children}
    </AppShell>
  );
}
