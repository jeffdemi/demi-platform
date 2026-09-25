"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { getBusinessDocumentDetails } from "@/lib/repositories/business-repository";
import { getInvoice } from "@/lib/repositories/invoice-repository";
import { invoicePdfReviewSchema } from "@/lib/invoice-pdf-review";
import { saveInvoicePdfReview } from "@/lib/services/invoice-pdf-review";
import { createClient } from "@/lib/supabase/server";

export type InvoiceReviewState = { message?: string; errors?: Record<string, string[]>; values?: Record<string, string>; attemptId?: string; pdf?: string };

export async function saveReview(invoiceId: number, _: InvoiceReviewState, form: FormData): Promise<InvoiceReviewState> {
  const values = Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const restore = { values, attemptId: randomUUID() };
  const parsed = invoicePdfReviewSchema.safeParse(values);
  if (!parsed.success) return { ...restore, errors: parsed.error.flatten().fieldErrors, message: "Check the highlighted fields below." };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { ...restore, message: "Interns have read-only access." };
  try {
    const client = await createClient();
    const [invoice, business] = await Promise.all([getInvoice(client, context.business.id, invoiceId), getBusinessDocumentDetails(client, context.business.id)]);
    if (!invoice || invoice.archived_at) return { ...restore, message: "This invoice is no longer available for editing." };
    const bytes = await saveInvoicePdfReview(client, invoice, business, parsed.data, { invoice: values.invoice_version, customer: values.customer_version, business: values.business_version });
    revalidatePath("/invoices"); revalidatePath(`/invoices/${invoiceId}`); revalidatePath("/customers"); revalidatePath(`/customers/${invoice.customer_id}`); revalidatePath("/", "layout");
    return { pdf: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    return { ...restore, message: error instanceof Error ? error.message : "Unable to save and generate the PDF. Your edits are still shown below." };
  }
}
