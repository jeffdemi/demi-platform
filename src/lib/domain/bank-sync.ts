import { createHash } from "node:crypto";
import { bankFingerprint } from "./accounting";
import type { Json } from "../../types/database";

export type BankProviderTransaction = {
  id: string;
  transactionDate: string;
  postedDate: string | null;
  description: string;
  amount: number;
  status: "posted" | "pending";
  type: string;
  currency: string;
  metadata: Json;
};

export type ExistingBankTransaction = {
  id: number;
  account_id: number;
  transaction_date: string;
  posted_date: string | null;
  description: string;
  amount: number;
  fingerprint: string;
  provider: string | null;
  provider_transaction_id: string | null;
};

export type BankSyncOutcome = "existing" | "new" | "ambiguous" | "pending";

export type BankSyncPreviewRow = {
  outcome: BankSyncOutcome;
  providerTransactionId: string;
  transactionDate: string;
  postedDate: string | null;
  description: string;
  amount: number;
  currency: string;
  fingerprint: string;
  existingTransactionId: number | null;
  candidateTransactionIds: number[];
  metadata: Json;
};

export type BankSyncSummary = Record<BankSyncOutcome, number>;

export type BankSyncAccountPreview = {
  connectionId: string;
  connectionAccountId: string;
  providerAccountId: string;
  providerInstitutionConnectionId: string;
  bankAccountId: number;
  accountName: string;
  institutionName: string;
  importName: string;
  importSha256: string;
  startDate: string;
  endDate: string;
  rows: BankSyncPreviewRow[];
  summary: BankSyncSummary;
};

export type BankSyncPreview = {
  generatedAt: string;
  accounts: BankSyncAccountPreview[];
};

function normalizedDescription(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function dayDistance(left: string, right: string) {
  return Math.abs((Date.parse(`${left}T00:00:00Z`) - Date.parse(`${right}T00:00:00Z`)) / 86_400_000);
}

function sameAmount(left: number, right: number) {
  return Math.abs(Number(left) - Number(right)) <= 0.005;
}

export function reconcileBankTransactions(
  provider: string,
  transactions: BankProviderTransaction[],
  existingTransactions: ExistingBankTransaction[],
  bankAccountId: number,
) {
  const existing = existingTransactions.filter((row) => row.account_id === bankAccountId);
  const rows: BankSyncPreviewRow[] = transactions.map((transaction) => {
    const base = {
      transactionDate: transaction.transactionDate,
      postedDate: transaction.postedDate,
      description: transaction.description,
      amount: transaction.amount,
      externalId: transaction.id,
    };
    const fingerprint = bankFingerprint(base);
    const shared = {
      providerTransactionId: transaction.id,
      transactionDate: transaction.transactionDate,
      postedDate: transaction.postedDate,
      description: transaction.description,
      amount: transaction.amount,
      currency: transaction.currency,
      fingerprint,
      metadata: transaction.metadata,
    };
    if (transaction.status === "pending") {
      return { ...shared, outcome: "pending" as const, existingTransactionId: null, candidateTransactionIds: [] };
    }

    const providerMatch = existing.find((row) => row.provider === provider && row.provider_transaction_id === transaction.id);
    if (providerMatch) {
      return { ...shared, outcome: "existing" as const, existingTransactionId: providerMatch.id, candidateTransactionIds: [providerMatch.id] };
    }
    const fingerprintMatch = existing.find((row) => row.fingerprint === fingerprint);
    if (fingerprintMatch) {
      return { ...shared, outcome: "existing" as const, existingTransactionId: fingerprintMatch.id, candidateTransactionIds: [fingerprintMatch.id] };
    }

    const description = normalizedDescription(transaction.description);
    const exactCandidates = existing.filter((row) => sameAmount(row.amount, transaction.amount)
      && (row.transaction_date === transaction.transactionDate || row.posted_date === transaction.postedDate)
      && normalizedDescription(row.description) === description);
    if (exactCandidates.length === 1) {
      return { ...shared, outcome: "existing" as const, existingTransactionId: exactCandidates[0].id, candidateTransactionIds: [exactCandidates[0].id] };
    }
    if (exactCandidates.length > 1) {
      return { ...shared, outcome: "ambiguous" as const, existingTransactionId: null, candidateTransactionIds: exactCandidates.map((row) => row.id) };
    }

    const nearbyDescriptionCandidates = existing.filter((row) => sameAmount(row.amount, transaction.amount)
      && dayDistance(row.posted_date ?? row.transaction_date, transaction.postedDate ?? transaction.transactionDate) <= 3
      && normalizedDescription(row.description) === description);
    if (nearbyDescriptionCandidates.length === 1) {
      return { ...shared, outcome: "existing" as const, existingTransactionId: nearbyDescriptionCandidates[0].id, candidateTransactionIds: [nearbyDescriptionCandidates[0].id] };
    }
    if (nearbyDescriptionCandidates.length > 1) {
      return { ...shared, outcome: "ambiguous" as const, existingTransactionId: null, candidateTransactionIds: nearbyDescriptionCandidates.map((row) => row.id) };
    }

    const sameDayAmountCandidates = existing.filter((row) => sameAmount(row.amount, transaction.amount)
      && (row.transaction_date === transaction.transactionDate || row.posted_date === transaction.postedDate));
    if (sameDayAmountCandidates.length) {
      return { ...shared, outcome: "ambiguous" as const, existingTransactionId: null, candidateTransactionIds: sameDayAmountCandidates.map((row) => row.id) };
    }
    return { ...shared, outcome: "new" as const, existingTransactionId: null, candidateTransactionIds: [] };
  });

  const summary = rows.reduce<BankSyncSummary>((counts, row) => {
    counts[row.outcome] += 1;
    return counts;
  }, { existing: 0, new: 0, ambiguous: 0, pending: 0 });
  return { rows, summary };
}

export function bankSyncImportSha256(provider: string, providerAccountId: string, rows: BankSyncPreviewRow[]) {
  return createHash("sha256").update([
    provider,
    providerAccountId,
    ...rows.filter((row) => row.outcome === "new").map((row) => row.providerTransactionId).sort(),
  ].join("|")).digest("hex");
}

export function subtractDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function addDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function simpleFinDateWindows(startDate: string, endDateExclusive: string) {
  if (Date.parse(`${startDate}T00:00:00Z`) >= Date.parse(`${endDateExclusive}T00:00:00Z`)) return [];
  const windows: { startDate: string; endDateExclusive: string }[] = [];
  let cursor = startDate;
  while (cursor < endDateExclusive) {
    const proposedEnd = addDays(cursor, 40);
    const end = proposedEnd < endDateExclusive ? proposedEnd : endDateExclusive;
    windows.push({ startDate: cursor, endDateExclusive: end });
    if (end === endDateExclusive) break;
    cursor = subtractDays(end, 5);
  }
  return windows;
}
