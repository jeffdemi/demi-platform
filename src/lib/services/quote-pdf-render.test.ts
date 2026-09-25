import { describe, expect, it } from "vitest";
import { PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream } from "pdf-lib";
import { buildQuotePdf } from "./pdf";
import type { QuoteWithCustomer } from "../domain/quotes";

const business = { name: "Edited Business", legal_name: "Edited Legal LLC", phone: "555-0123", email: "edited@example.com", address_line_1: "12 Edited Street", address_line_2: null, city: "Town", region: "PA", postal_code: "19301" };
const quote = { quote_number: "Q-EDITED", quote_date: "2026-09-25", quoted_price: 425.99, pro_bono: false, customer_scope: "Edited scope", pdf_terms: "First instruction\nSecond instruction", pdf_notes: "Customer-facing note", internal_notes: "NEVER PRINT PRIVATE NOTES", customers: { customer_type: "individual", first_name: "Edited", last_name: "Customer", company_name: null, phone: "555-9999", email: "customer@example.com" } } as QuoteWithCustomer;
async function pdfText(bytes: Uint8Array) {
  const document = await PDFDocument.load(bytes);
  const pages = document.getPages().map(page => {
    const contents = page.node.Contents() as PDFArray;
    let streamText = "";
    for (let i = 0; i < contents.size(); i++) {
      const stream = document.context.lookup(contents.get(i));
      if (!(stream instanceof PDFRawStream)) throw new Error("Expected a PDF content stream");
      streamText += Buffer.from(decodePDFRawStream(stream).decode()).toString();
    }
    return [...streamText.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)].map(match => Buffer.from(match[1], "hex").toString("latin1")).join("\n");
  });
  return pages;
}
describe("reviewed quote PDF rendering", () => {
  it("prints edited shared details and customer-facing content without private notes or old branding", async () => {
    const text = (await pdfText(await buildQuotePdf(business, quote))).join("\n");
    for (const value of ["Edited Business", "Edited Legal LLC", "12 Edited Street", "edited@example.com", "Edited Customer", "customer@example.com", "555-9999", "425.99", "First instruction\nSecond instruction", "Customer-facing note"]) expect(text).toContain(value);
    expect(text).not.toContain("NEVER PRINT PRIVATE NOTES");
    expect(text).not.toContain("Demi Stump Grinding");
  });
  it("paginates long editable terms without losing the ending", async () => {
    const pages = await pdfText(await buildQuotePdf(business, { ...quote, pdf_terms: Array.from({ length: 100 }, (_, i) => `Instruction ${i + 1}`).join("\n") }));
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join("\n")).toContain("Instruction 100");
  });
});
