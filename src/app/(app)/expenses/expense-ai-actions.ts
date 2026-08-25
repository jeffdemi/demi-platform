"use server";

import { requireBusinessContext } from "@/lib/auth";
import { listActiveEquipmentOptions } from "@/lib/repositories/equipment-repository";
import { listExpenseCategories } from "@/lib/repositories/expense-repository";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { suggestExpenseFields, type ExpenseAiFieldSuggestion } from "@/lib/services/expense-ai";
import { createClient } from "@/lib/supabase/server";

export type ExpenseAiActionResult =
  | { ok: true; suggestion: ExpenseAiFieldSuggestion }
  | { ok: false; message: string };

// Called directly from the client component (not through useActionState) so the description box
// can sit inside the main expense form without nesting a second <form>.
export async function suggestExpenseFieldsAction(
  description: string,
  bankContext?: { description?: string | null; amount?: number | null; date?: string | null },
): Promise<ExpenseAiActionResult> {
  const { business, user, role } = await requireBusinessContext();
  if (role === "intern") return { ok: false, message: "Interns have read-only access." };
  const client = await createClient();
  try {
    const [categories, jobs, equipment] = await Promise.all([
      listExpenseCategories(client, business.id),
      listJobOptions(client, business.id),
      listActiveEquipmentOptions(client, business.id),
    ]);
    const suggestion = await suggestExpenseFields(business.id, user.id, {
      description,
      bankDescription: bankContext?.description ?? null,
      bankAmount: bankContext?.amount ?? null,
      bankDate: bankContext?.date ?? null,
      categories,
      jobs: jobs.map((job) => ({ id: job.id, label: job.label })),
      equipment: (equipment ?? []).map((item) => ({ id: item.id, label: item.name })),
    });
    return { ok: true, suggestion };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The expense could not be classified." };
  }
}
