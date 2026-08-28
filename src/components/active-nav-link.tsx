"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  Briefcase,
  BriefcaseBusiness,
  CircleDollarSign,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Gauge,
  Landmark,
  Settings,
  Users,
  UsersRound,
  Wrench,
} from "lucide-react";

const navigationIcons = {
  accounting: Landmark,
  businesses: Briefcase,
  customers: Users,
  dashboard: Gauge,
  equipment: Wrench,
  expenses: FileSpreadsheet,
  invoices: CircleDollarSign,
  jobs: BriefcaseBusiness,
  labor: UsersRound,
  quotes: FileText,
  reports: FileBarChart,
  settings: Settings,
  team: Users,
  transactions: ArrowLeftRight,
} as const;

export type NavigationIconName = keyof typeof navigationIcons;

export function ActiveNavLink({ href, label, iconName }: { href: string; label: string; iconName: NavigationIconName }) {
  const pathname = usePathname();
  const withinSection = href !== "/dashboard" && pathname.startsWith(`${href}/`);
  const reportsSettings = href === "/reports" && pathname.startsWith("/reports/settings");
  const active = pathname === href || (withinSection && !reportsSettings);
  const Icon = navigationIcons[iconName];

  return (
    <Link aria-current={active ? "page" : undefined} className={`nav-link ${active ? "nav-link-active" : ""}`} href={href}>
      <Icon aria-hidden="true" size={18} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </Link>
  );
}
