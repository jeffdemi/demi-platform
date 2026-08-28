import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { getQuoteForEdit, listQuotesForCustomer } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";
import { JobForm, type JobFromQuote } from "../job-form";

export const metadata: Metadata = { title: "Add job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customerId?: string; quoteId?: string }> }) {
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect("/jobs");
  const client = await createClient();
  const params = await searchParams;

  const requestedQuoteId = Number(params.quoteId);
  const quoteRow = Number.isInteger(requestedQuoteId) ? await getQuoteForEdit(client, business.id, requestedQuoteId) : null;

  const requestedCustomerId = Number(params.customerId);
  const defaultCustomerId = quoteRow?.customer_id
    ?? (Number.isInteger(requestedCustomerId) ? requestedCustomerId : undefined);

  const [customers, quotesForCustomer] = await Promise.all([
    listActiveCustomerOptions(client, business.id),
    defaultCustomerId ? listQuotesForCustomer(client, business.id, defaultCustomerId) : Promise.resolve([]),
  ]);

  // Only quotes that haven't already become a job and aren't dead (declined/expired) are worth offering.
  const openQuotes = quotesForCustomer.filter((quote) => !quote.job_id && !["declined", "expired"].includes(quote.status));
  const quoteOptions = openQuotes.map((quote) => ({
    id: quote.id,
    label: `${quote.quote_number} — ${quote.customer_scope || quote.service_address || "Quote"}`,
  }));

  const fromQuote: JobFromQuote | undefined = quoteRow ? {
    id: quoteRow.id,
    quote_number: quoteRow.quote_number,
    service_address: quoteRow.service_address,
    municipality: quoteRow.municipality,
    property_location: quoteRow.property_location,
    location_description: quoteRow.location_description,
    referral_source: quoteRow.referral_source,
    customer_scope: quoteRow.customer_scope,
    hazard_notes: quoteRow.hazard_notes,
    quoted_price: quoteRow.quoted_price,
    pro_bono: quoteRow.pro_bono,
    pa811_required: quoteRow.pa811_required,
    acceptance_notes: quoteRow.acceptance_notes,
  } : undefined;

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader description="Record work scope, scheduling, pricing, and completion details." title="Add job" />
    <JobForm customers={customers} defaultCustomerId={defaultCustomerId} fromQuote={fromQuote} quoteOptions={quoteOptions} />
  </div>;
}
