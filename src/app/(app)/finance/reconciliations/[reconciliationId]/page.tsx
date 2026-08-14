import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { buildStatementReconciliation } from "@/lib/domain/bookkeeping";
import { formatCurrency, formatDate } from "@/lib/format";
import { getBankStatementPeriod, getBankStatementPeriodActivity } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { ReconcileStatementForm } from "../../bookkeeping-forms";

export const metadata: Metadata = { title: "Statement Reconciliation" };

export default async function ReconciliationPage({ params }: { params: Promise<{ reconciliationId: string }> }) {
  const context = await requireBusinessContext();
  if (context.role === "employee") redirect("/finance");
  const periodId = Number((await params).reconciliationId);
  if (!Number.isInteger(periodId)) notFound();
  const client = await createClient();
  const period = await getBankStatementPeriod(client, context.business.id, periodId);
  if (!period) notFound();
  const activity = await getBankStatementPeriodActivity(client, context.business.id, period.id, period.account_id, period.statement_start_date, period.statement_end_date);
  const reconciliation = buildStatementReconciliation(period, activity.transactions, activity.cashLines);
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance"><ArrowLeft size={17} />Finance</Link>} description={`${formatDate(period.statement_start_date)} through ${formatDate(period.statement_end_date)}`} title={period.bank_accounts?.name ?? "Statement Reconciliation"} />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-3 lg:grid-cols-6">
      {[["Status", period.status.replaceAll("_", " ")], ["Opening", formatCurrency(period.opening_balance)], ["Statement ending", formatCurrency(period.closing_balance)], ["Imported ending", formatCurrency(reconciliation.statementEnding)], ["Book ending", formatCurrency(reconciliation.bookEnding)], ["Pending", String(reconciliation.pendingCount)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-lg font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}
    </section>
    <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="border-b border-line px-5 py-4"><h2 className="font-bold">Statement activity</h2><p className="mt-1 text-sm text-muted">Every imported row must be reviewed and represented in the books.</p></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Review</th></tr></thead><tbody className="divide-y divide-line">{activity.transactions.map((transaction) => <tr key={transaction.id}><td className="px-4 py-3">{formatDate(transaction.transaction_date)}</td><td className="px-4 py-3 font-semibold">{transaction.description}</td><td className="px-4 py-3"><StatusBadge label={transaction.status.replaceAll("_", " ")} status={transaction.status} /></td><td className="px-4 py-3 text-right font-bold tabular-nums">{transaction.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount))}</td><td className="px-4 py-3"><Link className="font-semibold text-brand" href={`/finance/transactions/${transaction.id}`}>Open</Link></td></tr>)}{!activity.transactions.length ? <tr><td className="px-4 py-10 text-center text-muted" colSpan={5}>No imported transactions are attached to this statement period.</td></tr> : null}</tbody></table></div>
      </section>
      <aside className="space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Reconciliation checks</h2><dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between gap-3"><dt>Import difference</dt><dd className="font-bold">{formatCurrency(reconciliation.statementDifference)}</dd></div><div className="flex justify-between gap-3"><dt>Book difference</dt><dd className="font-bold">{formatCurrency(reconciliation.bookDifference)}</dd></div><div className="flex justify-between gap-3"><dt>Transactions pending</dt><dd className="font-bold">{reconciliation.pendingCount}</dd></div></dl></section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">{["reconciled", "closed"].includes(period.status) ? <div className="flex items-start gap-2 text-success"><CheckCircle2 className="mt-0.5" size={18} /><div><p className="font-bold">Statement reconciled</p><p className="mt-1 text-sm text-muted">This period agrees with the statement and posted books.</p></div></div> : <><h2 className="font-bold">Finish reconciliation</h2><p className="my-3 text-sm leading-6 text-muted">The database checks pending rows, imported activity, and posted book activity before completing reconciliation.</p><ReconcileStatementForm periodId={period.id} /></>}</section>
      </aside>
    </div>
  </div>;
}
