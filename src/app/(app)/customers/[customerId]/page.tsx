import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, FileText, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { jobStatusLabel } from "@/lib/domain/jobs";
import { getCustomerDetail } from "@/lib/repositories/customer-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customer details" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const customerId = Number((await params).customerId);
  if (!Number.isInteger(customerId)) notFound();
  const { business } = await requireBusinessContext();
  const customer = await getCustomerDetail(await createClient(), business.id, customerId);
  if (!customer) notFound();

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader actions={<><Link className="flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 font-semibold hover:bg-surface-muted" href={`/customers/${customer.id}/edit`}><Pencil aria-hidden="true" size={16} />Edit</Link><Link className="flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 font-semibold hover:bg-surface-muted" href={`/quotes/new?customerId=${customer.id}`}><FileText aria-hidden="true" size={16} />Add quote</Link><Link className="flex h-10 items-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand hover:bg-brand-strong" href={`/jobs/new?customerId=${customer.id}`}><Plus aria-hidden="true" size={17} />Add job</Link></>} description={customer.active ? customer.customer_type === "company" ? "Company" : "Individual" : "Inactive customer"} title={customer.displayName} />

      <section className="grid gap-5 py-6 lg:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-5">
          <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
            <h2 className="font-bold">Contact</h2>
            <div className="mt-4 space-y-4 text-sm">
              <p className="flex items-start gap-3"><Phone aria-hidden="true" className="mt-0.5 text-muted" size={17} /><span>{customer.phone || "No phone recorded"}</span></p>
              <p className="flex items-start gap-3"><Mail aria-hidden="true" className="mt-0.5 text-muted" size={17} /><span className="break-all">{customer.email || "No email recorded"}</span></p>
              {customer.company_name && customer.customer_type !== "company" && <p className="flex items-start gap-3"><MapPin aria-hidden="true" className="mt-0.5 text-muted" size={17} /><span>{customer.company_name}</span></p>}
            </div>
          </div>
          <div className="rounded-lg border border-line bg-brand text-on-brand p-5 shadow-sm">
            <p className="text-sm text-on-brand-muted">Historical paid revenue</p>
            <p className="mt-2 text-3xl font-bold tabular-nums">{formatCurrency(customer.paidRevenue)}</p>
            <p className="mt-4 text-sm text-on-brand-muted">{customer.jobs.length} total job{customer.jobs.length === 1 ? "" : "s"}</p>
          </div>
          {customer.notes && <div className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Internal notes</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-strong">{customer.notes}</p></div>}
        </div>

        <div className="space-y-5">
          <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="text-brand" size={19} /><h2 className="font-bold">Jobs</h2></div><Link className="text-sm font-semibold text-brand hover:underline" href={`/jobs?customerId=${customer.id}`}>View all</Link></div>
            {customer.jobs.length ? <div className="divide-y divide-line">{customer.jobs.map((job) => <Link className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-page" href={`/jobs/${job.id}`} key={job.id}><div className="min-w-0"><p className="truncate font-semibold">{job.work_description || job.service_address || "Job"}</p><p className="mt-1 text-sm text-muted">{formatDate(job.scheduled_date || job.job_date)}{job.municipality ? ` · ${job.municipality}` : ""}</p></div><StatusBadge label={jobStatusLabel(job.status)} status={job.status} /></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-muted">No jobs for this customer.</p>}
          </section>
          <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <div className="border-b border-line px-5 py-4"><h2 className="font-bold">Invoice history</h2></div>
            {customer.invoices.length ? <div className="divide-y divide-line">{customer.invoices.map((invoice) => <Link className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-page" href={`/invoices/${invoice.id}`} key={invoice.id}><div><p className="font-semibold">{invoice.invoice_number}</p><p className="mt-1 text-sm text-muted">{formatDate(invoice.invoice_date)} · {invoice.status}</p></div><p className="font-semibold tabular-nums">{formatCurrency(invoice.amount)}</p></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-muted">No invoices for this customer.</p>}
          </section>
        </div>
      </section>
    </div>
  );
}
