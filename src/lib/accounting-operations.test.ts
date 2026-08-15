import { describe, expect, it } from "vitest";
import {
  buildTaxExpenseSummary,
  findClassificationSuggestions,
  findUniqueExpenseMatches,
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

  it("imports Bank of America credit-card CSV exports", () => {
    const result = normalizeBankRows([
      ["Posted Date", "Reference Number", "Payee", "Address", "Amount"],
      ["04/27/2026", "24692166117401642014015", "AMAZON MKTPL*BJ3X597T2 Amzn.com/billWA", "Amzn.com/bill WA", "-46.99"],
      ["04/27/2026", "11620401050071198040559", "PAYMENT FROM CHK 8010 CONF#11z5luefa", "", "1027.56"],
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(2);
    expect(result.rows[0]).toMatchObject({
      transactionDate: "2026-04-27",
      postedDate: "2026-04-27",
      description: "AMAZON MKTPL*BJ3X597T2 Amzn.com/billWA",
      amount: -46.99,
      externalId: "24692166117401642014015",
    });
    expect(result.rows[1].amount).toBe(1027.56);
  });

  it("imports Bank of America business-card exports with summaries and debit-credit types", () => {
    const result = normalizeBankRows([
      ["Description", "", "", "", "Summary Amt."],
      ["Total credits", "", "", "", "-8267.74"],
      ["Total debits", "", "", "", "10330.96"],
      [],
      ["CardHolder Name", "Account/Card Number - last 4 digits", "Posting Date", "Trans. Date", "Reference ID", "Description", "Amount", "MCC", "Merchant Category", "Transaction Type", "Expense Category"],
      ["JEFFREY R DEMI", "6631", "05/11/2026", "05/07/2026", "Ref: 85180896128980175340292", "BRANDYWINE AUTO - WEST", "8.62", "5533", "AUTOMOTIVE PARTS", "D", "Automobiles and Vehicles"],
      ["JEFFREY R DEMI", "6631", "04/24/2026", "04/23/2026", "Ref: 55500366113726167000635", "ROCK AUTO", "-79.24", "5533", "AUTOMOTIVE PARTS", "C", "Automobiles and Vehicles"],
      ["DEMI SOLUTIONS LLC", "3472", "04/10/2026", "04/10/2026", "Ref: 10020405720072821644899", "PAYMENT ADJUSTMENT", "7000.00", "0000", "", "D", ""],
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      rowNumber: 6,
      transactionDate: "2026-05-07",
      postedDate: "2026-05-11",
      externalId: "Ref: 85180896128980175340292",
      amount: -8.62,
    });
    expect(result.rows[1].amount).toBe(79.24);
    expect(result.rows[2].amount).toBe(-7000);
  });

  it("imports Venmo statements and separates processing fees", () => {
    const result = normalizeBankRows([
      ["Transaction ID", "Date", "Time (UTC)", "Type", "Status", "Note", "From", "To", "Amount (total)", "Amount (tip)", "Amount (tax)", "Amount (net)", "Amount (fee)", "Tax Rate", "Tax Exempt", "Funding Source", "Destination"],
      ['"4592582617279448916"', "05/08/2026", "13:21:51", "Payment", "Complete", "💸 to Demi Solutions LLC", "Marsha Uchimoto", "Demi Stump Grinding", "+ $160.00", "0", "0", "$156.86", "$3.14", "0", "FALSE", "(None)", "Venmo balance"],
      ['"4593420530100031073"', "05/09/2026", "17:06:38", "Standard Transfer", "Issued", "(None)", "(None)", "(None)", "- $150.00", "0", "", "", "0", "", "", "(None)", "BANK OF AMERICA N.A. *8010"],
      ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      ["Account Statement - (@demistumpgrinding)", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ]);

    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows.map((row) => row.amount)).toEqual([160, -3.14, -150]);
    expect(result.rows.map((row) => row.externalId)).toEqual([
      "4592582617279448916:total",
      "4592582617279448916:fee",
      "4593420530100031073:total",
    ]);
    expect(result.rows[0].description).toContain("Marsha Uchimoto → Demi Stump Grinding");
    expect(result.rows[1].description).toContain("Venmo fee");
    expect(result.rows[2].description).not.toContain("(None)");
    expect(result.rows.reduce((total, row) => total + row.amount, 0)).toBeCloseTo(6.86);
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

describe("bulk expense matching", () => {
  it("suggests learned merchant classifications and prefers the most specific rule", () => {
    const suggestions = findClassificationSuggestions(
      [{ id: 1, description: "HIS*HISCOX INC POLICY" }, { id: 2, description: "WAWA 8068" }],
      [{ id: 10, match_text: "hiscox" }, { id: 11, match_text: "hiscox inc" }],
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0].rule.id).toBe(11);
  });
  it("returns only unique exact-amount matches within ten days", () => {
    const matches = findUniqueExpenseMatches(
      [
        { id: 1, transaction_date: "2026-04-16", description: "WAWA", amount: -36.23 },
        { id: 2, transaction_date: "2026-05-01", description: "AMBIGUOUS", amount: -20 },
        { id: 3, transaction_date: "2026-06-01", description: "TOO LATE", amount: -50 },
      ],
      [
        { id: 10, expense_date: "2026-04-16", vendor: "Gas station", description: "Fuel", category: "Fuel", amount: 36.23 },
        { id: 11, expense_date: "2026-05-01", vendor: "One", description: null, category: "Other", amount: 20 },
        { id: 12, expense_date: "2026-05-02", vendor: "Two", description: null, category: "Other", amount: 20 },
        { id: 13, expense_date: "2026-06-20", vendor: "Late", description: null, category: "Other", amount: 50 },
      ],
    );
    expect(matches).toEqual([{
      transactionId: 1, transactionDate: "2026-04-16", transactionDescription: "WAWA",
      expenseId: 10, expenseDate: "2026-04-16", expenseLabel: "Gas station", amount: 36.23,
    }]);
  });

  it("rejects one expense that could match multiple transactions", () => {
    expect(findUniqueExpenseMatches(
      [
        { id: 1, transaction_date: "2026-04-16", description: "FIRST", amount: -10 },
        { id: 2, transaction_date: "2026-04-17", description: "SECOND", amount: -10 },
      ],
      [{ id: 10, expense_date: "2026-04-16", vendor: "Vendor", description: null, category: "Other", amount: 10 }],
    )).toEqual([]);
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
