"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { suggestTaxCategory } from "@/lib/domain/accounting";
import { archiveExpense, getExpense, restoreExpense, updateExpense } from "@/lib/repositories/expense-repository";
import { createExpenseRecord, updateExpenseRecord } from "@/lib/services/expenses";
import { createClient } from "@/lib/supabase/server";
import { expenseFormSchema, formValues, voidExpenseSchema } from "@/lib/validation/business-records";

export type ExpenseState = { message?: string; errors?: Record<string, string[]> };

function refreshFinancialPages(expenseId?: number) {
  revalidatePath("/expenses");
  if (expenseId) revalidatePath(`/expenses/${expenseId}`);
  revalidatePath("/dashboard");
  revalidatePath("/reports");
}

export async function saveExpense(expenseId: number | null, _: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const parsed = expenseFormSchema.safeParse(formValues(formData, [
    "expenseDate", "category", "vendor", "description", "amount", "paymentMethod", "jobId",
    "equipmentId", "notes", "transactionType", "refundOfExpenseId", "bankTransactionId",
    "taxCategory", "deductiblePercent", "financialClassification", "laborClass",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.expenseDate || parsed.data.amount === undefined) return { message: "Expense date and amount are required." };
  const { business } = await requireBusinessContext();
  const client = await createClient();
  const input = {
    expense_date: parsed.data.expenseDate,
    category: parsed.data.category,
    vendor: parsed.data.vendor ?? null,
    description: parsed.data.description ?? null,
    amount: parsed.data.amount,
    payment_method: parsed.data.paymentMethod ?? null,
    job_id: parsed.data.jobId ?? null,
    equipment_id: parsed.data.equipmentId ?? null,
    notes: parsed.data.notes ?? null,
    transaction_type: parsed.data.transactionType,
    refund_of_expense_id: parsed.data.refundOfExpenseId ?? null,
    bank_transaction_id: parsed.data.bankTransactionId ?? null,
    tax_category: parsed.data.taxCategory ?? parsed.data.category,
    deductible_percent: parsed.data.deductiblePercent,
    financial_classification: parsed.data.financialClassification,
    labor_class: parsed.data.laborClass ?? null,
    financial_classification_reviewed: true,
  };
  try {
    const saved = expenseId
      ? await updateExpenseRecord(client, business.id, expenseId, input, formData.get("receipt"))
      : await createExpenseRecord(client, business.id, input, formData.get("receipt"));
    if (!saved) return { message: "That expense no longer exists." };
    refreshFinancialPages(saved.id);
    redirect(`/expenses/${saved.id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The expense could not be saved." };
  }
}

export async function voidExpense(expenseId: number, _: ExpenseState, formData: FormData): Promise<ExpenseState> {
  const parsed = voidExpenseSchema.safeParse({ reason: formData.get("reason"), confirm: formData.get("confirm") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const { business, user } = await requireBusinessContext();
  const client = await createClient();
  if (!(await getExpense(client, business.id, expenseId))) return { message: "That expense no longer exists." };
  await archiveExpense(client, business.id, expenseId, user.id, parsed.data.reason);
  refreshFinancialPages(expenseId);
  return { message: "Expense archived. It is excluded from financial totals." };
}

export async function unvoidExpense(expenseId: number, previousState: ExpenseState): Promise<ExpenseState> {
  void previousState;
  const { business } = await requireBusinessContext();
  const restored = await restoreExpense(await createClient(), business.id, expenseId);
  if (!restored) return { message: "That expense no longer exists." };
  refreshFinancialPages(expenseId);
  return { message: "Expense restored to financial totals." };
}

export async function prepareReceiptReview(expenseId: number) {
  const { business } = await requireBusinessContext();
  const client = await createClient();
  const expense = await getExpense(client, business.id, expenseId);
  if (!expense?.receipt_path) return;
  const suggestedTaxCategory = suggestTaxCategory(expense);
  await updateExpense(client, business.id, expenseId, {
    receipt_review_status: "needs_review",
    receipt_extracted_data: {
      vendor: expense.vendor,
      date: expense.expense_date,
      amount: expense.amount,
      suggestedTaxCategory,
      source: "record_fields",
    },
    receipt_reviewed_at: null,
    receipt_reviewed_by: null,
  });
  refreshFinancialPages(expenseId);
}

export async function approveReceiptReview(expenseId: number) {
  const { business, user } = await requireBusinessContext();
  const client = await createClient();
  const expense = await getExpense(client, business.id, expenseId);
  if (!expense || expense.receipt_review_status !== "needs_review") return;
  const extracted = expense.receipt_extracted_data && typeof expense.receipt_extracted_data === "object" && !Array.isArray(expense.receipt_extracted_data)
    ? expense.receipt_extracted_data
    : {};
  const suggested = typeof extracted.suggestedTaxCategory === "string" ? extracted.suggestedTaxCategory : expense.tax_category;
  await updateExpense(client, business.id, expenseId, {
    tax_category: suggested,
    receipt_review_status: "approved",
    receipt_reviewed_at: new Date().toISOString(),
    receipt_reviewed_by: user.id,
  });
  refreshFinancialPages(expenseId);
}
