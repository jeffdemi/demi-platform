import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
export type ExpenseWithRelations = Database["public"]["Tables"]["expenses"]["Row"] & {
  jobs: { id: number; work_description: string | null } | null;
  equipment: { id: number; name: string } | null;
};

export async function listExpenses(client: Client, businessId: number) {
  const result = await client.from("expenses").select("*, jobs(id, work_description), equipment(id, name)")
    .eq("business_id", businessId).order("expense_date", { ascending: false }).order("id", { ascending: false }).limit(500);
  if (result.error) throw new Error(`Unable to load expenses: ${result.error.message}`);
  return result.data as ExpenseWithRelations[];
}

export async function createExpense(client: Client, values: Database["public"]["Tables"]["expenses"]["Insert"]) {
  const result = await client.from("expenses").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to create expense: ${result.error.message}`);
  return result.data;
}
