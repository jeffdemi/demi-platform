import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { buildMonthlyLedgerGrids } from "@/lib/domain/bookkeeping";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { buildMonthlyExpenseCategoryGrid } from "@/lib/domain/reports";
import { formatCurrency } from "@/lib/format";
import { getLedgerReport } from "@/lib/repositories/accounting-repository";
import { listBusinessLines } from "@/lib/repositories/business-finance-repository";
import { getReportData } from "@/lib/repositories/reporting-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Monthly Reports" };

const statementTabs = [
  { key: "pl", label: "Profit & loss" },
  { key: "bs", label: "Balance sheet" },
  { key: "cf", label: "Cash flow" },
  { key: "expense", label: "Expense by category" },
] as const;

function monthLabel(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleString("en-US", { month: "short", timeZone: "UTC" });
}

function cell(value: number | null) {
  return value === null ? <span className="text-muted">—</span> : formatCurrency(value);
}

export default async function MonthlyReportsPage({ searchParams }: { searchParams: Promise<{ year?: string; statement?: string; line?: string }> }) {
  const context = await requireBusinessContext();
  const query = await searchParams;
  const currentDate = dateInTimeZone(context.business.timezone);
  const currentYear = Number(currentDate.slice(0, 4));
  const requestedYear = Number(query.year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;
  const to = year === currentYear ? currentDate : `${year}-12-31`;
  const statement = statementTabs.some((tab) => tab.key === query.statement) ? query.statement! : "pl";
  const client = await createClient();
  const [ledger, businessLines, reportData] = await Promise.all([
    getLedgerReport(client, context.business.id, undefined, to),
    listBusinessLines(client, context.business.id),
    getReportData(client, context.business.id),
  ]);
  const selectedLineId = /^\d+$/.test(query.line ?? "") ? Number(query.line) : undefined;
  const grids = buildMonthlyLedgerGrids({ entries: ledger.entries, lines: ledger.lines, year, to, businessLineId: selectedLineId });
  const expenseGrid = buildMonthlyExpenseCategoryGrid(reportData.expenses, year, to);
  const months = grids.months.map(monthLabel);
  const lineSuffix = selectedLineId ? `&line=${selectedLineId}` : "";
  const exportHref = `/api/v1/reports/monthly?statement=${statement}&year=${year}${lineSuffix}&format=csv`;
  const netIncomeByMonth = months.map((_, index) => (
    grids.profitLoss.rows.filter((row) => row.account.account_type === "revenue").reduce((sum, row) => sum + row.monthly[index], 0)
    - grids.profitLoss.rows.filter((row) => row.account.account_type === "expense").reduce((sum, row) => sum + row.monthly[index], 0)
  ));

  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports"><ArrowLeft size={17} />Reports</Link>} description="Pick a year and see every month side by side, standard bookkeeping style." title="Monthly Reports" />
    <form className="my-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm">
      <input name="statement" type="hidden" value={statement} />
      <label className="text-sm font-semibold">Year<input className="mt-1 block h-10 w-28 rounded-md border border-line-strong bg-surface px-3" defaultValue={year} max="2100" min="2000" name="year" type="number" /></label>
      <label className="text-sm font-semibold">Business line<select className="mt-1 block h-10 rounded-md border border-line-strong bg-surface px-3" defaultValue={selectedLineId ?? ""} name="line"><option value="">Consolidated</option>{businessLines.map((line) => <option key={line.id} value={line.id}>{line.name}</option>)}</select></label>
      <button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand">Apply</button>
    </form>
    <div className="mb-5 flex flex-wrap gap-2">
      {statementTabs.map((tab) => <Link className={`flex h-10 items-center rounded-md border px-4 text-sm font-semibold ${statement === tab.key ? "border-brand bg-brand text-on-brand" : "border-line-strong"}`} href={`/reports/monthly?year=${year}&statement=${tab.key}${lineSuffix}`} key={tab.key}>{tab.label}</Link>)}
    </div>
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-bold">{statementTabs.find((tab) => tab.key === statement)?.label} — {year}</h2>
        <a aria-label="Download CSV" className="flex size-9 items-center justify-center rounded-md border border-line-strong" href={exportHref}><Download size={16} /></a>
      </div>
      <div className="overflow-x-auto">
        {statement === "pl" && <table className="w-full min-w-[1100px] text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3 text-left">Account</th>{months.map((month, index) => <th className="px-3 py-3 text-right" key={`${month}-${index}`}>{month}</th>)}<th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-line">{grids.profitLoss.rows.map((row) => <tr key={row.account.id}><td className="px-4 py-3"><span className="text-muted">{row.account.code}</span> · {row.account.name}</td>{row.monthly.map((value, index) => <td className="px-3 py-3 text-right tabular-nums" key={index}>{formatCurrency(value)}</td>)}<td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total)}</td></tr>)}</tbody><tfoot className="bg-surface-muted font-bold"><tr><td className="px-4 py-3">Net income</td>{netIncomeByMonth.map((value, index) => <td className="px-3 py-3 text-right tabular-nums" key={index}>{formatCurrency(value)}</td>)}<td className="px-4 py-3 text-right tabular-nums">{formatCurrency(grids.profitLoss.revenue - grids.profitLoss.expenses)}</td></tr></tfoot></table>}

        {statement === "bs" && <table className="w-full min-w-[1000px] text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3 text-left">Account</th>{months.map((month, index) => <th className="px-3 py-3 text-right" key={`${month}-${index}`}>{month}</th>)}</tr></thead><tbody className="divide-y divide-line">{grids.balanceSheet.rows.map((row) => <tr key={row.account.id}><td className="px-4 py-3"><span className="text-muted">{row.account.code}</span> · {row.account.name}</td>{row.monthly.map((value, index) => <td className="px-3 py-3 text-right tabular-nums" key={index}>{cell(value)}</td>)}</tr>)}</tbody></table>}

        {statement === "cf" && <table className="w-full min-w-[1100px] text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3 text-left">Activity</th>{months.map((month, index) => <th className="px-3 py-3 text-right" key={`${month}-${index}`}>{month}</th>)}<th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-line">{grids.cashFlow.rows.map((row) => <tr key={row.section}><td className="px-4 py-3 capitalize">{row.section} activities</td>{row.monthly.map((value, index) => <td className="px-3 py-3 text-right tabular-nums" key={index}>{formatCurrency(value)}</td>)}<td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total)}</td></tr>)}</tbody><tfoot className="bg-surface-muted font-bold"><tr><td className="px-4 py-3">Net cash change</td>{grids.cashFlow.netChange.monthly.map((value, index) => <td className="px-3 py-3 text-right tabular-nums" key={index}>{formatCurrency(value)}</td>)}<td className="px-4 py-3 text-right tabular-nums">{formatCurrency(grids.cashFlow.netChange.total)}</td></tr></tfoot></table>}

        {statement === "expense" && <table className="w-full min-w-[1100px] text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3 text-left">Category</th>{months.map((month, index) => <th className="px-3 py-3 text-right" key={`${month}-${index}`}>{month}</th>)}<th className="px-4 py-3 text-right">Total</th></tr></thead><tbody className="divide-y divide-line">{expenseGrid.map((row) => <tr key={row.category}><td className="px-4 py-3">{row.category}</td>{row.monthly.map((value, index) => <td className="px-3 py-3 text-right tabular-nums" key={index}>{formatCurrency(value)}</td>)}<td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(row.total)}</td></tr>)}{!expenseGrid.length && <tr><td className="px-4 py-6 text-center text-muted" colSpan={14}>No operating expenses for {year}.</td></tr>}</tbody></table>}
      </div>
    </section>
  </div>;
}
