"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import {
  createBankAccount,
  createBookkeepingAdjustment,
  getBankTransaction,
  reconcileBankStatementPeriod,
  recordPayment,
  saveBankStatementPeriod,
} from "@/lib/repositories/accounting-repository";
import { refreshFinance } from "@/lib/revalidate-finance";
import { createClient } from "@/lib/supabase/server";
import {
  bankAccountSchema,
  bankStatementPeriodSchema,
  bookkeepingAdjustmentSchema,
  formValues,
  paymentFormSchema,
} from "@/lib/validation/business-records";

export type FinanceState = { message?: string; errors?: Record<string, string[]> };

export async function addBankAccount(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bankAccountSchema.safeParse(formValues(formData, ["name", "institution", "accountType", "lastFour"]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business } = context;
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

export async function savePayment(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = paymentFormSchema.safeParse(formValues(formData, [
    "invoiceId", "jobId", "bankTransactionId", "paymentDate", "amount", "method", "reference", "notes",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business } = context;
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
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can reconcile statements." };
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

export async function postBookkeepingAdjustment(_: FinanceState, formData: FormData): Promise<FinanceState> {
  const parsed = bookkeepingAdjustmentSchema.safeParse(formValues(formData, [
    "entryDate", "description", "debitAccountId", "creditAccountId", "amount", "reason",
  ]));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can post adjustments." };
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
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can reconcile statements." };
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
