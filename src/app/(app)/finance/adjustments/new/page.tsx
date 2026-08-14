import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatCurrency, formatDate } from "@/lib/format";
import { listBookkeepingAdjustments, listLedgerAccounts } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { AdjustmentForm } from "../../bookkeeping-forms";

export const metadata: Metadata = { title: "Bookkeeping Adjustments" };

export default async function BookkeepingAdjustmentsPage() {
  const context = await requireBusinessContext();
  if (context.role === "employee") redirect("/finance");
  const client = await createClient();
  const [accounts, adjustments] = await Promise.all([
    listLedgerAccounts(client, context.business.id),
    listBookkeepingAdjustments(client, context.business.id),
  ]);
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description="Post a balanced correction, depreciation entry, opening balance, or accountant-supplied adjustment. Closed months must be reopened first." title="Bookkeeping Adjustments" />
    <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_0.85fr]">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">New adjustment</h2><p className="mt-1 mb-5 text-sm leading-6 text-muted">Every adjustment produces equal debit and credit journal lines and retains its stated reason.</p><AdjustmentForm accounts={accounts} defaultDate={dateInTimeZone(context.business.timezone)} /></section>
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Recent adjustments</h2></div><div className="divide-y divide-line">{adjustments.map((adjustment) => <div className="px-5 py-4" key={adjustment.id}><div className="flex items-center justify-between gap-3"><p className="font-semibold">{adjustment.description}</p><strong>{formatCurrency(adjustment.amount)}</strong></div><p className="mt-1 text-sm text-muted">{formatDate(adjustment.entry_date)} · Debit {adjustment.debit?.name} · Credit {adjustment.credit?.name}</p><p className="mt-2 text-sm">{adjustment.reason}</p></div>)}{!adjustments.length ? <p className="px-5 py-8 text-sm text-muted">No manual adjustments have been posted.</p> : null}</div></section>
    </div>
  </div>;
}
