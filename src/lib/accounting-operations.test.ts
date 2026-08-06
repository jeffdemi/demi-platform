import { describe, expect, it } from "vitest";
import {
  buildTaxExpenseSummary,
  normalizeBankRows,
  remainingRefundAmount,
  suggestTaxCategory,
  trialBalance,
} from "./domain/accounting";

describe("bank statement normalization", () => {
  it("imports signed amount statements", () => {
    const result = normalizeBankRows([
      ["Date", "Description", "Amount", "Transaction ID"],
      ["08/05/2026", "Customer deposit", "350.00", "DEP-1"],
      ["2026-08-06", "Fuel", "(42.15)", "FUEL-1"],
    ]);
    expect(result.errors).toEqual([]);
    expect(result.rows.map((row) => row.amount)).toEqual([350, -42.15]);
    expect(result.rows[0].fingerprint).toMatch(/^[0-9a-f]{64}$/);
  });

  it("imports separate debit and credit columns", () => {
    const result = normalizeBankRows([
      ["Transaction Date", "Memo", "Debit", "Credit"],
      ["2026-08-05", "Parts", "125.20", ""],
      ["2026-08-06", "Payment", "", "500"],
    ]);
    expect(result.rows.map((row) => row.amount)).toEqual([-125.2, 500]);
  });

  it("reports malformed rows without importing them", () => {
    const result = normalizeBankRows([
      ["Date", "Description", "Amount"],
      ["not-a-date", "Fuel", "20"],
      ["2026-08-05", "", "20"],
    ]);
    expect(result.rows).toEqual([]);
    expect(result.errors).toHaveLength(2);
  });
});

describe("accounting controls", () => {
  it("does not allow active refunds beyond the source amount", () => {
    expect(remainingRefundAmount(100, [{ amount: 20 }, { amount: 15 }, { amount: 99, voided_at: "2026-08-01" }])).toBe(65);
  });

  it("suggests stable tax categories from operational text", () => {
    expect(suggestTaxCategory({ vendor: "Sheetz", description: "diesel" })).toBe("Vehicle and equipment fuel");
    expect(suggestTaxCategory({ category: "General", description: "new grinder teeth" })).toBe("Repairs and maintenance");
  });

  it("separates deductible operating costs, refunds, and assets", () => {
    const result = buildTaxExpenseSummary([
      { amount: 100, transaction_type: "expense", tax_category: "Fuel", category: "Fuel", deductible_percent: 100, voided_at: null },
      { amount: 20, transaction_type: "refund", tax_category: "Fuel", category: "Fuel", deductible_percent: 100, voided_at: null },
      { amount: 50, transaction_type: "expense", tax_category: "Phone", category: "Phone", deductible_percent: 50, voided_at: null },
      { amount: 1000, transaction_type: "asset", tax_category: null, category: "Equipment", deductible_percent: 100, voided_at: null },
    ]);
    expect(result).toMatchObject({ grossOperating: 130, deductibleOperating: 105, assetPurchases: 1000, refunds: 20 });
    expect(result.categories).toEqual([["Fuel", 80], ["Phone", 25]]);
  });

  it("detects balanced and unbalanced journals", () => {
    expect(trialBalance([{ debit: 50, credit: 0 }, { debit: 0, credit: 50 }]).balanced).toBe(true);
    expect(trialBalance([{ debit: 50, credit: 0 }, { debit: 0, credit: 49 }]).balanced).toBe(false);
  });
});
