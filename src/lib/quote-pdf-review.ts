import { z } from "zod";
import type { QuoteWithCustomer } from "@/lib/domain/quotes";
import type { BusinessDetails } from "@/lib/services/pdf";

const text = (max = 5000) => z.string().trim().max(max);
const email = z.union([z.literal(""), z.email()]);
const date = z.iso.date();
export const quotePdfReviewSchema = z.object({
  quote_number: text(100).min(1, "Quote number is required."),
  quote_date: date,
  expiration_date: z.union([z.literal(""), date]),
  service_address: text(500), property_location: text(100), location_description: text(),
  customer_scope: text().min(1, "Scope is required."),
  quoted_price: z.coerce.number().finite().nonnegative().max(9999999999.99).multipleOf(0.01),
  pro_bono: z.boolean(), pdf_terms: text(), pdf_notes: text(),
  customer_type: z.enum(["individual", "company"]),
  first_name: text(200), last_name: text(200), company_name: text(250),
  customer_phone: text(100), customer_email: email,
  business_name: text(250).min(1, "Business name is required."), legal_name: text(250),
  business_phone: text(100), business_email: email,
  address_line_1: text(500), address_line_2: text(500), city: text(100), region: text(100), postal_code: text(30),
}).superRefine((v, ctx) => {
  if (v.expiration_date && v.expiration_date < v.quote_date) ctx.addIssue({ code: "custom", path: ["expiration_date"], message: "Expiration cannot be before the quote date." });
  if (!v.pro_bono && v.quoted_price <= 0) ctx.addIssue({ code: "custom", path: ["quoted_price"], message: "Enter a final price or select pro bono." });
  if (v.customer_type === "company" ? !v.company_name : !v.first_name && !v.last_name) ctx.addIssue({ code: "custom", path: [v.customer_type === "company" ? "company_name" : "first_name"], message: "Customer name is required." });
});
export type QuotePdfReviewValues = z.infer<typeof quotePdfReviewSchema>;
export function quotePdfReviewDefaults(quote: QuoteWithCustomer, business: BusinessDetails): QuotePdfReviewValues {
  return {
    quote_number: quote.quote_number, quote_date: quote.quote_date, expiration_date: quote.expiration_date ?? "",
    service_address: quote.service_address ?? "", property_location: quote.property_location ?? "", location_description: quote.location_description ?? "",
    customer_scope: quote.customer_scope ?? "Stump grinding work as discussed", quoted_price: quote.quoted_price, pro_bono: quote.pro_bono,
    pdf_terms: quote.pdf_terms ?? "To accept this quote, contact the business using the details above.", pdf_notes: quote.pdf_notes ?? "",
    customer_type: quote.customers.customer_type as "individual" | "company", first_name: quote.customers.first_name ?? "", last_name: quote.customers.last_name ?? "", company_name: quote.customers.company_name ?? "",
    customer_phone: quote.customers.phone ?? "", customer_email: quote.customers.email ?? "",
    business_name: business.name, legal_name: business.legal_name ?? "", business_phone: business.phone ?? "", business_email: business.email ?? "",
    address_line_1: business.address_line_1 ?? "", address_line_2: business.address_line_2 ?? "", city: business.city ?? "", region: business.region ?? "", postal_code: business.postal_code ?? "",
  };
}
export function quotePdfReviewUpdates(v: QuotePdfReviewValues) {
  const nullable = (s: string) => s || null;
  return {
    quote: { quote_number: v.quote_number, quote_date: v.quote_date, expiration_date: nullable(v.expiration_date), service_address: nullable(v.service_address), property_location: nullable(v.property_location), location_description: nullable(v.location_description), customer_scope: v.customer_scope, quoted_price: v.pro_bono ? 0 : v.quoted_price, pro_bono: v.pro_bono, pdf_terms: v.pdf_terms, pdf_notes: nullable(v.pdf_notes) },
    customer: { customer_type: v.customer_type, first_name: nullable(v.first_name), last_name: nullable(v.last_name), company_name: nullable(v.company_name), phone: nullable(v.customer_phone), email: nullable(v.customer_email) },
    business: { name: v.business_name, legal_name: nullable(v.legal_name), phone: nullable(v.business_phone), email: nullable(v.business_email), address_line_1: nullable(v.address_line_1), address_line_2: nullable(v.address_line_2), city: nullable(v.city), region: nullable(v.region), postal_code: nullable(v.postal_code) },
  };
}
