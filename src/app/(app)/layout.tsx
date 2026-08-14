import { AppShell } from "@/components/app-shell";
import { requireBusinessContext } from "@/lib/auth";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const context = await requireBusinessContext();

  return (
    <AppShell businessName={context.business.name} role={context.role} userEmail={context.user.email}>
      {children}
    </AppShell>
  );
}
