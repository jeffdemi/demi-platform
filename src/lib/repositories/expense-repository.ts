import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type ExpenseRow = Database["public"]["Tables"]["expenses"]["Row"];
type ExpenseUpdate = Database["public"]["Tables"]["expenses"]["Update"];

export type ExpenseWithRelations = ExpenseRow & {
  jobs: { id: number; work_description: string | null } | null;
  equipment: { id: number; name: string } | null;
};

export type ExpenseFilters = {
  category?: string;
  transactionType?: string;
  financialClassification?: string;
  classificationReview?: string;
  includeVoided?: boolean;
};

const expenseSelect = "*, jobs(id, work_description), equipment(id, name)";

export async function listExpenses(client: Client, businessId: number, filters: ExpenseFilters = {}) {
  let query = client.from("expenses").select(expenseSelect)
    .eq("business_id", businessId)
    .order("expense_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(1000);
  if (!filters.includeVoided) query = query.is("voided_at", null);
  if (filters.category) query = query.eq("category", filters.category);
  if (filters.transactionType) query = query.eq("transaction_type", filters.transactionType);
  if (filters.financialClassification) query = query.eq("financial_classification", filters.financialClassification);
  if (filters.classificationReview === "missing") query = query.eq("financial_classification_reviewed", false);
  const result = await query;
  if (result.error) throw new Error(`Unable to load expenses: ${result.error.message}`);
  return result.data as ExpenseWithRelations[];
}

export async function listExpensesAwaitingBankMatch(
  client: Client,
  businessId: number,
  sort: "date" | "description" = "date",
  direction: "asc" | "desc" = "desc",
) {
  const sortColumn = sort === "description" ? "vendor" : "expense_date";
  const result = await client.from("expenses")
    .select("id, expense_date, vendor, description, amount, transaction_type, financial_classification_reviewed, receipt_path, receipt_review_status")
    .eq("business_id", businessId)
    .is("bank_transaction_id", null)
    .is("voided_at", null)
    .order(sortColumn, { ascending: direction === "asc", nullsFirst: false })
    .order("id", { ascending: direction === "asc" })
    .limit(500);
  if (result.error) throw new Error(`Unable to load expenses awaiting bank match: ${result.error.message}`);
  return result.data ?? [];
}

export async function getExpense(client: Client, businessId: number, expenseId: number) {
  const result = await client.from("expenses").select(expenseSelect)
    .eq("business_id", businessId).eq("id", expenseId).maybeSingle();
  if (result.error) throw new Error(`Unable to load expense: ${result.error.message}`);
  return result.data as ExpenseWithRelations | null;
}

export async function listRefundableExpenseOptions(client: Client, businessId: number) {
  const result = await client.from("expenses")
    .select("id, expense_date, vendor, description, amount, transaction_type, financial_classification, labor_class, deductible_percent")
    .eq("business_id", businessId).is("voided_at", null)
    .in("transaction_type", ["expense", "asset"])
    .order("expense_date", { ascending: false }).limit(500);
  if (result.error) throw new Error(`Unable to load refundable expenses: ${result.error.message}`);
  return result.data ?? [];
}

export async function getActiveRefundTotal(client: Client, businessId: number, sourceExpenseId: number, excludeExpenseId?: number) {
  let query = client.from("expenses").select("amount").eq("business_id", businessId)
    .eq("transaction_type", "refund").eq("refund_of_expense_id", sourceExpenseId).is("voided_at", null);
  if (excludeExpenseId) query = query.neq("id", excludeExpenseId);
  const result = await query;
  if (result.error) throw new Error(`Unable to validate refund total: ${result.error.message}`);
  return (result.data ?? []).reduce((sum, refund) => sum + refund.amount, 0);
}

export async function createExpense(client: Client, values: Database["public"]["Tables"]["expenses"]["Insert"]) {
  const result = await client.from("expenses").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to create expense: ${result.error.message}`);
  return result.data;
}

export async function updateExpense(client: Client, businessId: number, expenseId: number, values: ExpenseUpdate) {
  const result = await client.from("expenses").update(values)
    .eq("business_id", businessId).eq("id", expenseId).select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to update expense: ${result.error.message}`);
  return result.data;
}

export async function bulkClassifyExpenses(client: Client, businessId: number, expenseIds: number[], values: ExpenseUpdate) {
  const result = await client.from("expenses").update(values)
    .eq("business_id", businessId).in("id", expenseIds).is("voided_at", null).select("id, transaction_type");
  if (result.error) throw new Error(`Unable to classify expenses: ${result.error.message}`);
  return result.data ?? [];
}

export async function archiveExpense(client: Client, businessId: number, expenseId: number, userId: string, reason: string) {
  return updateExpense(client, businessId, expenseId, {
    voided_at: new Date().toISOString(),
    voided_by: userId,
    void_reason: reason,
  });
}

export async function restoreExpense(client: Client, businessId: number, expenseId: number) {
  return updateExpense(client, businessId, expenseId, {
    voided_at: null,
    voided_by: null,
    void_reason: null,
  });
}
