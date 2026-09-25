import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { quoteDocumentLines, type QuoteWithCustomer } from "./domain/quotes";
import { quotePdfReviewDefaults, quotePdfReviewSchema, quotePdfReviewUpdates } from "./quote-pdf-review";
import { saveQuotePdfReview } from "./services/quote-pdf-review";
import { buildQuotePdf } from "./services/pdf";
vi.mock("./services/pdf", () => ({ buildQuotePdf: vi.fn() }));
const business = { name: "Test Business", legal_name: null, phone: "555-0100", email: "office@example.com", address_line_1: null, address_line_2: null, city: null, region: null, postal_code: null };
const quote = { id: 10, business_id: 1, customer_id: 2, quote_number: "Q-10", quote_date: "2026-09-25", expiration_date: null, quoted_price: 300, pro_bono: false, customer_scope: "Original scope", service_address: "1 Main St", property_location: null, location_description: null, internal_notes: "PRIVATE NOTE", customers: { first_name: "Pat", last_name: "Smith", customer_type: "individual", company_name: null, phone: null, email: null } } as QuoteWithCustomer;
const versions = { quote: "2026-09-25T01:00:00Z", customer: "2026-09-25T02:00:00Z", business: "2026-09-25T03:00:00Z" };
const rpc = vi.fn();
const client = { rpc } as unknown as SupabaseClient<Database>;
beforeEach(() => { vi.resetAllMocks(); vi.mocked(buildQuotePdf).mockResolvedValue(new Uint8Array([37, 80, 68, 70])); rpc.mockResolvedValue({ error: null }); });
describe("quote PDF review", () => {
  it("saves the same edited quote, customer and business values used for the PDF in one call", async () => {
    const edited = { ...quotePdfReviewDefaults(quote, business), customer_scope: "Grind three stumps", quoted_price: 1610.99, first_name: "Updated", business_name: "Updated Business", pdf_terms: "Pay within 15 days", pdf_notes: "Leave mulch on site" };
    const result = await saveQuotePdfReview(client, quote, business, edited, versions);
    expect(result).toEqual(new Uint8Array([37, 80, 68, 70]));
    expect(rpc).toHaveBeenCalledTimes(1);
    const payload = rpc.mock.calls[0][1];
    expect(payload).toMatchObject({ target_business_id: 1, target_quote_id: 10, expected_quote_updated_at: versions.quote, expected_customer_updated_at: versions.customer, expected_business_updated_at: versions.business });
    const [pdfBusiness, pdfQuote] = vi.mocked(buildQuotePdf).mock.calls[0];
    expect(pdfBusiness).toMatchObject(payload.business_values);
    expect(pdfQuote).toMatchObject(payload.quote_values);
    expect(pdfQuote.customers).toEqual(payload.customer_values);
    const lines = quoteDocumentLines(pdfQuote).join("\n");
    expect(lines).toContain("Updated Smith"); expect(lines).toContain("1610.99"); expect(lines).toContain("Pay within 15 days"); expect(lines).toContain("Leave mulch on site"); expect(lines).not.toContain("PRIVATE NOTE");
  });
  it("does not save when PDF rendering fails", async () => {
    vi.mocked(buildQuotePdf).mockRejectedValue(new Error("Unsupported PDF character"));
    await expect(saveQuotePdfReview(client, quote, business, quotePdfReviewDefaults(quote, business), versions)).rejects.toThrow("Unsupported PDF character");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not return a PDF when the atomic save rejects stale or unauthorized changes", async () => {
    rpc.mockResolvedValue({ error: { message: "Reload before saving" } });
    await expect(saveQuotePdfReview(client, quote, business, quotePdfReviewDefaults(quote, business), versions)).rejects.toThrow("Reload before saving");
  });
  it.each([{ quoted_price: -1 }, { quoted_price: 0 }, { quoted_price: 1.001 }, { customer_scope: " " }, { business_name: "" }, { first_name: "", last_name: "" }, { customer_email: "invalid" }, { quote_date: "2026-02-30" }, { expiration_date: "2026-09-24" }])("rejects invalid review input %j before saving", async patch => {
    await expect(saveQuotePdfReview(client, quote, business, { ...quotePdfReviewDefaults(quote, business), ...patch }, versions)).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled(); expect(buildQuotePdf).not.toHaveBeenCalled();
  });
  it("uses zero consistently for pro bono and preserves deliberately cleared text", () => {
    const values = quotePdfReviewSchema.parse({ ...quotePdfReviewDefaults(quote, business), pro_bono: true, pdf_terms: "", pdf_notes: "" });
    const updates = quotePdfReviewUpdates(values);
    expect(updates.quote.quoted_price).toBe(0);
    const document = quoteDocumentLines({ ...quote, ...updates.quote });
    expect(document).toContain("Price: No charge");
    expect(document.join("\n")).not.toContain("To accept");
  });
});
