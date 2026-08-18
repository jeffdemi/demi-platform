"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { listBulkExpenseMatches, matchExistingExpense } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";

export type BulkMatchState = { message?: string; success?: boolean };

export async function confirmBulkExpenseMatches(): Promise<BulkMatchState> {
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) return { message: "Only an owner or administrator can match expenses." };
  const client = await createClient();
  try {
    const matches = await listBulkExpenseMatches(client, context.business.id);
    if (!matches.length) return { success: true, message: "No high-confidence matches remain." };
    let matched = 0;
    for (const match of matches) {
      try {
        await matchExistingExpense(client, { businessId: context.business.id, transactionId: match.transactionId, expenseId: match.expenseId });
        matched += 1;
      } catch {
        // A row may have changed after preview; leave it untouched for individual review.
      }
    }
    revalidatePath("/finance");
    revalidatePath("/finance/matching");
    return { success: true, message: `Matched ${matched} existing expense${matched === 1 ? "" : "s"}.` };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The matches could not be confirmed." };
  }
}
