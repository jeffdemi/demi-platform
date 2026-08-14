import { createHash } from "node:crypto";

export const digitalAssetTransactionTypes = ["buy", "sell", "transfer_in", "transfer_out", "fee", "reward", "opening_balance", "adjustment"] as const;
export type DigitalAssetTransactionType = typeof digitalAssetTransactionTypes[number];

export type DigitalAssetImportRow = {
  rowNumber: number;
  occurredAt: string;
  transactionType: DigitalAssetTransactionType;
  assetSymbol: string;
  units: number;
  unitPriceUsd: number | null;
  grossAmountUsd: number;
  feeUsd: number;
  externalId: string | null;
  transferReference: string | null;
  memo: string | null;
  fingerprint: string;
};

export type DigitalAssetLedgerRow = Omit<DigitalAssetImportRow, "rowNumber"> & { id: number };

const aliases = {
  occurredAt: ["date", "time", "timestamp", "occurred at", "transaction date"],
  transactionType: ["type", "transaction type", "side"],
  assetSymbol: ["asset", "symbol", "currency", "coin"],
  units: ["units", "quantity", "quantity transacted", "amount", "size"],
  unitPriceUsd: ["unit price usd", "price usd", "price", "price at transaction"],
  grossAmountUsd: ["gross usd", "gross amount usd", "subtotal usd", "subtotal", "total usd", "value usd"],
  totalAmountUsd: ["total (inclusive of fees and/or spread)", "total inclusive of fees and/or spread"],
  feeUsd: ["fee usd", "fees usd", "fee", "fees and/or spread"],
  externalId: ["transaction id", "external id", "id", "reference"],
  transferReference: ["transfer reference", "transfer id", "tx hash", "transaction hash"],
  memo: ["memo", "notes", "description"],
} as const;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function numeric(value: unknown) {
  const raw = clean(value).replaceAll("$", "").replaceAll(",", "").replace(/^\((.*)\)$/, "-$1");
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function column(headers: string[], names: readonly string[]) {
  const normalized = headers.map((header) => header.toLowerCase().replaceAll("_", " ").trim());
  const index = normalized.findIndex((header) => names.includes(header));
  return index >= 0 ? index : null;
}

function normalizeType(value: string): DigitalAssetTransactionType | null {
  const type = value.toLowerCase().replaceAll("-", "_").replaceAll(" ", "_");
  if (type === "purchase") return "buy";
  if (type === "sale") return "sell";
  if (type === "reward_income" || type === "rewards_income") return "reward";
  if (type === "deposit" || type === "receive") return "transfer_in";
  if (type === "withdrawal" || type === "send") return "transfer_out";
  return digitalAssetTransactionTypes.includes(type as DigitalAssetTransactionType) ? type as DigitalAssetTransactionType : null;
}

export function digitalAssetFingerprint(row: Omit<DigitalAssetImportRow, "rowNumber" | "fingerprint">) {
  return createHash("sha256").update([
    row.occurredAt,
    row.transactionType,
    row.assetSymbol,
    row.units.toFixed(12),
    row.grossAmountUsd.toFixed(2),
    row.feeUsd.toFixed(2),
    row.externalId ?? "",
    row.transferReference ?? "",
  ].join("|")).digest("hex");
}

export function normalizeDigitalAssetRows(rawRows: unknown[][]) {
  if (!rawRows.length) return { rows: [] as DigitalAssetImportRow[], errors: ["The exchange export is empty."] };
  const headerIndex = rawRows.findIndex((candidate) => {
    const headers = candidate.map(clean);
    return column(headers, aliases.occurredAt) !== null
      && column(headers, aliases.transactionType) !== null
      && column(headers, aliases.assetSymbol) !== null
      && column(headers, aliases.units) !== null;
  });
  if (headerIndex < 0) return { rows: [] as DigitalAssetImportRow[], errors: ["The CSV needs Date, Type, Asset, and Units columns."] };
  const headers = rawRows[headerIndex].map(clean);
  const indexes = Object.fromEntries(Object.entries(aliases).map(([key, names]) => [key, column(headers, names)])) as Record<keyof typeof aliases, number | null>;
  const rows: DigitalAssetImportRow[] = [];
  const errors: string[] = [];
  rawRows.slice(headerIndex + 1).forEach((raw, offset) => {
    if (!raw.some((value) => clean(value))) return;
    const rowNumber = headerIndex + offset + 2;
    const occurred = new Date(clean(raw[indexes.occurredAt!]));
    const transactionType = normalizeType(clean(raw[indexes.transactionType!]));
    const assetSymbol = clean(raw[indexes.assetSymbol!]).toUpperCase();
    const parsedUnits = numeric(raw[indexes.units!]);
    const unitPriceUsd = indexes.unitPriceUsd === null ? null : numeric(raw[indexes.unitPriceUsd]);
    const suppliedGross = indexes.grossAmountUsd === null ? null : numeric(raw[indexes.grossAmountUsd]);
    const suppliedTotal = indexes.totalAmountUsd === null ? null : numeric(raw[indexes.totalAmountUsd]);
    const parsedFee = indexes.feeUsd === null ? 0 : numeric(raw[indexes.feeUsd]);
    if (Number.isNaN(occurred.valueOf()) || !transactionType || !/^[A-Z0-9]{2,12}$/.test(assetSymbol) || parsedUnits === null || parsedUnits === 0 || Number.isNaN(parsedUnits) || Number.isNaN(unitPriceUsd) || Number.isNaN(suppliedGross) || Number.isNaN(suppliedTotal) || parsedFee === null || Number.isNaN(parsedFee)) {
      errors.push(`Row ${rowNumber}: invalid date, type, asset, units, price, gross amount, or fee.`);
      return;
    }
    const units = Math.abs(parsedUnits);
    const feeUsd = Math.abs(parsedFee);
    const inclusiveTotal = suppliedTotal === null ? null : Math.abs(suppliedTotal);
    const grossAmountUsd = inclusiveTotal === null
      ? Math.abs(suppliedGross ?? (unitPriceUsd === null ? 0 : Math.round(units * unitPriceUsd * 100) / 100))
      : transactionType === "buy" ? Math.max(0, inclusiveTotal - feeUsd) : inclusiveTotal + (transactionType === "sell" ? feeUsd : 0);
    if (grossAmountUsd < 0) {
      errors.push(`Row ${rowNumber}: gross USD cannot be negative.`);
      return;
    }
    const base = {
      occurredAt: occurred.toISOString(), transactionType, assetSymbol, units,
      unitPriceUsd, grossAmountUsd, feeUsd,
      externalId: indexes.externalId === null ? null : clean(raw[indexes.externalId]) || null,
      transferReference: indexes.transferReference === null ? null : clean(raw[indexes.transferReference]) || null,
      memo: indexes.memo === null ? null : clean(raw[indexes.memo]) || null,
    };
    rows.push({ rowNumber, ...base, fingerprint: digitalAssetFingerprint(base) });
  });
  return { rows, errors };
}

export function parseCsv(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (character === '"') quoted = !quoted;
    else if (character === "," && !quoted) { row.push(value); value = ""; }
    else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value); rows.push(row); row = []; value = "";
    } else value += character;
  }
  if (value || row.length) { row.push(value); rows.push(row); }
  return rows;
}

