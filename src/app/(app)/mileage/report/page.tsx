import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { buildMileageReportRows, normalizeMileageSettings, summarizeMileageReport, type MileageLeg } from "@/lib/domain/mileage";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatDate } from "@/lib/format";
import { getMileageSettings, listApprovedMileageTripsForYear } from "@/lib/repositories/mileage-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Yearly Mileage Report" };

export default async function MileageReportPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const context = await requireBusinessContext();
  const client = await createClient();
  const currentYear = Number(dateInTimeZone(context.business.timezone).slice(0, 4));
  const requestedYear = Number((await searchParams).year);
  const year = Number.isInteger(requestedYear) && requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : currentYear;

  const [settings, trips] = await Promise.all([
    getMileageSettings(client, context.business.id).then(normalizeMileageSettings),
    listApprovedMileageTripsForYear(client, context.business.id, year),
  ]);
  const rows = buildMileageReportRows(trips.map((trip) => ({ trip_date: trip.trip_date, purpose: trip.purpose, legs: trip.legs as MileageLeg[] })));
  const summary = summarizeMileageReport(rows, settings.irs_standard_mileage_rate);

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/mileage"><ArrowLeft size={17} />Mileage</Link>} description="Approved trips only. Nothing here posts to your bookkeeping." title="Yearly Mileage Report" />

    <form className="my-6 flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm" method="get">
      <label className="text-sm font-semibold">Year<input className="mt-1 block h-10 w-28 rounded-md border border-line-strong bg-surface px-3" defaultValue={year} max="2100" min="2000" name="year" type="number" /></label>
      <button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand">Apply</button>
    </form>

    <section className="grid grid-cols-2 gap-3 pb-6 sm:grid-cols-3">
      <div className="rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-xl font-bold tabular-nums">{summary.totalMiles.toFixed(1)}</p><p className="mt-1 text-xs text-muted">Total miles</p></div>
      <div className="rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-xl font-bold tabular-nums">{settings.irs_standard_mileage_rate === null ? "—" : `$${settings.irs_standard_mileage_rate.toFixed(3)}`}</p><p className="mt-1 text-xs text-muted">Rate per mile</p></div>
      <div className="rounded-lg border border-line bg-surface p-4 shadow-sm"><p className="text-xl font-bold tabular-nums">{summary.totalDeduction === null ? "Set your mileage rate" : `$${summary.totalDeduction.toFixed(2)}`}</p><p className="mt-1 text-xs text-muted">Estimated deduction</p></div>
    </section>

    <p className="mb-5 rounded-md border border-accent-border bg-accent-soft px-4 py-3 text-sm leading-6">The standard mileage rate can&apos;t be combined with actual vehicle expense deductions for the same vehicle -- confirm with your tax preparer before filing.</p>

    <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 className="font-bold">Trip log — {year}</h2>
        <a aria-label="Download CSV" className="flex size-9 items-center justify-center rounded-md border border-line-strong" href={`/api/v1/reports/mileage?year=${year}`}><Download size={16} /></a>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Origin</th><th className="px-4 py-3">Destination</th><th className="px-4 py-3">Purpose</th><th className="px-4 py-3 text-right">Miles</th></tr></thead>
          <tbody className="divide-y divide-line">
            {rows.map((row, index) => <tr key={index}><td className="px-4 py-3">{formatDate(row.date)}</td><td className="px-4 py-3">{row.origin}</td><td className="px-4 py-3">{row.destination}</td><td className="px-4 py-3">{row.purpose}</td><td className="px-4 py-3 text-right tabular-nums">{row.miles.toFixed(1)}</td></tr>)}
            {!rows.length && <tr><td className="px-4 py-10 text-center text-muted" colSpan={5}>No approved mileage trips for {year}.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>;
}
