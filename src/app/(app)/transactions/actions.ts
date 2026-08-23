"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { suggestTaxCategory } from "@/lib/domain/accounting";
import {
  addBankTransactionAllocation,
  approveFuzzyExpenseMatch,
  createBankTransfer,
  excludeBankTransaction,
  getBankTransaction,
  matchExistingExpense,
  voidBankTransactionAllocation,
} from "@/lib/repositories/accounting-repository";
import { upsertExpenseCategory } from "@/lib/repositories/expense-repository";
import { refreshFinance } from "@/lib/revalidate-finance";
import { createExpenseRecord } from "@/lib/services/expenses";
import { createClient } from "@/lib/supabase/server";
import {
  bankTransactionAllocationSchema,
  bankTransferSchema,
  excludeBankTransactionSchema,
  existingExpenseMatchSchema,
  formValues,
  quickCategorizeExpenseSchema,
} from "@/lib/validation/business-records";

export type FinanceState = { message?: string; errors?: Record<string, string[]> };

export async function excludeTransaction(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = excludeBankTransactionSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business, user } = context;
  const excluded = await excludeBankTransaction(await createClient(), business.id, transactionId, user.id, parsed.data.reason);
  if (!excluded) return { message: "That transaction is no longer available for review." };
  refreshFinance();
  return { message: "Transaction excluded from reconciliation." };
}

export async function matchExpense(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = existingExpenseMatchSchema.safeParse({ expenseId: formData.get("expenseId") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can match expenses." };
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
    revalidatePath(`/transactions/${transactionId}`);
    return { message: "Existing expense matched." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The expense could not be matched." };
  }
}

export async function quickCategorizeTransaction(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = quickCategorizeExpenseSchema.safeParse(formValues(formData, ["category", "vendor", "description"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can categorize transactions." };
  try {
    const client = await createClient();
    const transaction = await getBankTransaction(client, context.business.id, transactionId);
    if (!transaction || transaction.status !== "unreviewed" || transaction.amount >= 0) {
      return { message: "That bank transaction is no longer available to categorize." };
    }
    await upsertExpenseCategory(client, context.business.id, parsed.data.category);
    await createExpenseRecord(client, context.business.id, {
      expense_date: transaction.transaction_date,
      category: parsed.data.category,
      vendor: parsed.data.vendor ?? null,
      description: parsed.data.description ?? null,
      amount: Math.abs(transaction.amount),
      payment_method: "business_account",
      job_id: null,
      equipment_id: null,
      notes: null,
      transaction_type: "expense",
      refund_of_expense_id: null,
      bank_transaction_id: transactionId,
      tax_category: suggestTaxCategory({ category: parsed.data.category, vendor: parsed.data.vendor, description: parsed.data.description }),
      deductible_percent: 100,
      financial_classification: "operating",
      labor_class: null,
      financial_classification_reviewed: true,
    }, null);
    refreshFinance();
    revalidatePath(`/transactions/${transactionId}`);
    return { message: "Transaction categorized as a new expense." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The transaction could not be categorized." };
  }
}

export async function approveFuzzyMatch(transactionId: number, expenseId: number, previousState: FinanceState): Promise<FinanceState> {
  void previousState;
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can approve a fuzzy match." };
  if (!Number.isInteger(transactionId) || transactionId <= 0 || !Number.isInteger(expenseId) || expenseId <= 0) {
    return { message: "That match request is invalid." };
  }
  try {
    await approveFuzzyExpenseMatch(await createClient(), {
      businessId: context.business.id,
      expenseId,
      transactionId,
    });
    refreshFinance();
    revalidatePath(`/transactions/${transactionId}`);
    revalidatePath(`/expenses/${expenseId}`);
    return { message: "Match approved. The expense amount was corrected to the bank transaction." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The match could not be approved." };
  }
}

export async function saveTransactionAllocation(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankTransactionAllocationSchema.safeParse(formValues(formData, [
    "ledgerAccountId", "amount", "memo", "taxCategory", "deductiblePercent",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can allocate transactions." };
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
    revalidatePath(`/transactions/${transactionId}`);
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
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can reverse allocations." };
  try {
    await voidBankTransactionAllocation(await createClient(), context.business.id, allocationId, parsed.data.reason);
    refreshFinance();
    revalidatePath(`/transactions/${transactionId}`);
    return { message: "Allocation reversed with its audit history retained." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The allocation could not be reversed." };
  }
}

export async function saveBankTransfer(transactionId: number, _: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankTransferSchema.safeParse(formValues(formData, ["otherTransactionId", "memo"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can record transfers." };
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
    redirect("/transactions?status=unreviewed");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The transfer could not be recorded." };
  }
}
