import { createHash } from "node:crypto";

export const importHeaders = [
  "Job #", "Job Date", "Customer", "Address", "Phone", "Referred By", "Description",
  "Amount Quoted", "Amount Paid", "Payment Method", "Status", "Paid Date", "Notes",
] as const;

export type JobImportRow = {
  rowNumber: number;
  jobNumber: string | null;
  jobDate: string | null;
  customerName: string;
  address: string | null;
  phone: string | null;
  referralSource: string | null;
  description: string | null;
  amountQuoted: number | null;
  amountPaid: number | null;
  paymentMethod: string | null;
  status: string;
  paidDate: string | null;
  notes: string | null;
  fingerprint: string;
};

function text(value: unknown) {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).trim();
  return cleaned || null;
}

function dateValue(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) return value.toISOString().slice(0, 10);
  const cleaned = text(value);
  if (!cleaned) return null;
  const match = cleaned.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? match[0] : cleaned;
}

function money(value: unknown) {
  const cleaned = text(value)?.replaceAll("$", "").replaceAll(",", "");
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : Number.NaN;
}

export function importFingerprint(row: Omit<JobImportRow, "fingerprint">) {
  return createHash("sha256").update([
    row.jobNumber || "", row.jobDate || "", row.customerName.toLowerCase(), row.address || "",
    row.description || "", row.amountQuoted ?? "",
  ].join("|")).digest("hex");
}

export function normalizeImportRows(rawRows: unknown[][]) {
  const errors: string[] = [];
  if (!rawRows.length) return { rows: [], errors: ["The spreadsheet is empty."] };
  const headers = rawRows[0].map((value) => text(value) || "");
  const positions = new Map(headers.map((header, index) => [header, index]));
  const missing = ["Customer", "Address", "Phone", "Description", "Status"].filter((header) => !positions.has(header));
  if (missing.length) return { rows: [], errors: [`Missing required columns: ${missing.join(", ")}`] };
  const get = (row: unknown[], name: string) => row[positions.get(name) ?? -1];
  const rows: JobImportRow[] = [];

  rawRows.slice(1).forEach((raw, index) => {
    const customerName = text(get(raw, "Customer"));
    if (!customerName) return;
    const amountQuoted = money(get(raw, "Amount Quoted"));
    const amountPaid = money(get(raw, "Amount Paid"));
    if (Number.isNaN(amountQuoted)) errors.push(`Row ${index + 2}: Amount Quoted is not a valid amount.`);
    if (Number.isNaN(amountPaid)) errors.push(`Row ${index + 2}: Amount Paid is not a valid amount.`);
    const status = (text(get(raw, "Status")) || "lead").toLowerCase().replace(/\s+/g, "_");
    const base = {
      rowNumber: index + 2,
      jobNumber: text(get(raw, "Job #")),
      jobDate: dateValue(get(raw, "Job Date")),
      customerName,
      address: text(get(raw, "Address")),
      phone: text(get(raw, "Phone")),
      referralSource: text(get(raw, "Referred By")),
      description: text(get(raw, "Description")),
      amountQuoted: Number.isNaN(amountQuoted) ? null : amountQuoted,
      amountPaid: Number.isNaN(amountPaid) ? null : amountPaid,
      paymentMethod: text(get(raw, "Payment Method")),
      status,
      paidDate: dateValue(get(raw, "Paid Date")),
      notes: text(get(raw, "Notes")),
    };
    rows.push({ ...base, fingerprint: importFingerprint(base) });
  });
  return { rows, errors };
}
