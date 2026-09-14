import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createJob } from "@/lib/repositories/job-repository";
import { convertQuote, getQuoteForEdit } from "@/lib/repositories/quote-repository";

export async function createJobFromForm(
  client: SupabaseClient<Database>,
  values: Database["public"]["Tables"]["jobs"]["Insert"],
  quoteId: number | null,
) {
  if (quoteId === null) return createJob(client, values);
  const quote = await getQuoteForEdit(client, values.business_id, quoteId);
  if (!quote) throw new Error("That quote no longer exists.");
  if (quote.job_id !== null || quote.status === "converted") throw new Error("This quote has already been converted.");
  if (quote.customer_id !== values.customer_id) throw new Error("The selected quote belongs to a different customer.");
  if (quote.archived_at !== null || !["draft", "sent", "accepted", "no_response"].includes(quote.status)) {
    throw new Error("Select an active quote that has not already become a job.");
  }
  if (quote.status !== "accepted") return createJob(client, values);
  // The RPC rechecks state under a row lock; no job update follows conversion.
  const { business_id: businessId, quote_id: quoteLink, ...finalValues } = values;
  void quoteLink; // The transaction owns the quote/job link.
  return { id: await convertQuote(client, businessId, quoteId, finalValues) };
}
