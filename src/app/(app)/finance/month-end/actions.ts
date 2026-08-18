"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { buildMonthEndChecklist } from "@/lib/domain/management-accounting";
import { closeAccountingMonth, reopenAccountingMonth } from "@/lib/repositories/accounting-repository";
import { getMonthEndInputs, getMonthlySnapshot, saveMonthlySnapshot } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { formValues, monthlyFinancialSnapshotSchema, reopenAccountingMonthSchema } from "@/lib/validation/business-records";

export type MonthEndState = { message?: string; success?: boolean; errors?: Record<string, string[]> };

export async function updateMonthlySnapshot(_: MonthEndState, formData: FormData): Promise<MonthEndState> {
  const month = String(formData.get("periodMonth") ?? "");
  const parsed = monthlyFinancialSnapshotSchema.safeParse({
    ...formValues(formData, [
      "cashBookBalance", "cashBankBalance", "accountsReceivable", "accountsPayable", "inventory",
      "taxesPayable", "creditCardBalance", "shortTermDebt", "longTermDebt", "fixedAssetsNet", "notes",
    ]),
    periodMonth: /^\d{4}-\d{2}$/.test(month) ? `${month}-01` : month,
    reconcile: formData.get("reconcile") === "on",
  });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.periodMonth) return { message: "Select a month to reconcile." };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can save month-end balances." };
  try {
    const client = await createClient();
    const existing = await getMonthlySnapshot(client, context.business.id, parsed.data.periodMonth);
    if (existing?.close_status === "closed") return { message: "This accounting month is closed. Reopen it before changing balances." };
    const reconciledAt = parsed.data.reconcile ? new Date().toISOString() : null;
    await saveMonthlySnapshot(client, {
      business_id: context.business.id,
      period_month: parsed.data.periodMonth,
      cash_book_balance: parsed.data.cashBookBalance,
      cash_bank_balance: parsed.data.cashBankBalance,
      accounts_receivable: parsed.data.accountsReceivable,
      accounts_payable: parsed.data.accountsPayable,
      inventory: parsed.data.inventory,
      taxes_payable: parsed.data.taxesPayable,
      credit_card_balance: parsed.data.creditCardBalance,
      short_term_debt: parsed.data.shortTermDebt,
      long_term_debt: parsed.data.longTermDebt,
      fixed_assets_net: parsed.data.fixedAssetsNet,
      notes: parsed.data.notes ?? null,
      reconciled_at: reconciledAt,
      reconciled_by: reconciledAt ? context.user.id : null,
      created_by: context.user.id,
    });
    revalidatePath("/finance/month-end");
    revalidatePath("/reports");
    return { success: true, message: parsed.data.reconcile ? "Month-end balances saved and reconciled." : "Month-end balances saved." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "Month-end balances could not be saved." };
  }
}

function lastDayOfMonth(periodMonth: string) {
  const [year, month] = periodMonth.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

export async function closeAccountingPeriod(periodMonth: string, previousState: MonthEndState): Promise<MonthEndState> {
  void previousState;
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can close the books." };
  try {
    const client = await createClient();
    const inputs = await getMonthEndInputs(client, context.business.id, periodMonth, lastDayOfMonth(periodMonth));
    const checklist = buildMonthEndChecklist({
      settingsConfigured: Boolean(inputs.settings?.owner_market_salary_annual),
      ownerCompensationRecorded: inputs.ownerCompensationRecorded,
      hasNonOwnerLabor: inputs.settings?.has_non_owner_labor ?? false,
      laborRecorded: inputs.laborRecorded,
      unreviewedExpenseClassifications: inputs.unreviewedExpenseClassifications,
      unreviewedBankTransactions: inputs.unreviewedBankTransactions,
      unreconciledBankAccounts: inputs.unreconciledBankAccounts,
      snapshot: inputs.snapshot,
      expectedAccountsReceivable: inputs.expectedAccountsReceivable,
      incompleteEquipmentSchedules: inputs.incompleteEquipmentSchedules,
    });
    const missing = checklist.find((item) => !item.complete);
    if (missing) return { message: `Complete the month-end checklist first: ${missing.label}.` };
    await closeAccountingMonth(client, context.business.id, periodMonth);
    revalidatePath("/finance/month-end");
    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/reports/books");
    return { success: true, message: "Accounting month closed and dated records locked." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The accounting month could not be closed." };
  }
}

export async function reopenAccountingPeriod(periodMonth: string, _: MonthEndState, formData: FormData): Promise<MonthEndState> {
  const parsed = reopenAccountingMonthSchema.safeParse({ reason: formData.get("reason") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can reopen the books." };
  try {
    await reopenAccountingMonth(await createClient(), context.business.id, periodMonth, parsed.data.reason);
    revalidatePath("/finance/month-end");
    revalidatePath("/finance");
    revalidatePath("/reports");
    revalidatePath("/reports/books");
    return { success: true, message: "Accounting month reopened. Corrections are now allowed and the reason was retained." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The accounting month could not be reopened." };
  }
}
