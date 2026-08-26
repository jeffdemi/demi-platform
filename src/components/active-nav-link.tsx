"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";

export function ActiveNavLink({ href, label, icon: Icon }: { href: string; label: string; icon: LucideIcon }) {
  const pathname = usePathname();
  const active = pathname === href || (href !== "/dashboard" && pathname.startsWith(`/`) && !(href === "/reports" && pathname.startsWith("/reports/settings")));
  return (
    <Link aria-current={active ? "page" : undefined} className={`nav-link ${active ? "nav-link-active" : ""}`} href={href}>
      <Icon aria-hidden="true" size={18} strokeWidth={active ? 2.4 : 2} />
      <span>{label}</span>
    </Link>
  );
}
