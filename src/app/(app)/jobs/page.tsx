import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { dateInTimeZone, jobStatusLabel, jobStatusOptions, operationalViews } from "@/lib/domain/jobs";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import { listJobs } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ customerId?: string; q?: string; status?: string; view?: string }> }) {
  const parameters = await searchParams;
  const { business } = await requireBusinessContext();
  const customerId = Number(parameters.customerId);
  const jobs = await listJobs(await createClient(), business.id, {
    customerId: Number.isInteger(customerId) && customerId > 0 ? customerId : undefined,
    search: parameters.q,
    status: parameters.status,
    view: parameters.view,
    today: dateInTimeZone(business.timezone),
  });

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong" href={customerId ? `/jobs/new?customerId=${customerId}` : "/jobs/new"}><Plus aria-hidden="true" size={18} />Add job</Link>} description={`${jobs.length} matching job${jobs.length === 1 ? "" : "s"}`} title="Jobs" />

      <form className="my-5 grid gap-3 rounded-lg border border-line bg-surface p-4 shadow-sm lg:grid-cols-[minmax(240px,1fr)_180px_180px_auto]" method="get">
        {customerId > 0 && <input name="customerId" type="hidden" value={customerId} />}
        <label className="relative min-w-0"><span className="sr-only">Search jobs</span><Search aria-hidden="true" className="absolute left-3 top-3 text-muted" size={18} /><input className="h-11 w-full rounded-md border border-line-strong bg-surface pl-10 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" defaultValue={parameters.q ?? ""} name="q" placeholder="Customer, phone, address, municipality, or work" /></label>
        <label><span className="sr-only">Status</span><select className="h-11 w-full rounded-md border border-line-strong bg-surface px-3" defaultValue={parameters.status ?? ""} name="status"><option value="">All statuses</option>{jobStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}<option value="no_response">No response (imported)</option><option value="pending">Pending (imported)</option></select></label>
        <label><span className="sr-only">Operational view</span><select className="h-11 w-full rounded-md border border-line-strong bg-surface px-3" defaultValue={parameters.view ?? ""} name="view"><option value="">All operational views</option>{operationalViews.map((view) => <option key={view.value} value={view.value}>{view.label}</option>)}</select></label>
        <button className="h-11 rounded-md border border-line-strong bg-surface px-4 font-semibold hover:bg-surface-muted">Apply</button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        {jobs.length ? <div className="divide-y divide-line">{jobs.map((job) => <Link className="grid gap-3 px-4 py-4 hover:bg-page sm:grid-cols-[minmax(0,1.5fr)_minmax(160px,0.7fr)_130px_110px] sm:items-center sm:px-5" href={`/jobs/${job.id}`} key={job.id}><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="truncate font-semibold">{customerDisplayName(job.customers)}</p><StatusBadge label={jobStatusLabel(job.status)} status={job.status} /></div><p className="mt-1 truncate text-sm text-muted">{job.work_description || job.service_address || "No work description"}</p></div><div className="text-sm"><p>{job.service_address || "No address"}</p><p className="mt-1 text-muted">{job.municipality || "Municipality not set"}</p></div><div className="text-sm"><p>{formatDate(job.scheduled_date || job.job_date)}</p><p className="mt-1 text-muted">{job.scheduled_start_time ? formatTime(job.scheduled_start_time) : "Unscheduled"}</p></div><div className="sm:text-right"><p className="font-semibold tabular-nums">{formatCurrency(job.amount_paid)}</p><p className="mt-1 text-xs text-muted">Amount paid</p></div></Link>)}</div> : <div className="px-5 py-14 text-center"><p className="font-semibold">No jobs found</p><p className="mt-1 text-sm text-muted">Adjust the filters or add a job.</p></div>}
      </div>
    </div>
  );
}
