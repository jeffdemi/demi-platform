import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { InvoiceWithRelations } from "./repositories/invoice-repository";
import { invoiceDocumentLines, buildInvoicePdf } from "./services/pdf";
import { invoicePdfReviewDefaults, invoicePdfReviewSchema, invoicePdfReviewUpdates } from "./invoice-pdf-review";
import { saveInvoicePdfReview } from "./services/invoice-pdf-review";

vi.mock("./services/pdf", async importOriginal => ({ ...(await importOriginal<typeof import("./services/pdf")>()), buildInvoicePdf: vi.fn() }));
const business = { name: "Test Business", legal_name: null, phone: "555-0100", email: "office@example.com", address_line_1: null, address_line_2: null, city: null, region: null, postal_code: null };
const invoice = { id: 10, business_id: 1, customer_id: 2, job_id: 3, invoice_number: "INV-2026-0001-03", amount: 300, invoice_date: "2026-09-25", due_date: "2026-10-10", payment_terms: "Due on receipt", status: "unpaid", paid_date: null, notes: "PRIVATE NOTE", pdf_description: null, pdf_service_address: null, pdf_message: null, pdf_notes: null, archived_at: null, archived_by: null, archive_reason: null, customers: { first_name: "Pat", last_name: "Smith", customer_type: "individual", company_name: null, phone: null, email: null, updated_at: "2026-09-25T02:00:00Z" }, jobs: { id: 3, work_description: "Original work", service_address: "1 Main St" }, updated_at: "2026-09-25T01:00:00Z" } as InvoiceWithRelations;
const versions = { invoice: invoice.updated_at, customer: invoice.customers.updated_at!, business: "2026-09-25T03:00:00Z" };
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient<Database>;

beforeEach(() => { vi.resetAllMocks(); vi.mocked(buildInvoicePdf).mockResolvedValue(new Uint8Array([37, 80, 68, 70])); rpc.mockResolvedValue({ error: null }); });

describe("invoice PDF review", () => {
  it("saves the edited PDF fields and shared records atomically while preserving numbering", async () => {
    const edited = { ...invoicePdfReviewDefaults(invoice, business), amount: 425.99, pdf_description: "Updated work", pdf_service_address: "2 Oak Lane", pdf_message: "Thank you for choosing us.", pdf_notes: "Please keep this receipt.", first_name: "Updated", business_name: "Updated Business" };
    const result = await saveInvoicePdfReview(client, invoice, business, edited, versions);
    expect(result).toEqual(new Uint8Array([37, 80, 68, 70]));
    const payload = rpc.mock.calls[0][1];
    expect(payload).toMatchObject({ target_business_id: 1, target_invoice_id: 10, expected_invoice_updated_at: versions.invoice });
    expect(payload.invoice_values).not.toHaveProperty("invoice_number");
    const [pdfBusiness, pdfInvoice] = vi.mocked(buildInvoicePdf).mock.calls[0];
    expect(pdfBusiness).toMatchObject(payload.business_values); expect(pdfInvoice).toMatchObject(payload.invoice_values); expect(pdfInvoice.customers).toMatchObject(payload.customer_values);
    const lines = invoiceDocumentLines(pdfInvoice).join("\n");
    expect(lines).toContain("INV-2026-0001-03"); expect(lines).toContain("Updated work"); expect(lines).toContain("425.99"); expect(lines).toContain("Please keep this receipt."); expect(lines).not.toContain("PRIVATE NOTE");
  });
  it("renders before saving and rejects invalid edits", async () => {
    vi.mocked(buildInvoicePdf).mockRejectedValue(new Error("Unsupported PDF character"));
    await expect(saveInvoicePdfReview(client, invoice, business, invoicePdfReviewDefaults(invoice, business), versions)).rejects.toThrow("Unsupported PDF character");
    expect(rpc).not.toHaveBeenCalled();
    await expect(saveInvoicePdfReview(client, invoice, business, { ...invoicePdfReviewDefaults(invoice, business), due_date: "2026-01-01" }, versions)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("keeps paid date validation and clears optional PDF fields safely", () => {
    const values = invoicePdfReviewSchema.parse({ ...invoicePdfReviewDefaults(invoice, business), status: "paid", paid_date: "2026-09-25", pdf_notes: "" });
    const updates = invoicePdfReviewUpdates(values);
    expect(updates.invoice).not.toHaveProperty("invoice_number"); expect(updates.invoice.pdf_notes).toBeNull();
  });
});
