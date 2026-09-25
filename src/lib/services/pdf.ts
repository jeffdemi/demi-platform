import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { customerDisplayName } from "../domain/customers";
import { quoteDocumentLines, type QuoteWithCustomer } from "../domain/quotes";
import type { InvoiceWithRelations } from "../repositories/invoice-repository";

export type BusinessDetails = {
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

// Quote text is editable, including line breaks and long reference strings.
function wrapQuoteText(text: string, font: PDFFont, size: number, width: number) {
  return text.split(/\r?\n/).flatMap(paragraph => {
    const words = paragraph.split(/\s+/).flatMap(word => {
      const pieces: string[] = [];
      let piece = "";
      for (const character of word) {
        if (piece && font.widthOfTextAtSize(piece + character, size) > width) {
          pieces.push(piece);
          piece = "";
        }
        piece += character;
      }
      if (piece) pieces.push(piece);
      return pieces;
    });
    return words.length ? wrap(words.join(" "), font, size, width) : [""];
  });
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
    for (const wrapped of wrapQuoteText(text, font, size, 500)) {
      if (y < 65) addPage();
      page.drawText(wrapped, { x: 56, y, size, font, color: options.color ?? rgb(0.12, 0.15, 0.13) });
      y -= size + 5;
    }
    y -= options.gap ?? 5;
  };
  draw(business.name || "Demi Stump Grinding", { font: bold, size: 20, color: rgb(0.09, 0.22, 0.17), gap: 3 });
  if (business.legal_name && business.legal_name !== business.name) draw(business.legal_name, { size: 9, gap: 1, color: rgb(0.4, 0.45, 0.42) });
  for (const address of businessAddressLines(business)) draw(address, { size: 9, gap: 1 });
  const contact = [business.phone, business.email].filter(Boolean).join(" | ");
  if (contact) draw(contact, { size: 9, gap: 12, color: rgb(0.4, 0.45, 0.42) });
  draw(title, { font: bold, size: 17, gap: 14 });
  for (const line of lines) draw(line, { font: line.endsWith(":") ? bold : regular, gap: 7 });
  page.drawText(business.name, { x: 56, y: 32, size: 8, font: regular, color: rgb(0.45, 0.49, 0.47) });
  return document.save();
}

export function buildQuotePdf(business: BusinessDetails, quote: QuoteWithCustomer) {
  return createPdf(business, "QUOTE", quoteDocumentLines(quote));
}

// Customer-safe summary of the invoice, kept independent of the visual layout below so it stays
// easy to assert against (e.g. that it never contains the private `notes` field).
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

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 50;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

const ink = rgb(0.13, 0.16, 0.14);
const muted = rgb(0.45, 0.49, 0.47);
const brand = rgb(0.09, 0.22, 0.17);
const brandSoft = rgb(0.92, 0.96, 0.94);
const lineColor = rgb(0.82, 0.86, 0.83);

function formatMoney(value: number) {
  return value.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatDisplayDate(value: string | null | undefined) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
}

