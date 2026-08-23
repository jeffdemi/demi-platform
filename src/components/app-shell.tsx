import Link from "next/link";
import {
  Briefcase,
  BriefcaseBusiness,
  CircleDollarSign,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Gauge,
  Landmark,
  LogOut,
  TreePine,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";
import { logout, switchBusiness } from "@/app/(app)/actions";
import { BusinessSwitcher } from "@/components/business-switcher";
import { FinancialHelpLink } from "@/components/financial-help-link";
import type { BusinessMembership } from "@/lib/domain/business-membership";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: Gauge },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/invoices", label: "Invoices", icon: CircleDollarSign },
  { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
  { href: "/expenses", label: "Expenses", icon: FileSpreadsheet },
  { href: "/finance", label: "Finance", icon: Landmark },
  { href: "/labor", label: "Labor", icon: UsersRound, adminOnly: true },
  { href: "/equipment", label: "Equipment", icon: Wrench },
  { href: "/reports", label: "Reports", icon: FileBarChart },
  { href: "/account/team", label: "Team", icon: Users },
  { href: "/account/businesses", label: "Businesses", icon: Briefcase, businessManagerOnly: true },
];

export function AppShell({
  activeBusinessId,
  businessName,
  memberships,
  userEmail,
  role,
  children,
}: {
  activeBusinessId: number;
  businessName: string;
  memberships: BusinessMembership[];
  userEmail: string;
  role: "owner" | "admin" | "employee" | "intern";
  children: React.ReactNode;
}) {
  const canManageBusinesses = role === "owner" || memberships.length > 1;
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="border-b border-brand-border bg-brand text-on-brand lg:sticky lg:top-0 lg:h-screen lg:border-b-0 lg:border-r">
        <div className="flex h-16 items-center justify-between px-4 lg:h-auto lg:px-5 lg:py-6">
          <Link className="flex min-w-0 items-center gap-3" href="/dashboard">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface text-brand">
              <TreePine aria-hidden="true" size={21} />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold">Demi Platform</span>
              <span className="block truncate text-xs text-on-brand-subtle">{businessName}</span>
            </span>
          </Link>
          <div className="flex items-center gap-1 lg:hidden">
            <FinancialHelpLink compact />
            <form action={logout}>
              <button aria-label="Sign out" className="grid size-10 place-items-center rounded-md text-on-brand-muted hover:bg-white/10" title="Sign out">
                <LogOut aria-hidden="true" size={19} />
              </button>
            </form>
          </div>
        </div>

        {memberships.length > 1 && (
          <BusinessSwitcher action={switchBusiness} activeBusinessId={activeBusinessId} memberships={memberships} />
        )}

        <nav className="flex gap-1 overflow-x-auto border-t border-white/10 px-3 py-2 lg:block lg:space-y-1 lg:border-t-0 lg:px-3 lg:py-2" aria-label="Primary navigation">
          {navigation
            .filter((item) => !item.adminOnly || (role !== "employee" && role !== "intern"))
            .filter((item) => !item.businessManagerOnly || canManageBusinesses)
            .map(({ href, label, icon: Icon }) => (
              <Link className="flex h-11 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-on-brand-muted hover:bg-white/10 hover:text-on-brand" href={href} key={href}>
                <Icon aria-hidden="true" size={18} />
                {label}
              </Link>
            ))}
        </nav>

        <div className="absolute bottom-0 hidden w-[236px] border-t border-white/10 p-4 lg:block">
          <FinancialHelpLink />
          <p className="mt-3 truncate text-xs text-on-brand-subtle">{userEmail}</p>
          <form action={logout} className="mt-2">
            <button className="flex h-10 w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-on-brand-muted hover:bg-white/10 hover:text-on-brand">
              <LogOut aria-hidden="true" size={17} />
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0">{children}</main>
    </div>
  );
}
