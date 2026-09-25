import { z } from "zod";
import type { InvoiceWithRelations } from "@/lib/repositories/invoice-repository";
import type { BusinessDetails } from "@/lib/services/pdf";

const text = (max = 5000) => z.string().trim().max(max);
const email = z.union([z.literal(""), z.email()]);
const date = z.iso.date();

export const invoicePdfReviewSchema = z.object({
  invoice_number: text(100).min(1, "Invoice number is required."),
  invoice_date: date,
  due_date: z.union([z.literal(""), date]),
  amount: z.coerce.number().finite().nonnegative().max(9999999999.99).multipleOf(0.01),
  payment_terms: text(250),
  pdf_description: text(500),
  pdf_service_address: text(500),
  pdf_message: text(500).min(1, "Customer message is required."),
  pdf_notes: text(2000),
  status: z.enum(["draft", "unpaid", "paid", "void"]),
  paid_date: z.union([z.literal(""), date]),
  customer_type: z.enum(["individual", "company"]),
  first_name: text(200), last_name: text(200), company_name: text(250),
  customer_phone: text(100), customer_email: email,
  business_name: text(250).min(1, "Business name is required."), legal_name: text(250),
  business_phone: text(100), business_email: email,
  address_line_1: text(500), address_line_2: text(500), city: text(100), region: text(100), postal_code: text(30),
}).superRefine((value, context) => {
  if (value.due_date && value.due_date < value.invoice_date) context.addIssue({ code: "custom", path: ["due_date"], message: "Due date cannot be before the invoice date." });
  if (value.status === "paid" && !value.paid_date) context.addIssue({ code: "custom", path: ["paid_date"], message: "Paid date is required for a paid invoice." });
  if (value.customer_type === "company" ? !value.company_name : !value.first_name && !value.last_name) context.addIssue({ code: "custom", path: [value.customer_type === "company" ? "company_name" : "first_name"], message: "Customer name is required." });
});

export type InvoicePdfReviewValues = z.infer<typeof invoicePdfReviewSchema>;

export function invoicePdfReviewDefaults(invoice: InvoiceWithRelations, business: BusinessDetails): InvoicePdfReviewValues {
  return {
    invoice_number: invoice.invoice_number, invoice_date: invoice.invoice_date, due_date: invoice.due_date ?? "", amount: invoice.amount,
    payment_terms: invoice.payment_terms ?? "Due on receipt", pdf_description: invoice.pdf_description ?? invoice.jobs?.work_description ?? "Stump grinding services",
    pdf_service_address: invoice.pdf_service_address ?? invoice.jobs?.service_address ?? "", pdf_message: invoice.pdf_message ?? "Thank you for your business!", pdf_notes: invoice.pdf_notes ?? "",
    status: invoice.status as InvoicePdfReviewValues["status"], paid_date: invoice.paid_date ?? "",
    customer_type: invoice.customers.customer_type as "individual" | "company", first_name: invoice.customers.first_name ?? "", last_name: invoice.customers.last_name ?? "", company_name: invoice.customers.company_name ?? "",
    customer_phone: invoice.customers.phone ?? "", customer_email: invoice.customers.email ?? "",
    business_name: business.name, legal_name: business.legal_name ?? "", business_phone: business.phone ?? "", business_email: business.email ?? "",
    address_line_1: business.address_line_1 ?? "", address_line_2: business.address_line_2 ?? "", city: business.city ?? "", region: business.region ?? "", postal_code: business.postal_code ?? "",
  };
}

export function invoicePdfReviewUpdates(v: InvoicePdfReviewValues) {
  const nullable = (value: string) => value || null;
  return {
    invoice: { invoice_date: v.invoice_date, due_date: nullable(v.due_date), amount: v.amount, payment_terms: nullable(v.payment_terms), pdf_description: nullable(v.pdf_description), pdf_service_address: nullable(v.pdf_service_address), pdf_message: v.pdf_message, pdf_notes: nullable(v.pdf_notes) },
    customer: { customer_type: v.customer_type, first_name: nullable(v.first_name), last_name: nullable(v.last_name), company_name: nullable(v.company_name), phone: nullable(v.customer_phone), email: nullable(v.customer_email) },
    business: { name: v.business_name, legal_name: nullable(v.legal_name), phone: nullable(v.business_phone), email: nullable(v.business_email), address_line_1: nullable(v.address_line_1), address_line_2: nullable(v.address_line_2), city: nullable(v.city), region: nullable(v.region), postal_code: nullable(v.postal_code) },
  };
}