export function calculateFifoPortfolio(transactions: DigitalAssetLedgerRow[]) {
  type Lot = { transactionId: number; acquiredAt: string; units: number; costBasis: number };
  const lots = new Map<string, Lot[]>();
  const disposals: { saleTransactionId: number; assetSymbol: string; units: number; proceeds: number; costBasis: number; gainLoss: number }[] = [];
  const sorted = transactions.map((row) => ({
    ...row,
    units: Number(row.units),
    unitPriceUsd: row.unitPriceUsd === null ? null : Number(row.unitPriceUsd),
    grossAmountUsd: Number(row.grossAmountUsd),
    feeUsd: Number(row.feeUsd),
  })).filter((row) => row.transactionType !== "fee").sort((left, right) => left.occurredAt.localeCompare(right.occurredAt) || left.id - right.id);
  const internalTransferReferences = new Set(sorted.filter((row) => row.transactionType === "transfer_out" && row.transferReference).map((row) => row.transferReference));
  sorted.forEach((transaction) => {
    const assetLots = lots.get(transaction.assetSymbol) ?? [];
    if (transaction.transactionType === "transfer_out") return;
    if (transaction.transactionType === "transfer_in" && transaction.transferReference && internalTransferReferences.has(transaction.transferReference)) return;
    if (["buy", "reward", "transfer_in", "opening_balance"].includes(transaction.transactionType)) {
      const basis = transaction.transactionType === "transfer_in" ? transaction.grossAmountUsd : transaction.grossAmountUsd + transaction.feeUsd;
      assetLots.push({ transactionId: transaction.id, acquiredAt: transaction.occurredAt, units: transaction.units, costBasis: basis });
      lots.set(transaction.assetSymbol, assetLots);
      return;
    }
    if (transaction.transactionType !== "sell") return;
    let remaining = transaction.units;
    let costBasis = 0;
    for (const lot of assetLots) {
      if (remaining <= 0) break;
      const used = Math.min(remaining, lot.units);
      const perUnit = lot.units > 0 ? lot.costBasis / lot.units : 0;
      lot.units -= used;
      lot.costBasis -= used * perUnit;
      remaining -= used;
      costBasis += used * perUnit;
    }
    const proceeds = Math.max(0, transaction.grossAmountUsd - transaction.feeUsd);
    disposals.push({ saleTransactionId: transaction.id, assetSymbol: transaction.assetSymbol, units: transaction.units - remaining, proceeds, costBasis, gainLoss: proceeds - costBasis });
  });
  const holdings = [...lots.entries()].map(([assetSymbol, assetLots]) => ({
    assetSymbol,
    units: assetLots.reduce((sum, lot) => sum + lot.units, 0),
    costBasis: assetLots.reduce((sum, lot) => sum + lot.costBasis, 0),
  })).filter((holding) => holding.units > 0.000000000001);
  return {
    holdings,
    disposals,
    realizedGainLoss: disposals.reduce((sum, disposal) => sum + disposal.gainLoss, 0),
  };
}
