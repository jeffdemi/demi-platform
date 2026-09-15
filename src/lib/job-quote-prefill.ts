import type { Database } from "@/types/database";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];

export type JobQuotePrefill = Pick<
  QuoteRow,
  | "id"
  | "customer_id"
  | "quote_number"
  | "status"
  | "service_address"
  | "property_location"
  | "location_description"
  | "referral_source"
  | "customer_scope"
  | "hazard_notes"
  | "quoted_price"
  | "pro_bono"
  | "pa811_required"
  | "acceptance_notes"
  | "internal_notes"
>;

export function quotesForCustomer(quotes: JobQuotePrefill[], customerId: number | null) {
  return customerId === null ? quotes : quotes.filter((quote) => quote.customer_id === customerId);
}

export function jobDefaultsFromQuote(quote: JobQuotePrefill) {
  return {
    customerId: quote.customer_id,
    status: "quoted",
    serviceAddress: quote.service_address ?? "",
    propertyLocation: quote.property_location ?? "",
    locationDescription: quote.location_description ?? "",
    referralSource: quote.referral_source ?? "",
    workDescription: quote.customer_scope ?? "",
    hazardNotes: quote.hazard_notes ?? "",
    amountQuoted: quote.pro_bono || quote.quoted_price > 0 ? String(quote.quoted_price) : "",
    proBono: quote.pro_bono,
    pa811Required: quote.pa811_required,
    notes: [quote.acceptance_notes, quote.internal_notes].filter(Boolean).join("\n\n"),
  };
}
