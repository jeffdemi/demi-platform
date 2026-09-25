import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { QuoteWithCustomer } from "@/lib/domain/quotes";
import { quotePdfReviewSchema, quotePdfReviewUpdates } from "../quote-pdf-review";
import { buildQuotePdf, type BusinessDetails } from "./pdf";

export async function saveQuotePdfReview(client: SupabaseClient<Database>, quote: QuoteWithCustomer, business: BusinessDetails, input: unknown, versions: { quote: string; customer: string; business: string }) {
  const values = quotePdfReviewUpdates(quotePdfReviewSchema.parse(input));
  // Render first: unsupported PDF text must not leave saved records behind.
  const bytes = await buildQuotePdf({ ...business, ...values.business }, { ...quote, ...values.quote, customers: { ...quote.customers, ...values.customer } });
  const result = await client.rpc("save_quote_pdf_review", {
    target_business_id: quote.business_id, target_quote_id: quote.id,
    expected_quote_updated_at: versions.quote, expected_customer_updated_at: versions.customer,
    expected_business_updated_at: versions.business,
    quote_values: values.quote, customer_values: values.customer, business_values: values.business,
  });
  if (result.error) throw new Error(result.error.message);
  return bytes;
}
