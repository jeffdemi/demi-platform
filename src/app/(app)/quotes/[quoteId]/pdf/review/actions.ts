"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { getQuote } from "@/lib/repositories/quote-repository";
import { getBusinessDocumentDetails } from "@/lib/repositories/business-repository";
import { quotePdfReviewSchema } from "@/lib/quote-pdf-review";
import { saveQuotePdfReview } from "@/lib/services/quote-pdf-review";
import { createClient } from "@/lib/supabase/server";

export type ReviewState = { message?: string; errors?: Record<string, string[]>; values?: Record<string, string>; attemptId?: string; pdf?: string };
export async function saveReview(quoteId: number, _: ReviewState, form: FormData): Promise<ReviewState> {
  const values = Object.fromEntries([...form.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string"));
  const restore = { values, attemptId: randomUUID() };
  const parsed = quotePdfReviewSchema.safeParse({ ...values, pro_bono: form.get("pro_bono") === "on" });
  if (!parsed.success) return { ...restore, errors: parsed.error.flatten().fieldErrors, message: "Check the highlighted fields below." };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { ...restore, message: "Interns have read-only access." };
  try {
    const client = await createClient();
    const [quote, business] = await Promise.all([getQuote(client, context.business.id, quoteId), getBusinessDocumentDetails(client, context.business.id)]);
    if (!quote || quote.archived_at || quote.job_id !== null || quote.status === "converted") return { ...restore, message: "This quote is no longer available for editing." };
    const bytes = await saveQuotePdfReview(client, quote, business, parsed.data, {
      quote: values.quote_version, customer: values.customer_version, business: values.business_version,
    });
    revalidatePath("/quotes"); revalidatePath(`/quotes/${quoteId}`);
    revalidatePath("/customers"); revalidatePath(`/customers/${quote.customer_id}`);
    revalidatePath("/", "layout");
    return { pdf: Buffer.from(bytes).toString("base64") };
  } catch (error) {
    return { ...restore, message: error instanceof Error ? error.message : "Unable to save and generate the PDF. Your edits are still shown below." };
  }
}
