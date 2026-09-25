import type { Metadata } from "next";
import Link from "next/link";
import { Download, Pencil, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RecordLifecycleControl } from "@/components/record-lifecycle-control";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { customerQuoteMessage, optionLabel, quoteHasFinalPrice, quotePriceLabel, quoteStatusLabel } from "@/lib/domain/quotes";
import { formatDate } from "@/lib/format";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { getQuote } from "@/lib/repositories/quote-repository";
import { getQuoteAiWorkbench, isQuoteAiConfigured } from "@/lib/services/quote-ai";
import { createClient } from "@/lib/supabase/server";
import { MessageEditor } from "../message-editor";
import { QuoteAiWorkbench } from "../quote-ai-workbench";
import { QuotePhotoManager } from "../quote-photo-manager";
import { QuoteStatusActions } from "../status-actions";
import { QuoteDraftStep1 } from "./quote-draft-step1";
import { QuoteDraftStep2 } from "./quote-draft-step2";

export const metadata: Metadata = { title: "Quote details" };

const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => <div>
  <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
  <dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{value || "Not recorded"}</dd>
</div>;

export default async function QuoteDetailPage({ params, searchParams }: { params: Promise<{ quoteId: string }>; searchParams: Promise<{ step?: string }> }) {
  const id = Number((await params).quoteId);
  if (!Number.isInteger(id)) notFound();
  const context = await requireBusinessContext();
  const { business } = context;
  const client = await createClient();
  const quote = await getQuote(client, business.id, id);
  if (!quote) notFound();
  const workbench = await getQuoteAiWorkbench(client, business.id, id);
  const converted = quote.job_id !== null;
  const draft = quote.status === "draft";
  const readOnly = context.role === "intern";

  if (draft) {
    const step = (await searchParams).step === "2" ? 2 : 1;
    if (step === 2) {
      return <QuoteDraftStep2 photoCount={workbench.photos.length} quote={quote} readOnly={readOnly} recommendation={workbench.recommendation} />;
    }
    const customers = await listActiveCustomerOptions(client, business.id, quote.customer_id);
    return <QuoteDraftStep1
      customers={customers}
      messages={workbench.messages}
      photos={workbench.photos}
      quote={quote}
      readOnly={readOnly}
      recommendation={workbench.recommendation}
      today={dateInTimeZone(business.timezone)}
    />;
  }

  return <div className="mx-auto w-full max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<>
      <a className="flex h-10 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold" href={`/quotes/${quote.id}/pdf/review`}><Download size={16} />Create PDF</a>
      {!converted && !quote.archived_at && !readOnly ? <Link className="flex h-10 items-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/quotes/${quote.id}/edit`}><Pencil size={16} />Edit quote</Link> : null}
    </>} description={`${formatDate(quote.quote_date)} - ${quoteStatusLabel(quote.status)}`} title={quote.quote_number} />

    {(context.role !== "employee" && context.role !== "intern") ? <section className="mt-5 rounded-lg border border-line bg-surface p-4 shadow-sm"><RecordLifecycleControl archived={Boolean(quote.archived_at)} id={quote.id} label="quote" type="quote" /></section> : null}
    <div className="grid gap-5 pt-6 lg:grid-cols-[0.8fr_1.2fr]">
      <QuotePhotoManager businessId={business.id} draft={draft} photos={workbench.photos} quoteId={quote.id} readOnly={readOnly} />
      <QuoteAiWorkbench configured={isQuoteAiConfigured()} draft={draft} messages={workbench.messages} photoCount={workbench.photos.length} quoteId={quote.id} readOnly={readOnly} recommendation={workbench.recommendation} />
    </div>

    <div className="grid gap-5 py-6 lg:grid-cols-[0.78fr_1.22fr]">
      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <div className="flex justify-between gap-3"><h2 className="font-bold">Overview</h2><StatusBadge label={quoteStatusLabel(quote.status)} status={quote.status} /></div>
          <Link className="mt-5 flex items-center gap-2 font-semibold text-brand" href={`/customers/${quote.customer_id}`}><UserRound size={17} />{customerDisplayName(quote.customers)}</Link>
          <dl className="mt-5 grid gap-4"><Detail label="Service address" value={quote.service_address} /><Detail label="Property location" value={optionLabel(quote.property_location)} /><Detail label="Location details" value={quote.location_description} /></dl>
        </section>
        <section className="rounded-lg border border-line bg-brand p-5 text-on-brand"><p className="text-sm text-on-brand-muted">Quoted price</p><p className="mt-1 text-3xl font-bold">{quotePriceLabel(quote)}</p>{quote.expiration_date && <p className="mt-4 text-sm text-on-brand-muted">Valid through {formatDate(quote.expiration_date)}</p>}</section>
        {converted && <Link className="block rounded-lg border border-brand-border bg-brand-soft p-4 font-semibold text-brand" href={`/jobs/${quote.job_id}`}>View converted job</Link>}
      </div>
      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Sales actions</h2><div className="mt-4"><QuoteStatusActions accepted={quote.status === "accepted"} converted={converted} priceReady={quoteHasFinalPrice(quote)} quoteId={quote.id} readOnly={readOnly} /></div></section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Customer message</h2><p className="mt-1 text-sm text-muted">Edit this text before copying it into a text or email.</p><div className="mt-4"><MessageEditor message={customerQuoteMessage(quote)} /></div></section>
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Quote details</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2"><div className="sm:col-span-2"><Detail label="Customer scope" value={quote.customer_scope} /></div><Detail label="Referral source" value={quote.referral_source} /><Detail label="Contact method" value={optionLabel(quote.contact_method)} /><Detail label="Sent date" value={formatDate(quote.sent_date)} /><Detail label="Response date" value={formatDate(quote.response_date)} /><Detail label="Accepted method" value={optionLabel(quote.accepted_method)} /><Detail label="PA 811 required" value={quote.pa811_required ? "Yes" : "No"} /><div className="sm:col-span-2"><Detail label="Hazard notes" value={quote.hazard_notes} /></div><div className="sm:col-span-2"><Detail label="Acceptance notes" value={quote.acceptance_notes} /></div></dl></section>
        {quote.internal_notes && <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Internal notes</h2><p className="mt-3 whitespace-pre-wrap text-sm text-muted-strong">{quote.internal_notes}</p></section>}
      </div>
    </div>
  </div>;
}
