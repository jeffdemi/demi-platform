"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { saveMonthlySnapshot } from "@/lib/repositories/management-accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { formValues, monthlyFinancialSnapshotSchema } from "@/lib/validation/business-records";

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
  if (context.role === "employee") return { message: "Only an owner or administrator can save month-end balances." };
  try {
    const reconciledAt = parsed.data.reconcile ? new Date().toISOString() : null;
    await saveMonthlySnapshot(await createClient(), {
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
