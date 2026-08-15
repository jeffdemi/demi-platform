"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { readSheet } from "read-excel-file/node";
import { requireBusinessContext } from "@/lib/auth";
import { normalizeBankRows, type BankImportRow } from "@/lib/domain/accounting";
import {
  addBankTransactionAllocation,
  createBankTransfer,
  createBankAccount,
  createBookkeepingAdjustment,
  excludeBankTransaction,
  getBankTransaction,
  importBankStatement,
  matchExistingExpense,
  reconcileBankStatementPeriod,
  recordPayment,
  saveBankStatementPeriod,
  voidBankTransactionAllocation,
} from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import {
  bankAccountSchema,
  bankStatementPeriodSchema,
  bankTransactionAllocationSchema,
  bankTransferSchema,
  bookkeepingAdjustmentSchema,
  excludeBankTransactionSchema,
  existingExpenseMatchSchema,
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

export async function matchExpense(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = existingExpenseMatchSchema.safeParse({ expenseId: formData.get("expenseId") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can match expenses." };
  try {
    const client = await createClient();
    const transaction = await getBankTransaction(client, context.business.id, transactionId);
    if (!transaction || transaction.status !== "unreviewed") {
      return { message: "That bank transaction is no longer available to match." };
    }
    await matchExistingExpense(client, {
      businessId: context.business.id,
      transactionId,
      expenseId: parsed.data.expenseId!,
    });
    refreshFinance();
    revalidatePath(`/finance/transactions/${transactionId}`);
    return { message: "Existing expense matched." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The expense could not be matched." };
  }
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

export async function createStatementPeriod(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankStatementPeriodSchema.safeParse(formValues(formData, [
    "accountId", "statementStart", "statementEnd", "openingBalance", "closingBalance", "notes",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can reconcile statements." };
  try {
    const id = await saveBankStatementPeriod(await createClient(), {
      businessId: context.business.id,
      accountId: parsed.data.accountId!,
      statementStart: parsed.data.statementStart!,
      statementEnd: parsed.data.statementEnd!,
      openingBalance: parsed.data.openingBalance!,
      closingBalance: parsed.data.closingBalance!,
      notes: parsed.data.notes,
    });
    refreshFinance();
    redirect(`/finance/reconciliations/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The statement period could not be created." };
  }
}

export async function saveTransactionAllocation(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankTransactionAllocationSchema.safeParse(formValues(formData, [
    "ledgerAccountId", "amount", "memo", "taxCategory", "deductiblePercent",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can allocate transactions." };
  const rememberRule = formData.get("rememberRule") === "yes";
  const matchText = String(formData.get("merchantPattern") || "").trim().toLowerCase();
  if (rememberRule && matchText.length < 3) return { message: "Enter at least three characters for the merchant rule." };
  try {
    const client = await createClient();
    await addBankTransactionAllocation(client, {
      businessId: context.business.id,
      transactionId,
      ledgerAccountId: parsed.data.ledgerAccountId!,
      amount: parsed.data.amount!,
      memo: parsed.data.memo,
      taxCategory: parsed.data.taxCategory,
      deductiblePercent: parsed.data.deductiblePercent ?? 100,
    });
    if (rememberRule) {
      const savedRule = await client.from("bank_classification_rules").upsert({
        business_id: context.business.id,
        match_text: matchText,
        ledger_account_id: parsed.data.ledgerAccountId!,
        tax_category: parsed.data.taxCategory ?? null,
        deductible_percent: parsed.data.deductiblePercent ?? 100,
        active: true,
        created_by: context.user.id,
      }, { onConflict: "business_id,match_text" }).select("id").single();
      if (savedRule.error) return { message: `The allocation posted, but the automation rule could not be saved: ${savedRule.error.message}` };
      refreshFinance();
      redirect(`/finance/suggestions?rule=${savedRule.data.id}`);
    }
    refreshFinance();
    revalidatePath(`/finance/transactions/${transactionId}`);
    return { message: "Allocation posted." };
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The allocation could not be saved." };
  }
}

export async function reverseTransactionAllocation(transactionId: number, allocationId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = excludeBankTransactionSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can reverse allocations." };
  try {
    await voidBankTransactionAllocation(await createClient(), context.business.id, allocationId, parsed.data.reason);
    refreshFinance();
    revalidatePath(`/finance/transactions/${transactionId}`);
    return { message: "Allocation reversed with its audit history retained." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The allocation could not be reversed." };
  }
}

export async function saveBankTransfer(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankTransferSchema.safeParse(formValues(formData, ["otherTransactionId", "memo"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can record transfers." };
  try {
    const client = await createClient();
    const [current, other] = await Promise.all([
      getBankTransaction(client, context.business.id, transactionId),
      getBankTransaction(client, context.business.id, parsed.data.otherTransactionId!),
    ]);
    if (!current || !other) return { message: "The matching transfer transaction could not be found." };
    const outgoing = current.amount < 0 ? current : other;
    const incoming = current.amount > 0 ? current : other;
    await createBankTransfer(client, {
      businessId: context.business.id,
      outgoingTransactionId: outgoing.id,
      incomingTransactionId: incoming.id,
      memo: parsed.data.memo,
    });
    refreshFinance();
    redirect("/finance?status=unreviewed");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The transfer could not be recorded." };
  }
}

export async function postBookkeepingAdjustment(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bookkeepingAdjustmentSchema.safeParse(formValues(formData, [
    "entryDate", "description", "debitAccountId", "creditAccountId", "amount", "reason",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can post adjustments." };
  try {
    await createBookkeepingAdjustment(await createClient(), {
      businessId: context.business.id,
      entryDate: parsed.data.entryDate!,
      description: parsed.data.description,
      debitAccountId: parsed.data.debitAccountId!,
      creditAccountId: parsed.data.creditAccountId!,
      amount: parsed.data.amount!,
      reason: parsed.data.reason,
    });
    refreshFinance();
    revalidatePath("/reports/books");
    return { message: "Balanced adjustment posted." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The adjustment could not be posted." };
  }
}

export async function reconcileStatement(periodId: number, previousState: FinanceState): Promise<FinanceState> {
  void previousState;
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can reconcile statements." };
  try {
    await reconcileBankStatementPeriod(await createClient(), context.business.id, periodId);
    refreshFinance();
    revalidatePath(`/finance/reconciliations/${periodId}`);
    revalidatePath("/finance/month-end");
    return { message: "Statement reconciled to both imported and book activity." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The statement could not be reconciled." };
  }
}
