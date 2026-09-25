import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InvoiceWithRelations } from "@/lib/repositories/invoice-repository";
import { invoicePdfReviewSchema, invoicePdfReviewUpdates } from "../invoice-pdf-review";
import { buildInvoicePdf, type BusinessDetails } from "./pdf";

export async function saveInvoicePdfReview(client: SupabaseClient<Database>, invoice: InvoiceWithRelations, business: BusinessDetails, input: unknown, versions: { invoice: string; customer: string; business: string }) {
  const parsed = invoicePdfReviewSchema.parse(input);
  const values = invoicePdfReviewUpdates(parsed);
  const rendered = { ...invoice, ...values.invoice, customers: { ...invoice.customers, ...values.customer } };
  const bytes = await buildInvoicePdf({ ...business, ...values.business }, rendered);
  const result = await client.rpc("save_invoice_pdf_review", {
    target_business_id: invoice.business_id, target_invoice_id: invoice.id,
    expected_invoice_updated_at: versions.invoice, expected_customer_updated_at: versions.customer,
    expected_business_updated_at: versions.business, invoice_values: values.invoice,
    customer_values: values.customer, business_values: values.business,
  });
  if (result.error) throw new Error(result.error.message);
  return bytes;
}
