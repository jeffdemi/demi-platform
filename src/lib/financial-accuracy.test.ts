import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { cashOutflowImpact, operatingExpenseImpact } from "./domain/finance";
import { buildReportSummary } from "./domain/reports";
import { expenseFormSchema, recordRemovalSchema, voidExpenseSchema } from "./validation/business-records";

describe("expense financial treatment", () => {
  it("separates operating expense, assets, refunds, and archived records", () => {
    expect(operatingExpenseImpact({ amount: 100, transaction_type: "expense" })).toBe(100);
    expect(operatingExpenseImpact({ amount: 100, transaction_type: "asset" })).toBe(0);
    expect(operatingExpenseImpact({ amount: 25, transaction_type: "refund" })).toBe(-25);
    expect(operatingExpenseImpact({ amount: 100, transaction_type: "expense", voided_at: "2026-08-05" })).toBe(0);
    expect(cashOutflowImpact({ amount: 100, transaction_type: "asset" })).toBe(100);
    expect(cashOutflowImpact({ amount: 25, transaction_type: "refund" })).toBe(-25);
  });

  it("calculates operating profit and cash position independently", () => {
    const report = buildReportSummary({
      jobs: [{ status: "paid", job_date: "2026-08-01", amount_paid: 1000, amount_quoted: 1000, machine_hours: 2, referral_source: "Web" }],
      invoices: [],
      quotes: [],
      expenses: [
        { amount: 200, expense_date: "2026-08-02", category: "Fuel", transaction_type: "expense", voided_at: null },
        { amount: 50, expense_date: "2026-08-03", category: "Fuel", transaction_type: "refund", voided_at: null },
        { amount: 300, expense_date: "2026-08-04", category: "Tools", transaction_type: "asset", voided_at: null },
        { amount: 100, expense_date: "2026-08-05", category: "Other", transaction_type: "expense", voided_at: "2026-08-05" },
      ],
    });
    expect(report.operatingExpenses).toBe(150);
    expect(report.assetPurchases).toBe(300);
    expect(report.refunds).toBe(50);
    expect(report.cashOutflow).toBe(450);
    expect(report.net).toBe(850);
    expect(report.cashNet).toBe(550);
    expect(report.categories).toEqual([["Fuel", 150]]);
    expect(report.months[0]).toMatchObject({ operatingExpenses: 150, assetPurchases: 300, refunds: 50, net: 850, cashNet: 550 });
  });

  it("requires refunds to reference an original record", () => {
    const base = { expenseDate: "2026-08-05", category: "Fuel", amount: "25", transactionType: "refund" };
    expect(expenseFormSchema.safeParse(base).success).toBe(false);
    expect(expenseFormSchema.safeParse({ ...base, refundOfExpenseId: "12" }).success).toBe(true);
    expect(expenseFormSchema.safeParse({ ...base, transactionType: "expense", refundOfExpenseId: "12" }).success).toBe(false);
  });

  it("requires explicit confirmation and a reason before archiving", () => {
    expect(voidExpenseSchema.safeParse({ reason: "Duplicate entry", confirm: "yes" }).success).toBe(true);
    expect(voidExpenseSchema.safeParse({ reason: "", confirm: "yes" }).success).toBe(false);
    expect(voidExpenseSchema.safeParse({ reason: "Duplicate entry", confirm: null }).success).toBe(false);
  });

  it("validates shared archive, restore, and permanent-delete requests", () => {
    expect(recordRemovalSchema.safeParse({ intent: "archive", reason: "Entered twice", confirm: "yes" }).success).toBe(true);
    expect(recordRemovalSchema.safeParse({ intent: "delete", reason: "Unused draft", confirm: "yes" }).success).toBe(true);
    expect(recordRemovalSchema.safeParse({ intent: "archive", reason: "", confirm: "yes" }).success).toBe(false);
    expect(recordRemovalSchema.safeParse({ intent: "restore" }).success).toBe(true);
    expect(recordRemovalSchema.safeParse({ intent: "force_delete", reason: "Duplicate test data", confirm: "yes", overrideConfirmation: "DELETE" }).success).toBe(true);
    expect(recordRemovalSchema.safeParse({ intent: "force_delete", reason: "Duplicate test data", confirm: "yes", overrideConfirmation: "delete" }).success).toBe(false);
  });

  it("adds consistent archive metadata without changing existing records", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260815083422_consistent_record_archiving.sql", import.meta.url), "utf8");
    expect(migration).toContain("alter table public.jobs");
    expect(migration).toContain("alter table public.quotes");
    expect(migration).toContain("alter table public.invoices");
    expect(migration).toContain("archive_reason_check");
    expect(migration).not.toMatch(/delete\s+from|drop\s+table|truncate/i);
  });

  it("uses an additive migration with targeted backfills and private receipt storage", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260806015833_financial_accuracy.sql", import.meta.url), "utf8");
    expect(migration).toContain("add column transaction_type");
    expect(migration).toContain("add column voided_at");
    expect(migration).toContain("source type: asset");
    expect(migration).toContain("original amount: 79.24");
    expect(migration).toContain("'expense-receipts'");
    expect(migration).toContain("private.is_business_member");
    expect(migration).not.toMatch(/delete\s+from\s+public\.expenses/i);
  });
});
