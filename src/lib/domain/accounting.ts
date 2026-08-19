import { createHash } from "node:crypto";

export type BankImportRow = {
  rowNumber: number;
  transactionDate: string;
  postedDate: string | null;
  description: string;
  amount: number;
  externalId: string | null;
  fingerprint: string;
};

export type TaxExpense = {
  amount: number;
  transaction_type: string;
  tax_category: string | null;
  category: string;
  deductible_percent: number;
  voided_at: string | null;
};

const headerAliases = {
  date: ["date", "transaction date", "trans date", "trans. date", "posted date"],
  postedDate: ["posted date", "posting date"],
  description: ["description", "memo", "name", "details", "merchant", "payee"],
  amount: ["amount", "transaction amount"],
  debit: ["debit", "withdrawal", "money out"],
  credit: ["credit", "deposit", "money in"],
  externalId: ["transaction id", "id", "reference", "reference id", "reference number", "check number"],
  transactionType: ["transaction type"],
} as const;

function cleaned(value: unknown) {
  return String(value ?? "").trim();
}

function money(value: unknown) {
  const raw = cleaned(value).replaceAll("$", "").replaceAll(",", "").replace(/\s+/g, "").replace(/^\((.*)\)$/, "-$1");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : Number.NaN;
}

function isoDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const raw = cleaned(value);
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (!us) return null;
  const year = Number(us[3]) < 100 ? 2000 + Number(us[3]) : Number(us[3]);
  const month = Number(us[1]);
  const day = Number(us[2]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function position(headers: string[], aliases: readonly string[]) {
  const normalized = headers.map((header) => header.toLowerCase().replaceAll("_", " ").trim());
  const index = normalized.findIndex((header) => aliases.includes(header));
  return index >= 0 ? index : null;
}

export function bankFingerprint(row: Omit<BankImportRow, "fingerprint" | "rowNumber">) {
  return createHash("sha256").update([
    row.transactionDate,
    row.postedDate ?? "",
    row.description.toLowerCase(),
    row.amount.toFixed(2),
    row.externalId ?? "",
  ].join("|")).digest("hex");
}

function normalizeVenmoRows(rawRows: unknown[][], headerIndex: number) {
  const headers = rawRows[headerIndex].map((value) => cleaned(value).toLowerCase());
  const column = (name: string) => headers.indexOf(name.toLowerCase());
  const transactionIdIndex = column("Transaction ID");
  const dateIndex = column("Date");
  const typeIndex = column("Type");
  const statusIndex = column("Status");
  const noteIndex = column("Note");
  const fromIndex = column("From");
  const toIndex = column("To");
  const totalIndex = column("Amount (total)");
  const feeIndex = column("Amount (fee)");
  const fundingIndex = column("Funding Source");
  const destinationIndex = column("Destination");
  const errors: string[] = [];
  const rows: BankImportRow[] = [];
  const failedStatuses = new Set(["failed", "canceled", "cancelled", "declined", "reversed"]);
  rawRows.slice(headerIndex + 1).forEach((raw, index) => {
    const rawId = cleaned(raw[transactionIdIndex]).replace(/^"+|"+$/g, "");
    if (!/^\d+$/.test(rawId)) return;
    const rowNumber = headerIndex + index + 2;
    const transactionDate = isoDate(raw[dateIndex]);
    const status = cleaned(raw[statusIndex]);
    if (failedStatuses.has(status.toLowerCase())) return;
    const signedAmount = money(raw[totalIndex]);
    const fee = money(raw[feeIndex]);
    const present = (value: unknown) => cleaned(value) === "(None)" ? "" : cleaned(value);
    const from = present(raw[fromIndex]);
    const to = present(raw[toIndex]);
    const parts = [present(raw[typeIndex]), present(raw[noteIndex]), from && to ? `${from} → ${to}` : from || to, present(raw[fundingIndex]), present(raw[destinationIndex])].filter(Boolean);
    const description = parts.join(" · ") || "Venmo transaction";
    if (!transactionDate) errors.push(`Row ${rowNumber}: Date is invalid.`);
    if (signedAmount === null || Number.isNaN(signedAmount) || signedAmount === 0) errors.push(`Row ${rowNumber}: Amount (total) must be a non-zero number.`);
    if (!transactionDate || signedAmount === null || Number.isNaN(signedAmount) || signedAmount === 0) return;
    const base = { transactionDate, postedDate: null, description, amount: signedAmount, externalId: `${rawId}:total` };
    rows.push({ rowNumber, ...base, fingerprint: bankFingerprint(base) });
    if (fee !== null && !Number.isNaN(fee) && Math.abs(fee) > 0) {
      const feeBase = { transactionDate, postedDate: null, description: `Venmo fee · ${description}`, amount: -Math.abs(fee), externalId: `${rawId}:fee` };
      rows.push({ rowNumber, ...feeBase, fingerprint: bankFingerprint(feeBase) });
    }
  });
  return { rows, errors };
}

export function normalizeBankRows(rawRows: unknown[][]) {
  if (!rawRows.length) return { rows: [] as BankImportRow[], errors: ["The statement is empty."] };
  const venmoHeaderIndex = rawRows.findIndex((candidate) => {
    const headers = candidate.map((value) => cleaned(value).toLowerCase());
    return headers.includes("transaction id") && headers.includes("amount (total)") && headers.includes("amount (fee)") && headers.includes("status");
  });
  if (venmoHeaderIndex >= 0) return normalizeVenmoRows(rawRows, venmoHeaderIndex);
  const headerIndex = rawRows.findIndex((candidate) => {
    const candidateHeaders = candidate.map(cleaned);
    return position(candidateHeaders, headerAliases.date) !== null
      && position(candidateHeaders, headerAliases.description) !== null
      && (position(candidateHeaders, headerAliases.amount) !== null
        || position(candidateHeaders, headerAliases.debit) !== null
        || position(candidateHeaders, headerAliases.credit) !== null);
  });
  if (headerIndex < 0) return { rows: [] as BankImportRow[], errors: ["The statement needs Date, Description, and either Amount or Debit/Credit columns."] };
  const headers = rawRows[headerIndex].map(cleaned);
  const dateIndex = position(headers, headerAliases.date);
  const descriptionIndex = position(headers, headerAliases.description);
  const amountIndex = position(headers, headerAliases.amount);
  const debitIndex = position(headers, headerAliases.debit);
  const creditIndex = position(headers, headerAliases.credit);
  const postedIndex = position(headers, headerAliases.postedDate);
  const externalIndex = position(headers, headerAliases.externalId);
  const transactionTypeIndex = position(headers, headerAliases.transactionType);
  const errors: string[] = [];
  const rows: BankImportRow[] = [];
  if (dateIndex === null || descriptionIndex === null || (amountIndex === null && debitIndex === null && creditIndex === null)) {
    return { rows, errors: ["The statement needs Date, Description, and either Amount or Debit/Credit columns."] };
  }
  rawRows.slice(headerIndex + 1).forEach((raw, index) => {
    if (!raw.some((value) => cleaned(value))) return;
    const transactionDate = isoDate(raw[dateIndex]);
    const description = cleaned(raw[descriptionIndex]);
    let signedAmount = amountIndex !== null
      ? money(raw[amountIndex])
      : (money(raw[creditIndex ?? -1]) ?? 0) - (money(raw[debitIndex ?? -1]) ?? 0);
    const transactionType = transactionTypeIndex === null ? "" : cleaned(raw[transactionTypeIndex]).toUpperCase();
    if (signedAmount !== null && !Number.isNaN(signedAmount)) {
      if (transactionType === "D" || transactionType === "DEBIT") signedAmount = -Math.abs(signedAmount);
      if (transactionType === "C" || transactionType === "CREDIT") signedAmount = Math.abs(signedAmount);
    }
    const rowNumber = headerIndex + index + 2;
    if (!transactionDate) errors.push(`Row ${rowNumber}: Date is invalid.`);
    if (!description) errors.push(`Row ${rowNumber}: Description is required.`);
    if (signedAmount === null || Number.isNaN(signedAmount) || signedAmount === 0) errors.push(`Row ${rowNumber}: Amount must be a non-zero number.`);
    if (!transactionDate || !description || signedAmount === null || Number.isNaN(signedAmount) || signedAmount === 0) return;
    const base = {
      transactionDate,
      postedDate: postedIndex === null ? null : isoDate(raw[postedIndex]),
      description,
      amount: signedAmount,
      externalId: externalIndex === null ? null : cleaned(raw[externalIndex]) || null,
    };
    rows.push({ rowNumber, ...base, fingerprint: bankFingerprint(base) });
  });
  return { rows, errors };
}

export type BankExpenseMatch = {
  transactionId: number;
  transactionDate: string;
  transactionDescription: string;
  expenseId: number;
  expenseDate: string;
  expenseLabel: string;
  amount: number;
};

export function findClassificationSuggestions<
  T extends { id: number; description: string },
  R extends { id: number; match_text: string },
>(transactions: T[], rules: R[]) {
  return transactions.flatMap((transaction) => {
    const rule = rules.filter((candidate) => transaction.description.toLowerCase().includes(candidate.match_text.toLowerCase()))
      .sort((left, right) => right.match_text.length - left.match_text.length)[0];
    return rule ? [{ transaction, rule }] : [];
  });
}

export function findUniqueExpenseMatches(
  transactions: { id: number; transaction_date: string; description: string; amount: number }[],
  expenses: { id: number; expense_date: string; vendor: string | null; description: string | null; category: string; amount: number }[],
) {
  const eligibleTransactions = transactions.filter((transaction) => Number(transaction.amount) < 0);
  const candidatesForTransaction = new Map<number, typeof expenses>();
  const candidatesForExpense = new Map<number, typeof eligibleTransactions>();
  for (const transaction of eligibleTransactions) {
    const candidates = expenses.filter((expense) => Math.abs(Number(expense.amount) - Math.abs(Number(transaction.amount))) <= 0.005
      && Math.abs((Date.parse(`${expense.expense_date}T00:00:00Z`) - Date.parse(`${transaction.transaction_date}T00:00:00Z`)) / 86_400_000) <= 10);
    candidatesForTransaction.set(transaction.id, candidates);
    for (const expense of candidates) candidatesForExpense.set(expense.id, [...(candidatesForExpense.get(expense.id) ?? []), transaction]);
  }
  return eligibleTransactions.flatMap((transaction) => {
    const candidates = candidatesForTransaction.get(transaction.id) ?? [];
    if (candidates.length !== 1 || (candidatesForExpense.get(candidates[0].id) ?? []).length !== 1) return [];
    const expense = candidates[0];
    return [{
      transactionId: transaction.id,
      transactionDate: transaction.transaction_date,
      transactionDescription: transaction.description,
      expenseId: expense.id,
      expenseDate: expense.expense_date,
      expenseLabel: expense.vendor || expense.description || expense.category,
      amount: Math.abs(Number(transaction.amount)),
    } satisfies BankExpenseMatch];
  });
}

export type FuzzyExpenseCandidate = {
  expenseId: number;
  expenseDate: string;
  expenseLabel: string;
  expenseAmount: number;
  transactionAmount: number;
  amountDifference: number;
  percentDifference: number;
  daysApart: number;
};

const exactMatchTolerance = 0.005;

// Deliberately separate from findUniqueExpenseMatches: fuzzy candidates are always
// manual-approve, never auto-applied, and this function never returns anything the
// exact-match path already covers (amount differences at or below exactMatchTolerance).
export function findFuzzyExpenseCandidates(
  transaction: { id: number; transaction_date: string; description: string; amount: number },
  expenses: { id: number; expense_date: string; vendor: string | null; description: string | null; category: string; amount: number }[],
  tolerancePercent: number,
  dayWindow: number,
): FuzzyExpenseCandidate[] {
  const transactionAmount = Math.abs(Number(transaction.amount));
  const maxDifference = (tolerancePercent / 100) * transactionAmount;
  const candidates = expenses.flatMap((expense) => {
    const amountDifference = Math.round(Math.abs(Number(expense.amount) - transactionAmount) * 100) / 100;
    if (amountDifference <= exactMatchTolerance || amountDifference > maxDifference) return [];
    const daysApart = Math.round(Math.abs((Date.parse(`${expense.expense_date}T00:00:00Z`) - Date.parse(`${transaction.transaction_date}T00:00:00Z`)) / 86_400_000));
    if (daysApart > dayWindow) return [];
    return [{
      expenseId: expense.id,
      expenseDate: expense.expense_date,
      expenseLabel: expense.vendor || expense.description || expense.category,
      expenseAmount: Math.round(Number(expense.amount) * 100) / 100,
      transactionAmount: Math.round(transactionAmount * 100) / 100,
      amountDifference,
      percentDifference: transactionAmount > 0 ? Math.round((amountDifference / transactionAmount) * 10000) / 100 : 0,
      daysApart,
    } satisfies FuzzyExpenseCandidate];
  });
  return candidates.sort((left, right) => left.amountDifference - right.amountDifference || left.daysApart - right.daysApart);
}

export function remainingRefundAmount(sourceAmount: number, refunds: { amount: number; voided_at?: string | null }[], editingRefundAmount = 0) {
  const alreadyRefunded = refunds.filter((refund) => !refund.voided_at).reduce((sum, refund) => sum + refund.amount, 0) - editingRefundAmount;
  return Math.max(0, Math.round((sourceAmount - alreadyRefunded) * 100) / 100);
}

export function suggestTaxCategory(input: { category?: string | null; vendor?: string | null; description?: string | null }) {
  const text = `${input.vendor ?? ""} ${input.description ?? ""} ${input.category ?? ""}`.toLowerCase();
  if (/fuel|gas|sheetz|sunoco|exxon|marathon/.test(text)) return "Vehicle and equipment fuel";
  if (/repair|parts|bearing|belt|tooth|teeth|hydraulic/.test(text)) return "Repairs and maintenance";
  if (/insurance/.test(text)) return "Insurance";
  if (/advert|google|facebook|marketing|sign/.test(text)) return "Advertising and marketing";
  if (/phone|internet|verizon|at&t|comcast/.test(text)) return "Utilities and communications";
  if (/office|software|subscription|quickbooks/.test(text)) return "Office and software";
  if (/license|permit|registration|fee/.test(text)) return "Licenses, permits, and fees";
  return input.category?.trim() || "Other business expense";
}

export function buildTaxExpenseSummary(expenses: TaxExpense[]) {
  const categories = new Map<string, number>();
  let grossOperating = 0;
  let deductibleOperating = 0;
  let assetPurchases = 0;
  let refunds = 0;
  for (const expense of expenses) {
    if (expense.voided_at) continue;
    if (expense.transaction_type === "asset") {
      assetPurchases += expense.amount;
      continue;
    }
    const direction = expense.transaction_type === "refund" ? -1 : 1;
    if (direction < 0) refunds += expense.amount;
    grossOperating += direction * expense.amount;
    const deductible = direction * expense.amount * expense.deductible_percent / 100;
    deductibleOperating += deductible;
    const category = expense.tax_category || expense.category;
    categories.set(category, (categories.get(category) ?? 0) + deductible);
  }
  return {
    grossOperating: Math.round(grossOperating * 100) / 100,
    deductibleOperating: Math.round(deductibleOperating * 100) / 100,
    assetPurchases: Math.round(assetPurchases * 100) / 100,
    refunds: Math.round(refunds * 100) / 100,
    categories: [...categories.entries()].sort((left, right) => right[1] - left[1]),
  };
}

export function trialBalance(lines: { debit: number; credit: number }[]) {
  const debit = Math.round(lines.reduce((sum, line) => sum + line.debit, 0) * 100) / 100;
  const credit = Math.round(lines.reduce((sum, line) => sum + line.credit, 0) * 100) / 100;
  return { debit, credit, balanced: debit === credit };
}
