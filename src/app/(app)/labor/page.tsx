import type { Metadata } from "next";
import Link from "next/link";
import { Settings } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { laborClassOptions } from "@/lib/domain/management-accounting";
import { formatCurrency, formatDate } from "@/lib/format";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { listLaborEntries } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { ArchiveLaborEntryForm, LaborEntryForm } from "./labor-forms";

export const metadata: Metadata = { title: "Labor & Payroll" };

export default async function LaborPage({ searchParams }: { searchParams: Promise<{ class?: string; archived?: string }> }) {
  const filters = await searchParams;
  const context = await requireBusinessContext();
  if (context.role === "employee") redirect("/dashboard");
  const client = await createClient();
  const [entries, jobs] = await Promise.all([
    listLaborEntries(client, context.business.id, { laborClass: filters.class, includeVoided: filters.archived === "1" }),
    listJobOptions(client, context.business.id),
  ]);
  const active = entries.filter((entry) => !entry.voided_at);
  const wages = active.reduce((sum, entry) => sum + entry.gross_wages, 0);
  const burden = active.reduce((sum, entry) => sum + entry.employer_payroll_taxes + entry.benefits, 0);
  const hours = active.reduce((sum, entry) => sum + entry.regular_hours + entry.overtime_hours, 0);
  const today = dateInTimeZone(context.business.timezone);
  const monthStart = `${today.slice(0, 7)}-01`;
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/reports/settings"><Settings size={17} />Owner compensation & targets</Link>} description="Track wage productivity separately from materials and operating expenses." title="Labor & Payroll" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">{[["Gross wages", formatCurrency(wages)], ["Payroll taxes & benefits", formatCurrency(burden)], ["Total labor cash cost", formatCurrency(wages + burden)], ["Recorded hours", hours.toFixed(1)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 className="font-bold">Payroll history</h2><form className="flex gap-2"><select className="h-9 rounded-md border border-line-strong bg-surface px-2 text-sm" defaultValue={filters.class ?? ""} name="class"><option value="">All labor classes</option>{laborClassOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><label className="flex h-9 items-center gap-2 rounded-md border border-line-strong px-2 text-sm"><input defaultChecked={filters.archived === "1"} name="archived" type="checkbox" value="1" />Archived</label><button className="h-9 rounded-md border border-line-strong px-3 text-sm font-semibold">Apply</button></form></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Period</th><th className="px-4 py-3">Worker</th><th className="px-4 py-3">Class</th><th className="px-4 py-3 text-right">Hours</th><th className="px-4 py-3 text-right">Wages</th><th className="px-4 py-3 text-right">Burden</th><th className="px-4 py-3">Correction</th></tr></thead><tbody className="divide-y divide-line">{entries.map((entry) => <tr className={entry.voided_at ? "opacity-55" : ""} key={entry.id}><td className="px-4 py-3">{formatDate(entry.period_start)} to {formatDate(entry.period_end)}</td><td className="px-4 py-3"><p className="font-semibold">{entry.worker_name}</p><p className="text-xs capitalize text-muted">{entry.worker_type}{entry.jobs ? ` - ${entry.jobs.work_description || `Job #${entry.jobs.id}`}` : ""}</p></td><td className="px-4 py-3"><StatusBadge label={entry.labor_class} status={entry.labor_class} /></td><td className="px-4 py-3 text-right tabular-nums">{(entry.regular_hours + entry.overtime_hours).toFixed(1)}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{formatCurrency(entry.gross_wages)}</td><td className="px-4 py-3 text-right tabular-nums">{formatCurrency(entry.employer_payroll_taxes + entry.benefits)}</td><td className="px-4 py-3">{entry.voided_at ? entry.void_reason : <ArchiveLaborEntryForm entryId={entry.id} />}</td></tr>)}{!entries.length && <tr><td className="px-5 py-14 text-center text-muted" colSpan={7}>No labor entries recorded.</td></tr>}</tbody></table></div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Add labor entry</h2><p className="mt-1 text-sm text-muted">Use gross wages before employee deductions. Employer taxes and benefits stay separate.</p><div className="mt-5"><LaborEntryForm jobs={jobs} periodEnd={today} periodStart={monthStart} /></div></section>
    </div>
  </div>;
}
