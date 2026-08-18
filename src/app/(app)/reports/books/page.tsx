import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { buildBookkeepingStatements } from "@/lib/domain/bookkeeping";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatCurrency } from "@/lib/format";
import { getLedgerReport } from "@/lib/repositories/accounting-repository";
import { listBusinessLines } from "@/lib/repositories/business-finance-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Bookkeeping Reports" };

export default async function BookkeepingReportsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string; line?: string; origin?: string }> }) {
  const context = await requireBusinessContext();
  const today = dateInTimeZone(context.business.timezone);
  const query = await searchParams;
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from ?? "") ? query.from! : `${today.slice(0, 4)}-01-01`;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "") ? query.to! : today;
  const client = await createClient();
  const [ledger, businessLines] = await Promise.all([getLedgerReport(client, context.business.id, undefined, to), listBusinessLines(client, context.business.id)]);
  const selectedLineId = /^\d+$/.test(query.line ?? "") ? Number(query.line) : undefined;
  const statements = buildBookkeepingStatements({ entries: ledger.entries, lines: ledger.lines, from, to, businessLineId: selectedLineId });
  const segmentStatements = businessLines.map((line) => ({ line, statements: buildBookkeepingStatements({ entries: ledger.entries, lines: ledger.lines, from, to, businessLineId: line.id }) }));
  const exportLink = (statement: string) => `/api/v1/reports/bookkeeping?statement=${statement}&from=${from}&to=${to}&format=csv${selectedLineId ? `&line=${selectedLineId}` : ""}`;
  const backHref = query.origin === "finance" ? "/finance" : "/reports";
  const backLabel = query.origin === "finance" ? "Finance" : "Reports";
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href={backHref}><ArrowLeft size={17} />{backLabel}</Link>} description="Ledger-based financial statements from posted, revision-preserving journal entries." title="Bookkeeping Reports" />
    <form className="my-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm"><label className="text-sm font-semibold">From<input className="mt-1 block h-10 rounded-md border border-line-strong bg-surface px-3" defaultValue={from} name="from" type="date" /></label><label className="text-sm font-semibold">To<input className="mt-1 block h-10 rounded-md border border-line-strong bg-surface px-3" defaultValue={to} name="to" type="date" /></label><label className="text-sm font-semibold">Business line<select className="mt-1 block h-10 rounded-md border border-line-strong bg-surface px-3" defaultValue={selectedLineId ?? ""} name="line"><option value="">Consolidated</option>{businessLines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}</select></label><button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand">Apply</button></form>
    <section className="mb-5 grid gap-3 md:grid-cols-3"><div className="rounded-lg border border-line bg-surface p-4"><p className="font-bold">Consolidated</p><p className="mt-1 text-sm text-muted">Net income {formatCurrency(buildBookkeepingStatements({ entries: ledger.entries, lines: ledger.lines, from, to }).profitLoss.netIncome)}</p></div>{segmentStatements.map(({ line, statements: segment }) => <div className="rounded-lg border border-line bg-surface p-4" key={line.id}><p className="font-bold">{line.name}</p><p className="mt-1 text-sm text-muted">Revenue {formatCurrency(segment.profitLoss.revenue)} · Net {formatCurrency(segment.profitLoss.netIncome)}</p></div>)}</section>
    <section className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-4">{[["Revenue", formatCurrency(statements.profitLoss.revenue)], ["Net income", formatCurrency(statements.profitLoss.netIncome)], ["Assets", formatCurrency(statements.balanceSheet.assets)], ["Net cash change", formatCurrency(statements.cashFlow.netChange)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 xl:grid-cols-2">
      <StatementTable exportHref={exportLink("profit_loss")} rows={statements.profitLoss.rows.map((row) => [row.account.code, row.account.name, row.balance])} title="Profit & loss" totals={[["Revenue", statements.profitLoss.revenue], ["Expenses", statements.profitLoss.expenses], ["Net income", statements.profitLoss.netIncome]]} />
      <StatementTable exportHref={exportLink("balance_sheet")} rows={statements.balanceSheet.rows.map((row) => [row.account.code, row.account.name, row.balance])} title="Balance sheet" totals={[["Assets", statements.balanceSheet.assets], ["Liabilities", statements.balanceSheet.liabilities], ["Equity", statements.balanceSheet.equity], ["Cumulative earnings", statements.balanceSheet.cumulativeEarnings], ["Equation difference", statements.balanceSheet.difference]]} />
      <StatementTable exportHref={exportLink("cash_flow")} rows={[["", "Operating activities", statements.cashFlow.operating], ["", "Investing activities", statements.cashFlow.investing], ["", "Financing activities", statements.cashFlow.financing]]} title="Statement of cash flows" totals={[["Net cash change", statements.cashFlow.netChange]]} />
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><div><h2 className="font-bold">Trial balance</h2><p className={`mt-1 text-sm ${statements.trialBalance.balanced ? "text-success" : "text-danger"}`}>{statements.trialBalance.balanced ? "Debits and credits agree" : `Difference ${formatCurrency(statements.trialBalance.difference)}`}</p></div><a aria-label="Download trial balance" className="flex size-9 items-center justify-center rounded-md border border-line-strong" href={exportLink("trial_balance")}><Download size={16} /></a></div><div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3 text-left">Account</th><th className="px-4 py-3 text-right">Debit</th><th className="px-4 py-3 text-right">Credit</th></tr></thead><tbody className="divide-y divide-line">{statements.trialBalance.rows.map((row) => <tr key={row.account.id}><td className="px-4 py-3"><span className="text-muted">{row.account.code}</span> · {row.account.name}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.debit)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(row.credit)}</td></tr>)}</tbody><tfoot className="bg-surface-muted font-bold"><tr><td className="px-4 py-3">Totals</td><td className="px-4 py-3 text-right">{formatCurrency(statements.trialBalance.totalDebits)}</td><td className="px-4 py-3 text-right">{formatCurrency(statements.trialBalance.totalCredits)}</td></tr></tfoot></table></div></section>
    </div>
  </div>;
}

function StatementTable({ title, rows, totals, exportHref }: { title: string; rows: [string, string, number][]; totals: [string, number][]; exportHref: string }) {
  return <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4"><h2 className="font-bold">{title}</h2><a aria-label={`Download ${title}`} className="flex size-9 items-center justify-center rounded-md border border-line-strong" href={exportHref}><Download size={16} /></a></div><div className="divide-y divide-line">{rows.map(([code, name, amount]) => <div className="flex items-center justify-between gap-4 px-5 py-3 text-sm" key={`${code}-${name}`}><span>{code ? <><span className="text-muted">{code}</span> · </> : null}{name}</span><strong className="tabular-nums">{formatCurrency(amount)}</strong></div>)}</div><dl className="border-t border-line bg-surface-muted px-5 py-3">{totals.map(([label, amount]) => <div className="flex justify-between gap-4 py-1 text-sm" key={label}><dt className="font-semibold">{label}</dt><dd className="font-bold tabular-nums">{formatCurrency(amount)}</dd></div>)}</dl></section>;
}
