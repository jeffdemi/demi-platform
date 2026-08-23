"use server";

import { createHash } from "node:crypto";
import { readSheet } from "read-excel-file/node";
import { requireBusinessContext } from "@/lib/auth";
import { normalizeBankRows, type BankImportRow } from "@/lib/domain/accounting";
import { importBankStatement } from "@/lib/repositories/accounting-repository";
import { refreshFinance } from "@/lib/revalidate-finance";
import { createClient } from "@/lib/supabase/server";

export type BankImportState = {
  message?: string;
  errors?: string[];
  rows?: BankImportRow[];
  fileName?: string;
  sourceSha256?: string;
  accountId?: number;
  result?: { already_imported: boolean; created: number; skipped: number };
};

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) { row.push(value); value = ""; }
    else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && text[index + 1] === "\n") index += 1;
      row.push(value);
      if (row.some(Boolean)) rows.push(row);
      row = [];
      value = "";
    } else value += char;
  }
  row.push(value);
  if (row.some(Boolean)) rows.push(row);
  return rows;
}

export async function previewBankImport(_: BankImportState, formData: FormData): Promise<BankImportState> {
  await requireBusinessContext();
  const accountId = Number(formData.get("accountId"));
  const file = formData.get("statement");
  if (!Number.isInteger(accountId) || accountId <= 0) return { errors: ["Select the account for this statement."] };
  if (!(file instanceof File) || !file.size) return { errors: ["Choose a statement to import."] };
  if (file.size > 5_000_000) return { errors: ["The statement must be smaller than 5 MB."] };
  const extension = file.name.toLowerCase().split(".").pop();
  if (!extension || !["xlsx", "csv"].includes(extension)) return { errors: ["Use an .xlsx or .csv statement."] };
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const raw = extension === "csv" ? csvRows(buffer.toString("utf8")) : await readSheet(buffer);
    const preview = normalizeBankRows(raw as unknown[][]);
    return {
      ...preview,
      accountId,
      fileName: file.name,
      sourceSha256: createHash("sha256").update(buffer).digest("hex"),
    };
  } catch {
    return { errors: ["The statement could not be read. Check its columns and try again."] };
  }
}

export async function confirmBankImport(_: BankImportState, formData: FormData): Promise<BankImportState> {
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business } = context;
  try {
    const accountId = Number(formData.get("accountId"));
    const rows = JSON.parse(String(formData.get("rows") || "[]")) as BankImportRow[];
    const fileName = String(formData.get("fileName") || "");
    const sourceSha256 = String(formData.get("sourceSha256") || "");
    if (!Number.isInteger(accountId) || !rows.length || !fileName || !/^[0-9a-f]{64}$/.test(sourceSha256)) {
      return { message: "The import preview expired. Choose the statement again." };
    }
    const result = await importBankStatement(await createClient(), { businessId: business.id, accountId, fileName, sourceSha256, rows });
    refreshFinance();
    return { result, message: result.already_imported ? "This exact statement was already imported." : "Statement import complete." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The statement could not be imported." };
  }
}