function businessAddressLines(business: BusinessDetails) {
  const cityLine = [business.city, [business.region, business.postal_code].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [business.address_line_1, business.address_line_2, cityLine || null].filter((line): line is string => Boolean(line));
}

export async function buildInvoicePdf(business: BusinessDetails, invoice: InvoiceWithRelations) {
  const document = await PDFDocument.create();
  const regular = await document.embedFont(StandardFonts.Helvetica);
  const bold = await document.embedFont(StandardFonts.HelveticaBold);
  const page = document.addPage([PAGE_WIDTH, PAGE_HEIGHT]);

  const text = (value: string, x: number, y: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    page.drawText(value, { x, y, size: options.size ?? 10, font: options.font ?? regular, color: options.color ?? ink });
  };
  const textRight = (value: string, xRight: number, y: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    text(value, xRight - font.widthOfTextAtSize(value, size), y, options);
  };
  const textCenter = (value: string, xCenter: number, y: number, options: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
    const font = options.font ?? regular;
    const size = options.size ?? 10;
    text(value, xCenter - font.widthOfTextAtSize(value, size) / 2, y, options);
  };
  const hr = (x: number, y: number, width: number, options: { color?: ReturnType<typeof rgb>; thickness?: number } = {}) => {
    page.drawLine({ start: { x, y }, end: { x: x + width, y }, thickness: options.thickness ?? 1, color: options.color ?? lineColor });
  };
  const fill = (x: number, y: number, width: number, height: number, color: ReturnType<typeof rgb>) => {
    page.drawRectangle({ x, y, width, height, color });
  };

  // Header: business identity (left) and INVOICE title with key dates (right).
  let leftY = 730;
  text(business.name || "Demi Stump Grinding", MARGIN, leftY, { font: bold, size: 18, color: brand });
  leftY -= 16;
  if (business.legal_name && business.legal_name !== business.name) { text(business.legal_name, MARGIN, leftY, { size: 9, color: muted }); leftY -= 13; }
  for (const line of businessAddressLines(business)) { text(line, MARGIN, leftY, { size: 9, color: muted }); leftY -= 13; }
  const contact = [business.phone, business.email].filter(Boolean).join("  •  ");
  if (contact) { text(contact, MARGIN, leftY, { size: 9, color: muted }); leftY -= 13; }

  let rightY = 730;
  textRight("INVOICE", CONTENT_RIGHT, rightY, { font: bold, size: 22, color: brand });
  rightY -= 22;
  const metaRow = (label: string, value: string) => {
    text(label, CONTENT_RIGHT - 170, rightY, { size: 9, color: muted });
    textRight(value, CONTENT_RIGHT, rightY, { size: 9, font: bold, color: ink });
    rightY -= 14;
  };
  if (invoice.status === "draft" || invoice.status === "void") {
    textRight(invoice.status.toUpperCase(), CONTENT_RIGHT, rightY, { font: bold, size: 11, color: rgb(0.72, 0.24, 0.18) });
    rightY -= 16;
  }
  metaRow("Invoice #", invoice.invoice_number);
  metaRow("Invoice date", formatDisplayDate(invoice.invoice_date) ?? "—");
  if (invoice.due_date) metaRow("Due date", formatDisplayDate(invoice.due_date) ?? "—");
  if (invoice.payment_terms) metaRow("Terms", invoice.payment_terms);

  const headerBottom = Math.min(leftY, rightY) - 8;
  hr(MARGIN, headerBottom, CONTENT_WIDTH, { color: brand, thickness: 2 });

  // Bill To / Service location
  let blockY = headerBottom - 24;
  const columnWidth = CONTENT_WIDTH / 2 - 12;
  text("BILL TO", MARGIN, blockY, { font: bold, size: 8, color: muted });
  const hasServiceInfo = Boolean(invoice.jobs?.service_address);
  if (hasServiceInfo) text("SERVICE LOCATION", MARGIN + columnWidth + 24, blockY, { font: bold, size: 8, color: muted });
  blockY -= 16;

  let billY = blockY;
  text(customerDisplayName(invoice.customers), MARGIN, billY, { font: bold, size: 11, color: ink });
  billY -= 14;
  const customerContact = [invoice.customers.phone, invoice.customers.email].filter(Boolean);
  for (const line of customerContact) { text(line as string, MARGIN, billY, { size: 9, color: muted }); billY -= 13; }

  let serviceY = blockY;
  if (hasServiceInfo && invoice.jobs?.service_address) {
    const serviceX = MARGIN + columnWidth + 24;
    for (const wrapped of wrap(invoice.jobs.service_address, regular, 9, columnWidth)) { text(wrapped, serviceX, serviceY, { size: 9, color: ink }); serviceY -= 13; }
  }

  // Line items table
  let tableY = Math.min(billY, serviceY) - 20;
  const tableHeaderHeight = 20;
  fill(MARGIN, tableY - tableHeaderHeight + 6, CONTENT_WIDTH, tableHeaderHeight, brandSoft);
  text("DESCRIPTION", MARGIN + 10, tableY - 8, { font: bold, size: 8, color: brand });
  textRight("AMOUNT", CONTENT_RIGHT - 10, tableY - 8, { font: bold, size: 8, color: brand });
  tableY -= tableHeaderHeight + 10;

  const description = invoice.jobs?.work_description || "Stump grinding services";
  const descriptionLines = wrap(description, regular, 10, CONTENT_WIDTH - 140);
  for (const [index, wrapped] of descriptionLines.entries()) {
    text(wrapped, MARGIN + 10, tableY, { size: 10 });
    if (index === 0) textRight(formatMoney(invoice.amount), CONTENT_RIGHT - 10, tableY, { size: 10, font: bold });
    tableY -= 14;
  }
  tableY -= 4;
  hr(MARGIN, tableY, CONTENT_WIDTH, { color: lineColor });
  tableY -= 20;

  // Totals box, right-aligned
  const isPaid = invoice.status === "paid";
  const isVoid = invoice.status === "void";
  const balanceDue = isPaid || isVoid ? 0 : invoice.amount;
  text("Subtotal", CONTENT_RIGHT - 170, tableY, { size: 9, color: muted });
  textRight(formatMoney(invoice.amount), CONTENT_RIGHT, tableY, { size: 9 });
  tableY -= 15;
  if (isPaid) {
    text(invoice.paid_date ? `Paid on ${formatDisplayDate(invoice.paid_date)}` : "Paid", CONTENT_RIGHT - 170, tableY, { size: 9, color: muted });
    textRight(`-${formatMoney(invoice.amount)}`, CONTENT_RIGHT, tableY, { size: 9 });
    tableY -= 15;
  }
  tableY -= 4;
  fill(CONTENT_RIGHT - 190, tableY - 8, 190, 26, brandSoft);
  text("BALANCE DUE", CONTENT_RIGHT - 180, tableY, { font: bold, size: 10, color: brand });
  textRight(formatMoney(balanceDue), CONTENT_RIGHT - 10, tableY, { font: bold, size: 12, color: brand });
  tableY -= 40;

  if (isVoid) { text("This invoice has been voided and is not payable.", MARGIN, tableY, { size: 9, color: rgb(0.72, 0.24, 0.18) }); tableY -= 14; }

  // Footer
  const footerCenter = PAGE_WIDTH / 2;
  hr(MARGIN, 78, CONTENT_WIDTH, { color: lineColor });
  textCenter("Thank you for your business!", footerCenter, 60, { font: bold, size: 10, color: brand });
  const footerContact = [business.name || "Demi Stump Grinding", business.phone, business.email].filter(Boolean).join("  •  ");
  textCenter(footerContact, footerCenter, 44, { size: 8, color: muted });

  return document.save();
}
