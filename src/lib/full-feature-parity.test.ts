import { mkdir, readFile, writeFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { QuoteWithCustomer } from "./domain/quotes";
import { customerQuoteMessage, quoteDocumentLines, quotePriceLabel, quoteStatusOptions, quoteStatusUpdate } from "./domain/quotes";
import { normalizeImportRows } from "./domain/imports";
import { buildReportSummary } from "./domain/reports";
import { buildInvoicePdf, buildQuotePdf, invoiceDocumentLines } from "./services/pdf";
import { expenseFormSchema, invoiceFormSchema, maintenanceFormSchema, quoteFormSchema } from "./validation/business-records";

const quote = {
  id: 1, business_id: 1, customer_id: 2, job_id: null, legacy_id: null, quote_number: "Q-2026-0001",
  status: "draft", quote_date: "2026-08-04", expiration_date: "2026-08-20", sent_date: null,
  response_date: null, contact_method: "text", referral_source: "Neighbor", service_address: "10 Pine Lane",
  property_location: "back_yard", location_description: "behind the shed",
  hazard_notes: "Gas line nearby", customer_scope: "grinding two maple stumps below grade", special_instructions: null, internal_notes: "Do not show this",
  normal_price: 400, quoted_price: 350, discount_reason: null, pro_bono: false, accepted_method: null,
  acceptance_notes: null, pa811_required: true, created_at: "2026-08-04T00:00:00Z", updated_at: "2026-08-04T00:00:00Z",
  customers: { customer_type: "individual", company_name: null, first_name: "Jamie", last_name: "Smith", phone: "610-555-0100", email: "jamie@example.com" },
} satisfies QuoteWithCustomer;

const business = { name: "Demi Stump Grinding", legal_name: "Demi Solutions LLC", phone: "610-555-0101", email: "jeff@example.com", address_line_1: null, address_line_2: null, city: null, region: null, postal_code: null };

describe("quote sales workflow", () => {
  it("generates a friendly plural customer message without internal or hazard notes", () => {
    const message = customerQuoteMessage(quote);
    expect(message).toContain("Hi Jamie"); expect(message).toContain("the stumps"); expect(message).toContain("$350.00");
    expect(message).toContain("10 Pine Lane"); expect(message).toContain("grinding two maple stumps below grade");
    expect(message).not.toContain(quote.internal_notes); expect(message).not.toContain(quote.hazard_notes);
  });

  it("uses friendly pro bono wording without a zero-dollar price", () => {
    const message = customerQuoteMessage({ ...quote, pro_bono: true, quoted_price: 0 });
    expect(message).toContain("at no charge"); expect(message).not.toContain("$0");
  });

  it("allows a draft price to remain pending without showing an awkward zero", () => {
    const pendingQuote = { ...quote, quoted_price: 0, pro_bono: false };
    const parsed = quoteFormSchema.safeParse({ customerId: "2", status: "draft", quoteDate: "2026-08-09", quotedPrice: "", proBono: false, pa811Required: false });
    expect(parsed.success).toBe(true);
    expect(quotePriceLabel(pendingQuote)).toBe("Price pending");
    expect(customerQuoteMessage(pendingQuote)).toContain("will follow up with a price");
    expect(customerQuoteMessage(pendingQuote)).not.toContain("$0");
    expect(quoteDocumentLines(pendingQuote)).toContain("Price: Pending estimate");
  });

  it("records status dates and keeps converted out of normal status actions", () => {
    expect(quoteStatusUpdate("sent", "2026-08-04", null)).toEqual({ status: "sent", sent_date: "2026-08-04" });
    expect(quoteStatusUpdate("accepted", "2026-08-05", null, "text")).toEqual({ status: "accepted", response_date: "2026-08-05", accepted_method: "text" });
    expect(quoteStatusOptions.some((status) => status.value === "converted")).toBe(true);
  });

  it("builds a PDF and excludes internal and hazard notes from document content", async () => {
    const lines = quoteDocumentLines(quote);
    expect(lines.join(" ")).not.toContain(quote.internal_notes); expect(lines.join(" ")).not.toContain(quote.hazard_notes);
    const bytes = await buildQuotePdf(business, quote); expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    if (process.env.PDF_OUTPUT_DIR) { await mkdir(process.env.PDF_OUTPUT_DIR, { recursive: true }); await writeFile(`${process.env.PDF_OUTPUT_DIR}/quote.pdf`, bytes); }
  });

  it("contains transactional one-time quote conversion with permanent links", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260804001500_full_feature_parity.sql", import.meta.url), "utf8");
    expect(migration).toContain("if quote_record.status <> 'accepted'");
    expect(migration).toContain("quote_record.job_id is not null");
    expect(migration).toContain("quote_id, status");
    expect(migration).toContain("status = 'converted', job_id = new_job_id");
  });

  it("uses the quote job link explicitly when loading quote details", async () => {
    const repository = await readFile(new URL("./repositories/quote-repository.ts", import.meta.url), "utf8");
    expect(repository).toContain("jobs!quotes_business_job_fkey(id, status)");
  });

  it("keeps invoice payment and its linked job in one status transaction", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260804002500_invoice_workflow_hardening.sql", import.meta.url), "utf8");
    expect(migration).toContain("function public.set_invoice_status");
    expect(migration).toContain("set status = 'paid', amount_paid = invoice_record.amount");
    expect(migration).toContain("security invoker");
  });
});

