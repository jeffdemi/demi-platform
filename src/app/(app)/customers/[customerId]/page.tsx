import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BriefcaseBusiness, FileText, Mail, MapPin, Pencil, Phone, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { jobStatusLabel } from "@/lib/domain/jobs";
import { quotePriceLabel, quoteStatusLabel } from "@/lib/domain/quotes";
import { getCustomerDetail } from "@/lib/repositories/customer-repository";
import { listQuotesForCustomer } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customer details" };

export default async function CustomerDetailPage({ params }: { params: Promise<{ customerId: string }> }) {
  const customerId = Number((await params).customerId);
  if (!Number.isInteger(customerId)) notFound();
  const context = await requireBusinessContext();
  const { business } = context;
  const client = await createClient();
  const [customer, quotes] = await Promise.all([
    getCustomerDetail(client, business.id, customerId),
    listQuotesForCustomer(client, business.id, customerId),
  ]);
  if (!customer) notFound();

  // The most recent quote that hasn't already become a job and isn't dead — the one worth continuing.
  const openQuote = quotes.find((quote) => !quote.job_id && !["declined", "expired"].includes(quote.status));
  const addJobHref = openQuote ? `/jobs/new?quoteId=${openQuote.id}` : `/jobs/new?customerId=${customer.id}`;
  const addJobLabel = openQuote ? "Continue quote → job" : "Add job";

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader actions={context.role !== "intern" ? <><Link className="flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 font-semibold hover:bg-surface-muted" href={`/customers/${customer.id}/edit`}><Pencil aria-hidden="true" size={16} />Edit</Link><Link className="flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 font-semibold hover:bg-surface-muted" href={`/quotes/new?customerId=${customer.id}`}><FileText aria-hidden="true" size={16} />Add quote</Link><Link className="flex h-10 items-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand hover:bg-brand-strong" href={addJobHref}><Plus aria-hidden="true" size={17} />{addJobLabel}</Link></> : null} description={customer.active ? customer.customer_type === "company" ? "Company" : "Individual" : "Inactive customer"} title={customer.displayName} />

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
            <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-2"><FileText aria-hidden="true" className="text-brand" size={19} /><h2 className="font-bold">Quotes</h2></div><Link className="text-sm font-semibold text-brand hover:underline" href={`/quotes?customerId=${customer.id}`}>View all</Link></div>
            {quotes.length ? <div className="divide-y divide-line">{quotes.slice(0, 5).map((quote) => <Link className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-page" href={`/quotes/${quote.id}`} key={quote.id}><div className="min-w-0"><p className="truncate font-semibold">{quote.quote_number}</p><p className="mt-1 text-sm text-muted">{formatDate(quote.quote_date)} · {quotePriceLabel(quote)}</p></div><StatusBadge label={quoteStatusLabel(quote.status)} status={quote.status} /></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-muted">No quotes for this customer.</p>}
          </section>
          <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
            <div className="flex items-center justify-between border-b border-line px-5 py-4"><div className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="text-brand" size={19} /><h2 className="font-bold">Jobs</h2></div><Link className="text-sm font-semibold text-brand hover:underline" href={`/jobs?customerId=${customer.id}`}>View all</Link></div>
            {customer.jobs.length ? <div className="divide-y divide-line">{customer.jobs.map((job) => <Link className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-page" href={`/jobs/${job.id}`} key={job.id}><div className="min-w-0"><p className="truncate font-semibold">{job.work_description || job.service_address || "Job"}</p><p className="mt-1 text-sm text-muted">{formatDate(job.scheduled_date || job.job_date)}</p></div><StatusBadge label={jobStatusLabel(job.status)} status={job.status} /></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-muted">No jobs for this customer.</p>}
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
