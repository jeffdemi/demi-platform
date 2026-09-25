import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { getBusinessDocumentDetails } from "@/lib/repositories/business-repository";
import { getInvoice } from "@/lib/repositories/invoice-repository";
import { createClient } from "@/lib/supabase/server";
import { invoicePdfReviewDefaults } from "@/lib/invoice-pdf-review";
import { ReviewForm } from "./review-form";

export const metadata: Metadata = { title: "Review & edit invoice PDF" };

export default async function InvoicePdfReviewPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const id = Number((await params).invoiceId);
  if (!Number.isSafeInteger(id) || id <= 0) notFound();
  const context = await requireBusinessContext();
  const client = await createClient();
  const [invoice, business] = await Promise.all([getInvoice(client, context.business.id, id), getBusinessDocumentDetails(client, context.business.id)]);
  if (!invoice) notFound();
  const readOnly = context.role === "intern" || Boolean(invoice.archived_at);
  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
    <Link className="text-sm font-semibold text-brand hover:underline" href={`/invoices/${id}`}>← Back to invoice</Link>
    <h1 className="mt-4 text-3xl font-bold">Review &amp; edit invoice</h1>
    <p className="mt-2 text-muted">Highlighted fields appear in the PDF. Invoice numbering, status, and payment history stay controlled by the billing workflow.</p>
    {readOnly ? <div className="mt-6 rounded-lg border border-line p-5"><p>This invoice is read-only. You can view its saved PDF.</p><a className="mt-3 inline-block font-semibold text-brand" href={`/invoices/${id}/pdf`}>View saved PDF</a></div> : <ReviewForm
      invoiceId={id} initial={invoicePdfReviewDefaults(invoice, business)}
      versions={{ invoice: invoice.updated_at, customer: invoice.customers.updated_at ?? "", business: business.updated_at }}
      canEditBusiness={context.role === "owner" || context.role === "admin"}
    />}
  </div>;
}
