import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { normalizeFinancialSettings } from "@/lib/domain/management-accounting";
import { formatCurrency } from "@/lib/format";
import { getFinancialSettings, listOwnerCompensation } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { FinancialSettingsForm, OwnerCompensationForm } from "./settings-forms";

export const metadata: Metadata = { title: "Owner Compensation & Targets" };

export default async function ReportingSettingsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) redirect("/dashboard");
  const client = await createClient();
  const [storedSettings, compensation] = await Promise.all([
    getFinancialSettings(client, context.business.id),
    listOwnerCompensation(client, context.business.id),
  ]);
  const settings = normalizeFinancialSettings(storedSettings);
  const requestedMonth = (await searchParams).month;
  const currentMonth = dateInTimeZone(context.business.timezone).slice(0, 7);
  const month = requestedMonth && /^\d{4}-\d{2}$/.test(requestedMonth) ? requestedMonth : currentMonth;
  const selectedCompensation = compensation.find((entry) => entry.period_month.startsWith(month));
  const actions = <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports"><ArrowLeft size={17} />Reports</Link>;
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={actions} description="Normalize owner pay and set the benchmarks used by management reporting." title="Owner Compensation & Targets" />
    <div className="grid gap-5 py-6 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="text-lg font-bold">Financial settings</h2><p className="mt-1 text-sm leading-6 text-muted">Owner salary pays for the work you perform. Distributions are tracked separately as a return on ownership.</p><FinancialSettingsForm settings={settings} /></section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="text-lg font-bold">Record owner compensation</h2><p className="mt-1 text-sm leading-6 text-muted">Create one record per month. Select a month from history to load and correct it without duplicating the record.</p><OwnerCompensationForm defaults={selectedCompensation} month={month} suggestedMarketSalary={(settings.owner_market_salary_annual ?? 0) / 12} /></section>
    </div>
    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Compensation history</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Month</th><th className="px-4 py-3 text-right">Market salary</th><th className="px-4 py-3 text-right">Actual wages</th><th className="px-4 py-3 text-right">Distributions</th><th className="px-4 py-3 text-right">Contributions</th></tr></thead><tbody className="divide-y divide-line">{compensation.map((entry) => <tr key={entry.id}><td className="px-4 py-3 font-semibold"><Link className="text-brand" href={`/reports/settings?month=${entry.period_month.slice(0, 7)}`}>{entry.period_month.slice(0, 7)}</Link></td><td className="px-4 py-3 text-right">{formatCurrency(entry.market_salary_amount)}</td><td className="px-4 py-3 text-right">{formatCurrency(entry.actual_wages)}</td><td className="px-4 py-3 text-right">{formatCurrency(entry.distributions)}</td><td className="px-4 py-3 text-right">{formatCurrency(entry.contributions)}</td></tr>)}{!compensation.length && <tr><td className="px-5 py-12 text-center text-muted" colSpan={5}>No owner compensation months recorded.</td></tr>}</tbody></table></div></section>
  </div>;
}
