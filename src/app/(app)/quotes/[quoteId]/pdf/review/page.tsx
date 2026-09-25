import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { getQuote } from "@/lib/repositories/quote-repository";
import { getBusinessDocumentDetails } from "@/lib/repositories/business-repository";
import { createClient } from "@/lib/supabase/server";
import { quotePdfReviewDefaults } from "@/lib/quote-pdf-review";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Review & edit quote PDF" };
export default async function QuotePdfReviewPage({ params }: { params: Promise<{ quoteId: string }> }) {
  const id = Number((await params).quoteId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const context = await requireBusinessContext();
  const client = await createClient();
  const [quote, business] = await Promise.all([getQuote(client, context.business.id, id), getBusinessDocumentDetails(client, context.business.id)]);
  if (!quote) notFound();
  const readOnly = context.role === "intern" || Boolean(quote.archived_at) || quote.job_id !== null || quote.status === "converted";
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <Link className="text-sm font-semibold text-brand hover:underline" href={`/quotes/${id}?step=2`}>← Back to quote</Link>
    <h1 className="mt-4 text-3xl font-bold">Review &amp; edit quote</h1>
    <p className="mt-2 text-muted">Highlighted fields appear in the PDF. Review them, then save your changes and generate the document.</p>
    {readOnly ? <div className="mt-6 rounded-lg border border-line p-5"><p>This quote is read-only. You can view its saved PDF.</p><a className="mt-3 inline-block font-semibold text-brand" href={`/quotes/${id}/pdf`}>View saved PDF</a></div> : <ReviewForm
      quoteId={id} initial={quotePdfReviewDefaults(quote, business)}
      versions={{ quote: quote.updated_at, customer: quote.customers.updated_at, business: business.updated_at }}
      canEditBusiness={context.role === "owner" || context.role === "admin"}
    />}
  </div>;
}
