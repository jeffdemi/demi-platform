import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  bankSyncImportSha256,
  reconcileBankTransactions,
  simpleFinDateWindows,
  type BankProviderTransaction,
} from "./domain/bank-sync";
import {
  decodeSimpleFinSetupToken,
  simpleFinTransactions,
  validateSimpleFinAccessUrl,
  type SimpleFinAccount,
} from "./integrations/simplefin";
import { decryptBankAccessToken, encryptBankAccessToken } from "./security/bank-secrets";

function providerTransaction(overrides: Partial<BankProviderTransaction> = {}): BankProviderTransaction {
  return {
    id: "txn_1",
    transactionDate: "2026-08-17",
    postedDate: "2026-08-17",
    description: "HIS*HISCOX INC",
    amount: -37.13,
    status: "posted",
    type: "simplefin",
    currency: "USD",
    metadata: {},
    ...overrides,
  };
}

const existing = [{
  id: 12,
  account_id: 7,
  transaction_date: "2026-08-17",
  posted_date: null,
  description: "HIS*HISCOX INC",
  amount: -37.13,
  fingerprint: "a".repeat(64),
  provider: null,
  provider_transaction_id: null,
}];

describe("bank activity sync", () => {
  it("preserves SimpleFIN's Finance-compatible amount signs", () => {
    const account = {
      id: "account-1",
      conn_id: "chase-connection",
      name: "Chase Business Credit Card 1234",
      currency: "USD",
      balance: "100",
      "balance-date": 1_786_924_800,
      transactions: [{
        id: "purchase-1",
        posted: 1_786_924_800,
        amount: "-37.13",
        description: "HIS*HISCOX INC",
      }, {
        id: "deposit-1",
        posted: 1_786_924_800,
        amount: "600.00",
        description: "CUSTOMER PAYMENT",
      }],
    } satisfies SimpleFinAccount;
    expect(simpleFinTransactions(account).map((row) => row.amount)).toEqual([-37.13, 600]);
  });

  it("links one exact CSV row instead of creating a duplicate", () => {
    const result = reconcileBankTransactions("simplefin", [providerTransaction()], existing, 7);
    expect(result.summary).toEqual({ existing: 1, new: 0, ambiguous: 0, pending: 0 });
    expect(result.rows[0].existingTransactionId).toBe(12);
  });

  it("recognizes an already-linked provider id within the mapped account", () => {
    const result = reconcileBankTransactions("simplefin", [providerTransaction()], [{ ...existing[0], provider: "simplefin", provider_transaction_id: "txn_1" }], 7);
    expect(result.rows[0].outcome).toBe("existing");
  });

  it("holds uncertain same-day same-amount activity instead of importing it", () => {
    const result = reconcileBankTransactions("simplefin", [providerTransaction({ description: "UNEXPECTED TEXT" })], existing, 7);
    expect(result.rows[0].outcome).toBe("ambiguous");
    expect(result.rows[0].candidateTransactionIds).toEqual([12]);
  });

  it("keeps pending activity out and identifies genuinely new posted activity", () => {
    const result = reconcileBankTransactions("simplefin", [
      providerTransaction({ id: "txn_pending", postedDate: null, status: "pending" }),
      providerTransaction({ id: "txn_new", description: "CLOUDFLARE", amount: -10.46 }),
    ], existing, 7);
    expect(result.summary).toEqual({ existing: 0, new: 1, ambiguous: 0, pending: 1 });
  });

  it("uses provider and account ids for deterministic import hashes", () => {
    const rows = reconcileBankTransactions("simplefin", [providerTransaction({ id: "txn_new", description: "CLOUDFLARE", amount: -10.46 })], [], 7).rows;
    expect(bankSyncImportSha256("simplefin", "chase\u0000card", rows)).toBe(bankSyncImportSha256("simplefin", "chase\u0000card", rows));
    expect(bankSyncImportSha256("simplefin", "chase\u0000checking", rows)).not.toBe(bankSyncImportSha256("simplefin", "chase\u0000card", rows));
  });

  it("chunks long history into overlapping windows under SimpleFIN's 90-day limit", () => {
    const windows = simpleFinDateWindows("2026-01-01", "2026-08-18");
    expect(windows.length).toBeGreaterThan(1);
    expect(windows[0]).toEqual({ startDate: "2026-01-01", endDateExclusive: "2026-03-27" });
    expect(windows[1].startDate).toBe("2026-03-22");
    for (const window of windows) {
      const days = (Date.parse(`${window.endDateExclusive}T00:00:00Z`) - Date.parse(`${window.startDate}T00:00:00Z`)) / 86_400_000;
      expect(days).toBeLessThanOrEqual(85);
    }
  });
});

describe("SimpleFIN credential security", () => {
  it("accepts only expected HTTPS claim and access URLs", () => {
    const claim = "https://bridge.simplefin.org/simplefin/claim/one-time-code";
    const setupToken = Buffer.from(claim).toString("base64");
    expect(decodeSimpleFinSetupToken(setupToken).toString()).toBe(claim);
    expect(() => decodeSimpleFinSetupToken(Buffer.from("https://example.com/simplefin/claim/stolen").toString("base64"))).toThrow(/unexpected server/);
    expect(validateSimpleFinAccessUrl("https://user:secret@bridge.simplefin.org/simplefin").username).toBe("user");
    expect(() => validateSimpleFinAccessUrl("http://user:secret@bridge.simplefin.org/simplefin")).toThrow(/unexpected server/);
  });

  it("encrypts authenticated ciphertext and rejects tampering", () => {
    const key = randomBytes(32).toString("base64");
    const accessUrl = "https://user:secret@bridge.simplefin.org/simplefin";
    const encrypted = encryptBankAccessToken(accessUrl, key);
    expect(encrypted).not.toContain("secret");
    expect(decryptBankAccessToken(encrypted, key)).toBe(accessUrl);
    expect(() => decryptBankAccessToken(`${encrypted.slice(0, -1)}A`, key)).toThrow();
  });
});
