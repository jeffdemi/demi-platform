"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { requireBusinessContext } from "@/lib/auth";
import { normalizeBankRows, type BankImportRow } from "@/lib/domain/accounting";
import {
  createBankAccount,
  excludeBankTransaction,
  getBankTransaction,
  importBankStatement,
  recordPayment,
} from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import {
  bankAccountSchema,
  excludeBankTransactionSchema,
  formValues,
  paymentFormSchema,
} from "@/lib/validation/business-records";

export type FinanceState = { message?: string; errors?: Record<string, string[]> };
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

function refreshFinance() {
  revalidatePath("/finance");
  revalidatePath("/expenses");
  revalidatePath("/invoices");
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function addBankAccount(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankAccountSchema.safeParse(formValues(formData, ["name", "institution", "accountType", "lastFour"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const { business } = await requireBusinessContext();
  try {
    await createBankAccount(await createClient(), {
      business_id: business.id,
      name: parsed.data.name,
      institution: parsed.data.institution ?? null,
      account_type: parsed.data.accountType,
      last_four: parsed.data.lastFour ?? null,
    });
    refreshFinance();
    return { message: "Account added." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The account could not be added." };
  }
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
  const { business } = await requireBusinessContext();
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

export async function excludeTransaction(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = excludeBankTransactionSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const { business, user } = await requireBusinessContext();
  const excluded = await excludeBankTransaction(await createClient(), business.id, transactionId, user.id, parsed.data.reason);
  if (!excluded) return { message: "That transaction is no longer available for review." };
  refreshFinance();
  return { message: "Transaction excluded from reconciliation." };
}

export async function savePayment(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = paymentFormSchema.safeParse(formValues(formData, [
    "invoiceId", "jobId", "bankTransactionId", "paymentDate", "amount", "method", "reference", "notes",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const { business } = await requireBusinessContext();
  try {
    if (parsed.data.bankTransactionId) {
      const transaction = await getBankTransaction(await createClient(), business.id, parsed.data.bankTransactionId);
      if (!transaction || transaction.status !== "unreviewed") return { message: "That bank transaction is no longer available." };
    }
    const id = await recordPayment(await createClient(), {
      businessId: business.id,
      invoiceId: parsed.data.invoiceId,
      jobId: parsed.data.jobId,
      bankTransactionId: parsed.data.bankTransactionId,
      paymentDate: parsed.data.paymentDate!,
      amount: parsed.data.amount!,
      method: parsed.data.method,
      reference: parsed.data.reference,
      notes: parsed.data.notes,
    });
    refreshFinance();
    redirect(parsed.data.invoiceId ? `/invoices/${parsed.data.invoiceId}` : `/finance?payment=${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The payment could not be recorded." };
  }
}
