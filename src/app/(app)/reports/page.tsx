import type { Metadata } from "next";
import { Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { buildReportSummary } from "@/lib/domain/reports";
import { formatCurrency } from "@/lib/format";
import { getReportData } from "@/lib/repositories/reporting-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reports" };

export default async function ReportsPage() {
  const { business } = await requireBusinessContext();
  const report = buildReportSummary(await getReportData(await createClient(), business.id));
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
  return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Operating profit separates normal expenses from capital purchases and treats refunds as credits." title="Reports" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-3 xl:grid-cols-5">{cards.map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[1.4fr_0.6fr]"><section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Monthly financial performance</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[820px] text-left"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Revenue</th><th className="px-4 py-3 text-right">Operating</th><th className="px-4 py-3 text-right">Assets</th><th className="px-4 py-3 text-right">Refunds</th><th className="px-4 py-3 text-right">Operating profit</th><th className="px-4 py-3 text-right">Cash net</th></tr></thead><tbody className="divide-y divide-line">{report.months.map((month) => <tr key={month.month}><td className="px-4 py-3 font-semibold">{month.month}</td><td className="px-4 py-3 text-right">{formatCurrency(month.revenue)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.operatingExpenses)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.assetPurchases)}</td><td className="px-4 py-3 text-right">{formatCurrency(month.refunds)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(month.net)}</td><td className="px-4 py-3 text-right font-semibold">{formatCurrency(month.cashNet)}</td></tr>)}</tbody></table></div></section>
      <div className="space-y-5"><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Operating expense by category</h2><div className="mt-3 space-y-2">{report.categories.map(([category, amount]) => <div className="flex justify-between gap-4 border-b border-line pb-2 text-sm" key={category}><span>{category}</span><strong>{formatCurrency(amount)}</strong></div>)}{!report.categories.length && <p className="text-sm text-muted">No operating expenses.</p>}</div></section><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Exports & API</h2><div className="mt-3 grid gap-2">{["customers", "jobs", "quotes", "invoices", "expenses"].map((resource) => <a className="flex h-10 items-center justify-between rounded-md border border-line-strong px-3 text-sm font-semibold hover:bg-surface-muted" href={`/api/v1/${resource}?format=csv`} key={resource}><span className="capitalize">{resource} CSV</span><Download size={15} /></a>)}</div></section></div>
    </div>
  </div>;
}
