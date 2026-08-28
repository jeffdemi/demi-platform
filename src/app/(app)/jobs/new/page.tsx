import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { listJobQuotePrefills } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Add job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customerId?: string; quoteId?: string }> }) {
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect("/jobs");
  const client = await createClient();
  const params = await searchParams;

  const [customers, quotePrefills] = await Promise.all([
    listActiveCustomerOptions(client, business.id),
    listJobQuotePrefills(client, business.id),
  ]);

  const activeCustomerIds = new Set(customers.map((customer) => customer.id));
  const quoteOptions = quotePrefills.filter((quote) => activeCustomerIds.has(quote.customer_id));

  const requestedQuoteId = Number(params.quoteId);
  const defaultQuote = Number.isInteger(requestedQuoteId)
    ? quoteOptions.find((quote) => quote.id === requestedQuoteId)
    : undefined;
  const requestedCustomerId = Number(params.customerId);
  const defaultCustomerId = defaultQuote?.customer_id
    ?? (Number.isInteger(requestedCustomerId) && activeCustomerIds.has(requestedCustomerId) ? requestedCustomerId : undefined);

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <PageHeader description="Record work scope, scheduling, pricing, and completion details." title="Add job" />
    <JobForm
      customers={customers}
      defaultCustomerId={defaultCustomerId}
      defaultQuoteId={defaultQuote?.id}
      quoteOptions={quoteOptions}
    />
  </div>;
}
