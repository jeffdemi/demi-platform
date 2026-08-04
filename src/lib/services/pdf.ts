import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { customerDisplayName } from "../domain/customers";
import { quoteDocumentLines, type QuoteWithCustomer } from "../domain/quotes";
import type { InvoiceWithRelations } from "../repositories/invoice-repository";

type BusinessDetails = {
  name: string; legal_name: string | null; phone: string | null; email: string | null;
  address_line_1: string | null; address_line_2: string | null; city: string | null;
  region: string | null; postal_code: string | null;
};

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const lines: string[] = [];
  let current = "";
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width) current = candidate;
    else { if (current) lines.push(current); current = word; }
  }
  if (current) lines.push(current);
  return lines;
}

async function createPdf(business: BusinessDetails, title: string, lines: string[]) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  let page: PDFPage = document.addPage([612, 792]);
  let y = 735;
  const addPage = () => { page = document.addPage([612, 792]); y = 735; };
  const draw = (text: string, options: { font?: PDFFont; size?: number; gap?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 11;
    for (const wrapped of wrap(text, font, size, 500)) {
      if (y < 65) addPage();
      page.drawText(wrapped, { x: 56, y, size, font, color: options.color ?? rgb(0.12, 0.15, 0.13) });
      y -= size + 5;
    }
    y -= options.gap ?? 5;
  };
  draw(business.name || "Demi Stump Grinding", { font: bold, size: 20, color: rgb(0.09, 0.22, 0.17), gap: 3 });
  if (business.legal_name && business.legal_name !== business.name) draw(business.legal_name, { size: 9, gap: 1, color: rgb(0.4, 0.45, 0.42) });
  const contact = [business.phone, business.email].filter(Boolean).join(" | ");
  if (contact) draw(contact, { size: 9, gap: 12, color: rgb(0.4, 0.45, 0.42) });
  draw(title, { font: bold, size: 17, gap: 14 });
  for (const line of lines) draw(line, { font: line.endsWith(":") ? bold : regular, gap: 7 });
  page.drawText("Demi Stump Grinding", { x: 56, y: 32, size: 8, font: regular, color: rgb(0.45, 0.49, 0.47) });
  return document.save();
}

export function buildQuotePdf(business: BusinessDetails, quote: QuoteWithCustomer) {
  return createPdf(business, "QUOTE", quoteDocumentLines(quote));
}

export function invoiceDocumentLines(invoice: InvoiceWithRelations) {
  return [
    `Invoice ${invoice.invoice_number}`,
    `Invoice date: ${invoice.invoice_date}`,
    invoice.due_date ? `Due date: ${invoice.due_date}` : null,
    `Customer: ${customerDisplayName(invoice.customers)}`,
    invoice.jobs?.service_address ? `Service address: ${invoice.jobs.service_address}` : null,
    invoice.jobs?.work_description ? `Work completed: ${invoice.jobs.work_description}` : null,
    `Amount due: $${invoice.amount.toFixed(2)}`,
    invoice.payment_terms ? `Payment terms: ${invoice.payment_terms}` : null,
    `Status: ${invoice.status.replaceAll("_", " ")}`,
    "Thank you for your business. Please contact Jeff with any questions about this invoice.",
  ].filter((line): line is string => Boolean(line));
}

export function buildInvoicePdf(business: BusinessDetails, invoice: InvoiceWithRelations) {
  return createPdf(business, "INVOICE", invoiceDocumentLines(invoice));
}
