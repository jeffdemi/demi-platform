import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { calculateFifoPortfolio, normalizeDigitalAssetRows } from "./domain/digital-assets";
import { buildBookkeepingStatements, type BookkeepingEntry, type BookkeepingLine } from "./domain/bookkeeping";

describe("digital asset imports and FIFO basis", () => {
  it("normalizes exchange aliases and produces stable fingerprints", () => {
    const input = [["Timestamp", "Type", "Coin", "Quantity", "Price USD", "Fee USD", "Transaction ID"], ["2025-01-01T12:00:00Z", "purchase", "btc", "0.1", "40000", "10", "buy-1"]];
    const first = normalizeDigitalAssetRows(input);
    const second = normalizeDigitalAssetRows(input);
    expect(first.errors).toEqual([]);
    expect(first.rows[0]).toMatchObject({ transactionType: "buy", assetSymbol: "BTC", units: 0.1, grossAmountUsd: 4000, feeUsd: 10 });
    expect(first.rows[0].fingerprint).toBe(second.rows[0].fingerprint);
  });

  it("normalizes Coinbase exports with metadata rows and signed values", () => {
    const input = [
      ["Transactions"],
      ["User", "Jeffery Demi", "account-id"],
      ["ID", "Timestamp", "Transaction Type", "Asset", "Quantity Transacted", "Price Currency", "Price at Transaction", "Subtotal", "Total (inclusive of fees and/or spread)", "Fees and/or Spread", "Notes"],
      ["sale-id", "2026-04-09 14:22:51 UTC", "Sell", "BTC", "-0.08121005", "USD", "$70635.975", "$5678.34", "$5571.87", "-$57.36", "Sold BTC"],
      ["reward-id", "2026-04-09 15:20:39 UTC", "Reward Income", "USDC", "0.017104", "USD", "$1.00", "$0.01710", "$0.01710", "$0.00", "Coinbase reward"],
      ["withdrawal-id", "2026-04-09 14:26:50 UTC", "Withdrawal", "USD", "-7068.99", "USD", "$1.00", "$7068.99", "$6945.28", "-$123.71", "Withdrawal to bank"],
    ];
    const result = normalizeDigitalAssetRows(input);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({ transactionType: "sell", assetSymbol: "BTC", units: 0.08121005, grossAmountUsd: 5629.23, feeUsd: 57.36, externalId: "sale-id" });
    expect(result.rows[0].grossAmountUsd - result.rows[0].feeUsd).toBeCloseTo(5571.87, 2);
    expect(result.rows[1]).toMatchObject({ transactionType: "reward", assetSymbol: "USDC", units: 0.017104, grossAmountUsd: 0.0171, feeUsd: 0 });
    expect(result.rows[2]).toMatchObject({ transactionType: "transfer_out", assetSymbol: "USD", units: 7068.99, grossAmountUsd: 6945.28, feeUsd: 123.71 });
  });

  it("calculates FIFO cost basis and does not realize matched internal transfers", () => {
    const base = { rowNumber: 0, unitPriceUsd: null, externalId: null, memo: null, fingerprint: "a".repeat(64) };
    const portfolio = calculateFifoPortfolio([
      { ...base, id: 1, occurredAt: "2025-01-01T00:00:00Z", transactionType: "buy", assetSymbol: "BTC", units: 1, grossAmountUsd: 20000, feeUsd: 100, transferReference: null },
      { ...base, id: 2, occurredAt: "2025-02-01T00:00:00Z", transactionType: "buy", assetSymbol: "BTC", units: 1, grossAmountUsd: 30000, feeUsd: 100, transferReference: null },
      { ...base, id: 3, occurredAt: "2025-03-01T00:00:00Z", transactionType: "transfer_out", assetSymbol: "BTC", units: 2, grossAmountUsd: 0, feeUsd: 0, transferReference: "internal-1" },
      { ...base, id: 4, occurredAt: "2025-03-01T00:01:00Z", transactionType: "transfer_in", assetSymbol: "BTC", units: 2, grossAmountUsd: 0, feeUsd: 0, transferReference: "internal-1" },
      { ...base, id: 5, occurredAt: "2025-04-01T00:00:00Z", transactionType: "sell", assetSymbol: "BTC", units: 1.5, grossAmountUsd: 60000, feeUsd: 100, transferReference: null },
    ]);
    expect(portfolio.disposals).toHaveLength(1);
    expect(portfolio.disposals[0].costBasis).toBe(35150);
    expect(portfolio.disposals[0].gainLoss).toBe(24750);
    expect(portfolio.holdings[0]).toMatchObject({ assetSymbol: "BTC", units: 0.5, costBasis: 15050 });
  });
});

describe("business-line accounting release", () => {
  it("filters segment P&L while retaining a consolidated report", () => {
    const account = (id: number, account_type: string, system_key: string) => ({ id, code: String(id), name: system_key, account_type, normal_balance: account_type === "revenue" ? "credit" : "debit", system_key });
    const entries: BookkeepingEntry[] = [
      { id: 1, business_line_id: 10, entry_date: "2026-01-01", description: "IT", source_type: "payment" },
      { id: 2, business_line_id: 20, entry_date: "2026-01-02", description: "Stump", source_type: "payment" },
    ];
    const lines: BookkeepingLine[] = [
      { journal_entry_id: 1, debit: 1000, credit: 0, ledger_accounts: account(1, "asset", "cash") },
      { journal_entry_id: 1, debit: 0, credit: 1000, ledger_accounts: account(2, "revenue", "service_revenue") },
      { journal_entry_id: 2, debit: 500, credit: 0, ledger_accounts: account(1, "asset", "cash") },
      { journal_entry_id: 2, debit: 0, credit: 500, ledger_accounts: account(2, "revenue", "service_revenue") },
    ];
    const consolidated = buildBookkeepingStatements({ entries, lines, from: "2026-01-01", to: "2026-12-31" });
    const it = buildBookkeepingStatements({ entries, lines, from: "2026-01-01", to: "2026-12-31", businessLineId: 10 });
    expect(consolidated.profitLoss.revenue).toBe(1500);
    expect(it.profitLoss.revenue).toBe(1000);
  });

  it("uses additive RLS tables, explicit grants, idempotency, and no production mutation commands", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260814191531_digital_assets_business_lines.sql", import.meta.url), "utf8");
    for (const table of ["business_lines", "digital_asset_accounts", "digital_asset_imports", "digital_asset_transactions", "digital_asset_lots", "digital_asset_disposals", "capital_transactions", "bookkeeping_cleanup_items"]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }
    expect(migration).toContain("unique (business_id, account_id, source_sha256)");
    expect(migration).toContain("on conflict (business_id, account_id, fingerprint) do nothing");
    expect(migration).toContain("grant select, insert, update on public.digital_asset_accounts");
    expect(migration).toContain("security invoker");
    expect(migration).not.toMatch(/drop\s+table|truncate|delete\s+from/i);
  });
});
