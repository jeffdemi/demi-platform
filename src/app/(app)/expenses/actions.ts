"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { archiveExpense, getExpense, restoreExpense } from "@/lib/repositories/expense-repository";
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
    "equipmentId", "notes", "transactionType", "refundOfExpenseId",
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
