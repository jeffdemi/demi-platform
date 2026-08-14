import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { buildBookkeepingStatements, buildStatementReconciliation, type BookkeepingLine, type LedgerAccount } from "./domain/bookkeeping";
import { bankStatementPeriodSchema, bankTransactionAllocationSchema, bookkeepingAdjustmentSchema } from "./validation/business-records";

const account = (id: number, code: string, name: string, account_type: string, system_key: string | null, normal_balance = ["asset", "expense"].includes(account_type) ? "debit" : "credit"): LedgerAccount => ({
  id, code, name, account_type, normal_balance, system_key,
});

const cash = account(1, "1000", "Cash and bank", "asset", "cash");
const fixedAssets = account(2, "1500", "Equipment and fixed assets", "asset", "fixed_assets");
const loans = account(3, "2300", "Loans payable", "liability", "loans_payable");
const revenue = account(4, "4000", "Service revenue", "revenue", "service_revenue");
const operating = account(5, "6000", "Operating expenses", "expense", "operating_expense");
const depreciation = account(6, "6300", "Depreciation expense", "expense", "depreciation_expense");
const accumulatedDepreciation = account(7, "1590", "Accumulated depreciation", "asset", "accumulated_depreciation", "credit");

function line(journal_entry_id: number, ledger_accounts: LedgerAccount, debit: number, credit: number, bank_account_id: number | null = null): BookkeepingLine {
  return { journal_entry_id, ledger_accounts, debit, credit, bank_account_id };
}

describe("bank statement reconciliation", () => {
  it("proves imported and book activity against the statement ending balance", () => {
    const result = buildStatementReconciliation(
      { opening_balance: 1_000, closing_balance: 1_300 },
      [{ amount: 500, status: "matched" }, { amount: -200, status: "matched" }],
      [{ debit: 500, credit: 0 }, { debit: 0, credit: 200 }],
    );
    expect(result).toMatchObject({ statementActivity: 300, bookActivity: 300, statementEnding: 1_300, bookEnding: 1_300, statementDifference: 0, bookDifference: 0, pendingCount: 0 });
  });

  it("reports pending reviews and separates import differences from book differences", () => {
    const result = buildStatementReconciliation(
      { opening_balance: 100, closing_balance: 175 },
      [{ amount: 100, status: "partially_matched" }],
      [{ debit: 60, credit: 0 }],
    );
    expect(result).toMatchObject({ statementDifference: 25, bookDifference: -15, pendingCount: 1 });
  });
});

