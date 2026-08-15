"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { addBankTransactionAllocation } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";

export type SuggestionApprovalState = { message?: string; success?: boolean };

export async function approveClassificationSuggestions(_: SuggestionApprovalState, formData: FormData): Promise<SuggestionApprovalState> {
  const context = await requireBusinessContext();
  if (context.role === "employee") return { message: "Only an owner or administrator can approve classifications." };
  const selections = formData.getAll("suggestion").map(String).flatMap((value) => {
    const [transactionId, ruleId] = value.split(":").map(Number);
    return Number.isInteger(transactionId) && Number.isInteger(ruleId) ? [{ transactionId, ruleId }] : [];
  });
  if (!selections.length) return { message: "Select at least one suggestion." };
  const client = await createClient();
  const ruleIds = [...new Set(selections.map((item) => item.ruleId))];
  const transactionIds = [...new Set(selections.map((item) => item.transactionId))];
  const [rules, transactions] = await Promise.all([
    client.from("bank_classification_rules").select("id, match_text, ledger_account_id, tax_category, deductible_percent").eq("business_id", context.business.id).eq("active", true).in("id", ruleIds),
    client.from("bank_transactions").select("id, description, amount, status").eq("business_id", context.business.id).in("id", transactionIds),
  ]);
  if (rules.error || transactions.error) return { message: rules.error?.message || transactions.error?.message || "Suggestions could not be loaded." };
  const rulesById = new Map((rules.data ?? []).map((rule) => [rule.id, rule]));
  const transactionsById = new Map((transactions.data ?? []).map((transaction) => [transaction.id, transaction]));
  let approved = 0;
  for (const selection of selections) {
    const rule = rulesById.get(selection.ruleId);
    const transaction = transactionsById.get(selection.transactionId);
    if (!rule || !transaction || transaction.status !== "unreviewed" || transaction.amount >= 0 || !transaction.description.toLowerCase().includes(rule.match_text.toLowerCase())) continue;
    try {
      await addBankTransactionAllocation(client, { businessId: context.business.id, transactionId: transaction.id, ledgerAccountId: rule.ledger_account_id, amount: Math.abs(transaction.amount), memo: transaction.description, taxCategory: rule.tax_category ?? undefined, deductiblePercent: rule.deductible_percent });
      approved += 1;
    } catch {
      // A changed row remains available for individual review.
    }
  }
  revalidatePath("/finance");
  revalidatePath("/finance/suggestions");
  return { success: true, message: `Approved ${approved} classification${approved === 1 ? "" : "s"}.` };
}