describe("billing and operating records", () => {
  it("builds an invoice PDF without internal notes", async () => {
    const invoice = { id: 4, business_id: 1, business_line_id: null, customer_id: 2, job_id: 3, legacy_id: null, invoice_number: "INV-2026-0001", amount: 350, invoice_date: "2026-08-04", due_date: "2026-08-04", payment_terms: "Due on receipt", status: "unpaid", paid_date: null, notes: "Private collection note", created_at: "2026-08-04T00:00:00Z", updated_at: "2026-08-04T00:00:00Z", customers: quote.customers, jobs: { id: 3, work_description: quote.customer_scope, service_address: quote.service_address } };
    expect(invoiceDocumentLines(invoice).join(" ")).not.toContain(invoice.notes);
    const bytes = await buildInvoicePdf(business, invoice); expect(Buffer.from(bytes).subarray(0, 4).toString()).toBe("%PDF");
    if (process.env.PDF_OUTPUT_DIR) { await mkdir(process.env.PDF_OUTPUT_DIR, { recursive: true }); await writeFile(`${process.env.PDF_OUTPUT_DIR}/invoice.pdf`, bytes); }
  });

  it("rejects invalid financial and maintenance form values", () => {
    expect(invoiceFormSchema.safeParse({ customerId: "", amount: "bad", invoiceDate: "2026-02-31", status: "unpaid" }).success).toBe(false);
    expect(expenseFormSchema.safeParse({ expenseDate: "bad", category: "", amount: "-1", transactionType: "expense" }).success).toBe(false);
    expect(maintenanceFormSchema.safeParse({ equipmentId: "", serviceDate: "bad", serviceType: "" }).success).toBe(false);
    expect(quoteFormSchema.safeParse({ customerId: "", status: "converted", quoteDate: "bad", quotedPrice: "x", proBono: false, pa811Required: false }).success).toBe(false);
  });

  it("requires a job on an invoice, because the job supplies the number suffix", () => {
    const base = { customerId: "2", amount: "350", invoiceDate: "2026-03-04", status: "unpaid" };
    expect(invoiceFormSchema.safeParse(base).success).toBe(false);
    expect(invoiceFormSchema.safeParse({ ...base, jobId: "" }).success).toBe(false);
    expect(invoiceFormSchema.safeParse({ ...base, jobId: "3" }).success).toBe(true);
  });

  it("shows directly recorded expenses in Finance until they are matched", async () => {
    const [financePage, expenseRepository] = await Promise.all([
      readFile(new URL("../app/(app)/finance/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./repositories/expense-repository.ts", import.meta.url), "utf8"),
    ]);
    expect(expenseRepository).toContain('is("bank_transaction_id", null)');
    expect(expenseRepository).toContain('is("voided_at", null)');
    expect(financePage).toContain("Recorded expenses awaiting bank match");
    expect(financePage).toContain("Expenses with no statement match required");
    expect(financePage).toContain("receipt review needed");
    expect(financePage).toContain("reviewed · receipt attached");
    expect(financePage).toContain("A receipt documents the purchase but is not a bank match.");
    expect(financePage).toContain("Review expense");
    expect(financePage).toContain("View expense");
  });

  it("shows persisted receipts when editing and resets replacements for review", async () => {
    const [form, editPage, service] = await Promise.all([
      readFile(new URL("../app/(app)/expenses/expense-form.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/(app)/expenses/[expenseId]/edit/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("./services/expenses.ts", import.meta.url), "utf8"),
    ]);
    expect(form).toContain("Receipt attached");
    expect(form).toContain("Open current receipt");
    expect(editPage).toContain("createReceiptUrl");
    expect(service).toContain('receipt_review_status: "needs_review"');
    expect(service).toContain("receipt_reviewed_at: null");
  });

  it("offers recorded refunds for matching to statement deposits", async () => {
    const [repository, actions, migration] = await Promise.all([
      readFile(new URL("./repositories/accounting-repository.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/(app)/finance/actions.ts", import.meta.url), "utf8"),
      readFile(new URL("../../supabase/migrations/20260815234608_monthly_bookkeeping_integrity_cleanup.sql", import.meta.url), "utf8"),
    ]);
    expect(repository).toContain('transaction.amount < 0 ? ["expense", "asset"] : ["refund"]');
    expect(actions).not.toContain('transaction.amount >= 0');
    expect(migration).toContain("new.transaction_type = 'refund' and bank_amount <= 0");
    expect(migration).toContain("z_expenses_tag_bank_account_journal");
  });
});

describe("spreadsheet import and reporting", () => {
  it("normalizes valid spreadsheet rows and reports invalid money", () => {
    const raw = [["Job #", "Job Date", "Customer", "Address", "Phone", "Referred By", "Description", "Amount Quoted", "Amount Paid", "Payment Method", "Status", "Paid Date", "Notes"], ["12", "2026-08-01", "Clean Peak LLC", "10 Main St", "610-555-0100", "Web", "Grind stump", "$250.00", "bad", "Check", "Paid", "", ""]];
    const preview = normalizeImportRows(raw);
    expect(preview.rows).toHaveLength(1); expect(preview.rows[0].customerName).toBe("Clean Peak LLC"); expect(preview.rows[0].status).toBe("paid"); expect(preview.rows[0].fingerprint).toMatch(/^[0-9a-f]{64}$/); expect(preview.errors[0]).toContain("Amount Paid");
  });

  it("calculates financial, pipeline, status, and monthly report values", () => {
    const report = buildReportSummary({ jobs: [{ status: "paid", job_date: "2026-08-01", amount_paid: 300, amount_quoted: 300, machine_hours: 1.5, referral_source: "Web" }], invoices: [{ status: "unpaid", amount: 100, invoice_date: "2026-08-01" }], expenses: [{ amount: 50, expense_date: "2026-08-02", category: "Fuel", transaction_type: "expense", voided_at: null }], quotes: [{ status: "accepted", quoted_price: 300, quote_date: "2026-08-01" }, { status: "declined", quoted_price: 200, quote_date: "2026-08-02" }] });
    expect(report.paidRevenue).toBe(300); expect(report.net).toBe(250); expect(report.outstandingInvoices).toBe(100); expect(report.acceptanceRate).toBe(50); expect(report.months[0].net).toBe(250);
  });
});
