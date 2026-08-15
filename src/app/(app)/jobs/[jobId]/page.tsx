import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, FilePlus2, MapPin, Pencil, UserRound } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RecordLifecycleControl } from "@/components/record-lifecycle-control";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { jobStatusLabel } from "@/lib/domain/jobs";
import { formatCurrency, formatDate, formatMinutes, formatTime } from "@/lib/format";
import { getJobDetail } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Job details" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return <div><dt className="text-xs font-semibold uppercase text-muted">{label}</dt><dd className="mt-1 whitespace-pre-wrap text-sm font-medium text-ink">{value || "Not recorded"}</dd></div>;
}

export default async function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const jobId = Number((await params).jobId);
  if (!Number.isInteger(jobId)) notFound();
  const context = await requireBusinessContext();
  const { business } = context;
  const job = await getJobDetail(await createClient(), business.id, jobId);
  if (!job) notFound();
  const customerName = customerDisplayName(job.customers);

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader actions={<>{!job.archived_at ? <><Link className="flex h-10 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold hover:bg-surface-muted" href={`/invoices/new?jobId=${job.id}`}><FilePlus2 aria-hidden="true" size={16} />Create invoice</Link><Link className="flex h-10 items-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand hover:bg-brand-strong" href={`/jobs/${job.id}/edit`}><Pencil aria-hidden="true" size={16} />Edit job</Link></> : null}</>} description={job.source_job_number ? `Imported job ${job.source_job_number}` : `Job #${job.id}`} title={job.work_description || "Job details"} />
      {context.role !== "employee" ? <section className="mt-5 rounded-lg border border-line bg-surface p-4 shadow-sm"><RecordLifecycleControl archived={Boolean(job.archived_at)} id={job.id} label="job" type="job" /></section> : null}

      <div className="grid gap-5 py-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h2 className="font-bold">Overview</h2><StatusBadge label={jobStatusLabel(job.status)} status={job.status} /></div>
            <div className="mt-5 space-y-4 text-sm">
              <Link className="flex items-start gap-3 font-semibold text-brand hover:underline" href={`/customers/${job.customer_id}`}><UserRound aria-hidden="true" className="mt-0.5" size={17} />{customerName}</Link>
              <p className="flex items-start gap-3"><MapPin aria-hidden="true" className="mt-0.5 text-muted" size={17} /><span>{job.service_address || "No service address"}{job.municipality ? <><br /><span className="text-muted">{job.municipality}</span></> : null}</span></p>
              <p className="flex items-start gap-3"><CalendarDays aria-hidden="true" className="mt-0.5 text-muted" size={17} /><span>{formatDate(job.scheduled_date || job.job_date)}{job.scheduled_start_time ? <><br /><span className="text-muted">{formatTime(job.scheduled_start_time)}</span></> : null}</span></p>
            </div>
          </section>
          <section className="rounded-lg border border-line bg-brand p-5 text-on-brand shadow-sm"><p className="text-sm text-on-brand-muted">Quoted</p><p className="mt-1 text-3xl font-bold tabular-nums">{job.pro_bono ? "Pro bono" : formatCurrency(job.amount_quoted)}</p><div className="mt-5 border-t border-white/15 pt-4"><p className="text-sm text-on-brand-muted">Paid</p><p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(job.amount_paid)}</p></div></section>
        </div>

        <div className="space-y-5">
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Work details</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Detail label="Description" value={job.work_description} /></div><Detail label="Property location" value={job.property_location} /><Detail label="Location description" value={job.location_description} /><Detail label="Referral source" value={job.referral_source} /><Detail label="PA 811 required" value={job.pa811_required ? "Yes" : "No"} /><div className="sm:col-span-2"><Detail label="Hazard notes" value={job.hazard_notes} /></div></dl></section>
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Schedule and completion</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Job date" value={formatDate(job.job_date)} /><Detail label="Scheduled date" value={formatDate(job.scheduled_date)} /><Detail label="Start time" value={job.scheduled_start_time ? formatTime(job.scheduled_start_time) : "Not set"} /><Detail label="Estimated duration" value={formatMinutes(job.estimated_duration_minutes)} /><Detail label="Completion date" value={formatDate(job.completed_date)} /><Detail label="Paid date" value={formatDate(job.paid_date)} /></dl></section>
          <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Time and payment</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Detail label="Travel" value={formatMinutes(job.travel_minutes)} /><Detail label="Grinding" value={formatMinutes(job.grinding_minutes)} /><Detail label="Cleanup" value={formatMinutes(job.cleanup_minutes)} /><Detail label="Machine hours" value={job.machine_hours?.toString()} /><Detail label="Payment method" value={job.payment_method} /><Detail label="Pro bono" value={job.pro_bono ? "Yes" : "No"} /></dl></section>
          {job.notes && <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Internal notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-strong">{job.notes}</p></section>}
          <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Invoices</h2></div>{job.invoices.length ? <div className="divide-y divide-line">{job.invoices.map((invoice) => <Link className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-page" href={`/invoices/${invoice.id}`} key={invoice.id}><div><p className="font-semibold">{invoice.invoice_number}</p><p className="mt-1 text-sm text-muted">{formatDate(invoice.invoice_date)} · {invoice.status}</p></div><p className="font-semibold tabular-nums">{formatCurrency(invoice.amount)}</p></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-muted">No invoice linked to this job.</p>}</section>
        </div>
      </div>
    </div>
  );
}
