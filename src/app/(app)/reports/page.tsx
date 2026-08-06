import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { buildTaxExpenseSummary, trialBalance } from "@/lib/domain/accounting";
import { buildReportSummary } from "@/lib/domain/reports";
import { formatCurrency } from "@/lib/format";
import { getReportData } from "@/lib/repositories/reporting-repository";
import { getLedgerReport, getTaxExpenses } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { business } = await requireBusinessContext();
  const requestedYear = Number((await searchParams).year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : new Date().getFullYear();
  const client = await createClient();
  const [reportData, taxExpenses, ledger] = await Promise.all([
    getReportData(client, business.id),
    getTaxExpenses(client, business.id, year),
    getLedgerReport(client, business.id, `${year}-01-01`, `${year}-12-31`),
  ]);
  const report = buildReportSummary(reportData);
  const tax = buildTaxExpenseSummary(taxExpenses);
  const balance = trialBalance(ledger.lines);
  const cards = [
    ["Paid revenue", formatCurrency(report.paidRevenue)],
    ["Operating expense", formatCurrency(report.operatingExpenses)],
    ["Operating profit", formatCurrency(report.net)],
    ["Asset purchases", formatCurrency(report.assetPurchases)],
    ["Refunds / credits", formatCurrency(report.refunds)],
    ["Net cash outflow", formatCurrency(report.cashOutflow)],
    ["Cash net", formatCurrency(report.cashNet)],
    ["Outstanding invoices", formatCurrency(report.outstandingInvoices)],
    ["Quoted pipeline", formatCurrency(report.quotedPipeline)],
    ["Quote acceptance", `${report.acceptanceRate}%`],
  ];
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Cash reporting, tax preparation, and a balanced source-linked general ledger." title="Reports" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-3 xl:grid-cols-5">{cards.map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]"><section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Monthly financial performance</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Operating</th><th className="px-4 py-3 text-right">Assets</th><th className="px-4 py-3 text-right">Refunds</th><th className="px-4 py-3 text-right">Operating profit</th><th className="px-4 py-3 text-right">Cash net</th></tr></thead><tbody className="divide-y divide-line">{report.months.map((month) => <tr key={month.month}><td className="px-4 py-3 font-semibold">{month.month}</td><td className="px-4 py-3 text-right">{formatCurrency(month.revenue)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.operatingExpenses)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.assetPurchases)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.refunds)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(month.net)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(month.cashNet)}</td></tr>)}</tbody></table></div></section>
      <div className="space-y-5"><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Tax preparation</h2><form><input className="h-9 w-24 rounded-md border border-line-strong bg-surface px-2" defaultValue={year} max="2100" min="2000" name="year" type="number" /><button className="ml-2 h-9 rounded-md border border-line-strong px-3 font-semibold">Load</button></form></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-muted">Deductible operating</dt><dd className="font-bold">{formatCurrency(tax.deductibleOperating)}</dd></div><div><dt className="text-muted">Asset purchases</dt><dd className="font-bold">{formatCurrency(tax.assetPurchases)}</dd></div><div><dt className="text-muted">Purchase refunds</dt><dd className="font-bold">{formatCurrency(tax.refunds)}</dd></div><div><dt className="text-muted">Ledger</dt><dd className={`font-bold ${balance.balanced ? "text-brand" : "text-danger"}`}>{balance.balanced ? "Balanced" : "Review required"}</dd></div></dl><div className="mt-4 space-y-2">{tax.categories.slice(0, 8).map(([category, amount]) => <div className="flex justify-between gap-4 border-b border-line pb-2 text-sm" key={category}><span>{category}</span><strong>{formatCurrency(amount)}</strong></div>)}</div></section><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Operating expense by category</h2><div className="mt-3 space-y-2">{report.categories.map(([category, amount]) => <div className="flex justify-between gap-4 border-b border-line pb-2 text-sm" key={category}><span>{category}</span><strong>{formatCurrency(amount)}</strong></div>)}{!report.categories.length && <p className="text-sm text-muted">No operating expenses.</p>}</div></section><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Exports & API</h2><div className="mt-3 grid gap-2"><a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/reports/tax-summary?year=${year}&format=csv`}><span>Tax expense detail CSV</span><Download size={15} /></a><a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/reports/general-ledger?from=${year}-01-01&to=${year}-12-31&format=csv`}><span>General ledger CSV</span><Download size={15} /></a>{["customers", "jobs", "quotes", "invoices", "expenses"].map((resource) => <a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/${resource}?format=csv`} key={resource}><span className="capitalize">{resource} CSV</span><Download size={15} /></a>)}</div></section></div>
    </div>
  </div>;
}
