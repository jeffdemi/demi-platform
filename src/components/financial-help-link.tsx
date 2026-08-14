"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { usePathname } from "next/navigation";
import { contextualFinancialGuideAnchor } from "@/lib/financial-guide";

export function FinancialHelpLink({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const anchor = contextualFinancialGuideAnchor(pathname);
  return <Link
    aria-label="Financial guide"
    className={compact
      ? "grid size-10 place-items-center rounded-md text-on-brand-muted hover:bg-white/10 hover:text-on-brand"
      : "flex h-10 w-full items-center gap-3 rounded-md px-2 text-sm font-medium text-on-brand-muted hover:bg-white/10 hover:text-on-brand"}
    href={`/help/financial-guide#${anchor}`}
    title="Financial guide"
  >
    <Info aria-hidden="true" size={18} />
    {compact ? <span className="sr-only">Financial guide</span> : <span>Financial guide</span>}
  </Link>;
}
