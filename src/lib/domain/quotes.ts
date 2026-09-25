import type { Database } from "@/types/database";
import { customerDisplayName, type Customer } from "./customers";

type QuoteRow = Database["public"]["Tables"]["quotes"]["Row"];
export type Quote = Omit<QuoteRow, "archive_reason" | "archived_at" | "archived_by" | "pdf_terms" | "pdf_notes"> & Partial<Pick<QuoteRow, "archive_reason" | "archived_at" | "archived_by" | "pdf_terms" | "pdf_notes">>;
export type QuoteCustomer = Pick<Customer, "company_name" | "customer_type" | "email" | "first_name" | "last_name" | "phone">;
export type QuoteWithCustomer = Quote & { customers: QuoteCustomer };

export const quoteStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "accepted", label: "Accepted" },
  { value: "declined", label: "Declined" },
  { value: "no_response", label: "No response" },
  { value: "expired", label: "Expired" },
  { value: "converted", label: "Converted" },
] as const;

export const contactMethodOptions = ["text", "email", "phone", "website", "in_person", "other"] as const;
export const acceptedMethodOptions = ["text", "email", "phone", "verbal", "in_person", "other"] as const;
export const propertyLocationOptions = ["front_yard", "back_yard", "left_side", "right_side", "multiple_areas", "other"] as const;

export function optionLabel(value: string | null | undefined) {
  if (!value) return "Not set";
  const text = value.split("_").filter(Boolean).join(" ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function quoteStatusLabel(value: string | null | undefined) {
  return quoteStatusOptions.find((option) => option.value === value)?.label ?? optionLabel(value);
}

export function quoteHasFinalPrice(quote: Pick<Quote, "pro_bono" | "quoted_price">) {
  return quote.pro_bono || quote.quoted_price > 0;
}

export function quotePriceLabel(quote: Pick<Quote, "pro_bono" | "quoted_price">) {
  if (quote.pro_bono) return "Pro bono";
  if (!quoteHasFinalPrice(quote)) return "Price pending";
  return quote.quoted_price.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export function quoteMatchesSearch(quote: QuoteWithCustomer, search: string) {
  const query = search.trim().toLowerCase();
  if (!query) return true;
  return [
    quote.quote_number,
    customerDisplayName(quote.customers),
    quote.customers.company_name,
    quote.service_address,
    quote.customer_scope,
  ].some((value) => value?.toLowerCase().includes(query));
}

function looksPlural(scope: string) {
  const text = scope.toLowerCase();
  return /\b(stumps|multiple|two|three|four|five|six|seven|eight|nine|\d+)\b/.test(text);
}

export function customerQuoteMessage(quote: QuoteWithCustomer) {
  const name = quote.customers.customer_type === "company"
    ? quote.customers.company_name
    : quote.customers.first_name;
  const greetingName = name || customerDisplayName(quote.customers);
  const scope = quote.customer_scope || "the stump grinding work we discussed";
  const stumpPhrase = looksPlural(scope) ? "the stumps" : "the stump";
  const locationParts = [
    quote.service_address,
    quote.property_location ? optionLabel(quote.property_location).toLowerCase() : null,
    quote.location_description,
  ].filter(Boolean);
  const location = locationParts.length ? locationParts.join(", ") : "your property";
  const lines = [`Hi ${greetingName}, thanks for sending the information and photos.`, ""];
  lines.push(quote.pro_bono
    ? `I can take care of ${stumpPhrase} at ${location} at no charge.`
    : quoteHasFinalPrice(quote)
      ? `I can grind ${stumpPhrase} at ${location} for $${quote.quoted_price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}.`
      : `I am reviewing the details for ${stumpPhrase} at ${location} and will follow up with a price.`);
  lines.push("", `This includes ${scope}. The grindings will remain neatly on site unless otherwise noted.`);
  if (quote.expiration_date) lines.push("", `This quote is good through ${quote.expiration_date}.`);
  lines.push("", "Let me know if you'd like to move forward, and we'll find a time that works.", "", "Thanks,", "Jeff", "Demi Stump Grinding");
  return lines.join("\n");
}

export function quoteDocumentLines(quote: QuoteWithCustomer) {
  return [
    `Quote ${quote.quote_number}`,
    `Date: ${quote.quote_date}`,
    `Customer: ${customerDisplayName(quote.customers)}`,
    quote.customers.phone ? `Customer phone: ${quote.customers.phone}` : null,
    quote.customers.email ? `Customer email: ${quote.customers.email}` : null,
    quote.service_address ? `Service address: ${quote.service_address}` : null,
    quote.property_location ? `Property location: ${optionLabel(quote.property_location)}` : null,
    quote.location_description ? `Location details: ${quote.location_description}` : null,
    `Scope: ${quote.customer_scope || "Stump grinding work as discussed"}`,
    quote.pro_bono ? "Price: No charge" : quoteHasFinalPrice(quote) ? `Price: $${quote.quoted_price.toFixed(2)}` : "Price: Pending estimate",
    quote.expiration_date ? `Valid through: ${quote.expiration_date}` : null,
    quote.pdf_terms ?? "To accept this quote, contact the business using the details above.",
    quote.pdf_notes ? `Notes: ${quote.pdf_notes}` : null,
  ].filter((line): line is string => Boolean(line));
}

export function quoteStatusUpdate(status: "sent" | "accepted" | "declined" | "no_response" | "expired", today: string, existingSentDate: string | null, acceptedMethod?: string) {
  const values: { status: string; sent_date?: string; response_date?: string; accepted_method?: string } = { status };
  if (status === "sent") values.sent_date = existingSentDate || today;
  if (["accepted", "declined"].includes(status)) values.response_date = today;
  if (acceptedMethod) values.accepted_method = acceptedMethod;
  return values;
}