describe("ledger-based bookkeeping statements", () => {
  it("builds a balanced P&L, balance sheet, trial balance, and cash flow", () => {
    const entries = [
      { id: 1, entry_date: "2026-01-10", description: "Customer payment", source_type: "payment" },
      { id: 2, entry_date: "2026-01-11", description: "Operating expense", source_type: "expense" },
      { id: 3, entry_date: "2026-01-12", description: "Equipment purchase", source_type: "expense" },
      { id: 4, entry_date: "2026-01-13", description: "Loan proceeds", source_type: "allocation" },
      { id: 5, entry_date: "2026-01-14", description: "Bank transfer", source_type: "transfer" },
    ];
    const lines = [
      line(1, cash, 1_000, 0, 1), line(1, revenue, 0, 1_000),
      line(2, operating, 300, 0), line(2, cash, 0, 300, 1),
      line(3, fixedAssets, 200, 0), line(3, cash, 0, 200, 1),
      line(4, cash, 500, 0, 1), line(4, loans, 0, 500),
      line(5, cash, 100, 0, 2), line(5, cash, 0, 100, 1),
    ];
    const report = buildBookkeepingStatements({ entries, lines, from: "2026-01-01", to: "2026-01-31" });
    expect(report.profitLoss).toMatchObject({ revenue: 1_000, expenses: 300, netIncome: 700 });
    expect(report.balanceSheet).toMatchObject({ assets: 1_200, liabilities: 500, equity: 0, cumulativeEarnings: 700, difference: 0 });
    expect(report.cashFlow).toEqual({ operating: 700, investing: -200, financing: 500, netChange: 1_000 });
    expect(report.trialBalance).toMatchObject({ balanced: true, difference: 0 });
  });

  it("treats accumulated depreciation as a contra asset", () => {
    const report = buildBookkeepingStatements({
      entries: [{ id: 1, entry_date: "2026-01-31", description: "Depreciation", source_type: "adjustment" }],
      lines: [line(1, depreciation, 100, 0), line(1, accumulatedDepreciation, 0, 100)],
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(report.profitLoss.netIncome).toBe(-100);
    expect(report.balanceSheet).toMatchObject({ assets: -100, cumulativeEarnings: -100, difference: 0 });
  });

  it("keeps the trial balance cumulative while the P&L stays period-specific", () => {
    const report = buildBookkeepingStatements({
      entries: [
        { id: 1, entry_date: "2025-12-31", description: "Opening activity", source_type: "adjustment" },
        { id: 2, entry_date: "2026-01-15", description: "Current payment", source_type: "payment" },
      ],
      lines: [
        line(1, cash, 200, 0), line(1, revenue, 0, 200),
        line(2, cash, 300, 0), line(2, revenue, 0, 300),
      ],
      from: "2026-01-01",
      to: "2026-01-31",
    });
    expect(report.profitLoss.revenue).toBe(300);
    expect(report.trialBalance).toMatchObject({ totalDebits: 500, totalCredits: 500, balanced: true });
  });
});

describe("bookkeeping validation and migration controls", () => {
  it("validates statements, allocations, and balanced adjustments", () => {
    expect(bankStatementPeriodSchema.safeParse({ accountId: "1", statementStart: "2026-01-01", statementEnd: "2026-01-31", openingBalance: "100", closingBalance: "200" }).success).toBe(true);
    expect(bankStatementPeriodSchema.safeParse({ accountId: "1", statementStart: "2026-02-01", statementEnd: "2026-01-31", openingBalance: "100", closingBalance: "200" }).success).toBe(false);
    expect(bankTransactionAllocationSchema.safeParse({ ledgerAccountId: "2", amount: "25", memo: "Loan interest", deductiblePercent: "100" }).success).toBe(true);
    expect(bookkeepingAdjustmentSchema.safeParse({ entryDate: "2026-01-31", description: "Depreciation", debitAccountId: "6", creditAccountId: "7", amount: "100", reason: "Monthly schedule" }).success).toBe(true);
    expect(bookkeepingAdjustmentSchema.safeParse({ entryDate: "2026-01-31", description: "Bad", debitAccountId: "6", creditAccountId: "6", amount: "100", reason: "Same account" }).success).toBe(false);
  });

  it("uses additive, business-scoped controls and retains audit history", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260814143427_bookkeeping_month_end_close.sql", import.meta.url), "utf8");
    expect(migration).toContain("create table public.bank_statement_periods");
    expect(migration).toContain("create table public.bank_transaction_allocations");
    expect(migration).toContain("create table public.bank_transfer_links");
    expect(migration).toContain("create table public.bookkeeping_adjustments");
    expect(migration).toContain("private.assert_accounting_period_open");
    expect(migration).toMatch(/private\.ensure_default_ledger_accounts[\s\S]*?security invoker/);
    expect(migration).toContain("grant execute on function private.assert_accounting_period_open(bigint, date) to authenticated");
    expect(migration).toContain("grant execute on function private.ensure_default_ledger_accounts(bigint) to authenticated");
    expect(migration).toContain("security invoker");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("set status = 'void'");
    expect(migration).not.toMatch(/drop\s+table|truncate|delete\s+from/i);
  });

  it("exposes the bookkeeping routes from Finance and Reports", async () => {
    const [finance, reports, monthEnd] = await Promise.all([
      readFile(new URL("../app/(app)/finance/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/(app)/reports/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/(app)/finance/month-end/page.tsx", import.meta.url), "utf8"),
    ]);
    expect(finance).toContain("/finance/reconciliations/new");
    expect(finance).toContain("/finance/transactions/${transaction.id}");
    expect(reports).toContain("/reports/books");
    expect(monthEnd).toContain("CloseMonthForm");
    expect(monthEnd).toContain("ReopenMonthForm");
  });
});
