import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function getFinancialSettings(client: Client, businessId: number) {
  const result = await client.from("financial_settings").select("*")
    .eq("business_id", businessId).maybeSingle();
  if (result.error) throw new Error(`Unable to load financial settings: ${result.error.message}`);
  return result.data;
}

export async function saveFinancialSettings(
  client: Client,
  values: Database["public"]["Tables"]["financial_settings"]["Insert"],
) {
  const result = await client.from("financial_settings").upsert(values, { onConflict: "business_id" }).select("*").single();
  if (result.error) throw new Error(`Unable to save financial settings: ${result.error.message}`);
  return result.data;
}

export async function listOwnerCompensation(client: Client, businessId: number, from?: string, to?: string) {
  let query = client.from("owner_compensation_periods").select("*")
    .eq("business_id", businessId).order("period_month", { ascending: false }).limit(120);
  if (from) query = query.gte("period_month", from);
  if (to) query = query.lte("period_month", to);
  const result = await query;
  if (result.error) throw new Error(`Unable to load owner compensation: ${result.error.message}`);
  return result.data ?? [];
}

export async function saveOwnerCompensation(
  client: Client,
  values: Database["public"]["Tables"]["owner_compensation_periods"]["Insert"],
) {
  const result = await client.from("owner_compensation_periods").upsert(values, {
    onConflict: "business_id,period_month",
  }).select("*").single();
  if (result.error) throw new Error(`Unable to save owner compensation: ${result.error.message}`);
  return result.data;
}

export type LaborFilters = { from?: string; to?: string; laborClass?: string; includeVoided?: boolean };

export async function listLaborEntries(client: Client, businessId: number, filters: LaborFilters = {}) {
  let query = client.from("labor_entries").select("*, jobs(id, work_description)")
    .eq("business_id", businessId).order("period_end", { ascending: false }).order("id", { ascending: false }).limit(1000);
  if (!filters.includeVoided) query = query.is("voided_at", null);
  if (filters.from) query = query.gte("period_end", filters.from);
  if (filters.to) query = query.lte("period_end", filters.to);
  if (filters.laborClass) query = query.eq("labor_class", filters.laborClass);
  const result = await query;
  if (result.error) throw new Error(`Unable to load labor entries: ${result.error.message}`);
  return result.data ?? [];
}

export async function createLaborEntry(
  client: Client,
  values: Database["public"]["Tables"]["labor_entries"]["Insert"],
) {
  const result = await client.from("labor_entries").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to save labor entry: ${result.error.message}`);
  return result.data;
}

export async function archiveLaborEntry(client: Client, businessId: number, entryId: number, userId: string, reason: string) {
  const result = await client.from("labor_entries").update({
    voided_at: new Date().toISOString(),
    voided_by: userId,
    void_reason: reason,
  }).eq("business_id", businessId).eq("id", entryId).is("voided_at", null).select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to archive labor entry: ${result.error.message}`);
  return result.data;
}

export async function getMonthlySnapshot(client: Client, businessId: number, periodMonth: string) {
  const result = await client.from("monthly_financial_snapshots").select("*")
    .eq("business_id", businessId).eq("period_month", periodMonth).maybeSingle();
  if (result.error) throw new Error(`Unable to load month-end balances: ${result.error.message}`);
  return result.data;
}

export async function saveMonthlySnapshot(
  client: Client,
  values: Database["public"]["Tables"]["monthly_financial_snapshots"]["Insert"],
) {
  const result = await client.from("monthly_financial_snapshots").upsert(values, {
    onConflict: "business_id,period_month",
  }).select("*").single();
  if (result.error) throw new Error(`Unable to save month-end balances: ${result.error.message}`);
  return result.data;
}

export async function getMonthEndInputs(client: Client, businessId: number, periodMonth: string, monthEnd: string) {
  const [settings, ownerCompensation, labor, expenses, bank, snapshot, invoices, equipment] = await Promise.all([
    getFinancialSettings(client, businessId),
    client.from("owner_compensation_periods").select("id", { count: "exact", head: true })
      .eq("business_id", businessId).eq("period_month", periodMonth),
    client.from("labor_entries").select("id", { count: "exact", head: true })
      .eq("business_id", businessId).is("voided_at", null).gte("period_end", periodMonth).lte("period_end", monthEnd),
    client.from("expenses").select("id", { count: "exact", head: true })
      .eq("business_id", businessId).is("voided_at", null).eq("financial_classification_reviewed", false).lte("expense_date", monthEnd),
    client.from("bank_transactions").select("id", { count: "exact", head: true })
      .eq("business_id", businessId).eq("status", "unreviewed").lte("transaction_date", monthEnd),
    getMonthlySnapshot(client, businessId, periodMonth),
    client.from("invoices").select("amount").eq("business_id", businessId).eq("status", "unpaid").lte("invoice_date", monthEnd),
    client.from("equipment").select("purchase_cost, in_service_date, useful_life_months, depreciation_method, loan_original_amount, loan_balance")
      .eq("business_id", businessId).eq("active", true),
  ]);
  for (const result of [ownerCompensation, labor, expenses, bank, invoices, equipment]) {
    if (result.error) throw new Error(`Unable to build month-end checklist: ${result.error.message}`);
  }
  const incompleteEquipmentSchedules = (equipment.data ?? []).filter((item) => {
    const hasDepreciableCost = (item.purchase_cost ?? 0) > 0;
    const depreciationIncomplete = hasDepreciableCost && (!item.in_service_date || !item.useful_life_months || !item.depreciation_method);
    const loanIncomplete = (item.loan_original_amount ?? 0) > 0 && item.loan_balance === null;
    return depreciationIncomplete || loanIncomplete;
  }).length;
  return {
    settings,
    ownerCompensationRecorded: (ownerCompensation.count ?? 0) > 0,
    laborRecorded: (labor.count ?? 0) > 0,
    unreviewedExpenseClassifications: expenses.count ?? 0,
    unreviewedBankTransactions: bank.count ?? 0,
    snapshot,
    expectedAccountsReceivable: (invoices.data ?? []).reduce((sum, invoice) => sum + invoice.amount, 0),
    incompleteEquipmentSchedules,
  };
}

export async function getCrabtreeReportData(client: Client, businessId: number, from: string, to: string) {
  const monthEnd = `${to.slice(0, 7)}-01`;
  const [settings, payments, invoices, expenses, laborEntries, ownerCompensation, equipment, snapshot] = await Promise.all([
    getFinancialSettings(client, businessId),
    client.from("payments").select("amount, payment_date, voided_at").eq("business_id", businessId)
      .gte("payment_date", from).lte("payment_date", to).limit(10000),
    client.from("invoices").select("amount, invoice_date, status").eq("business_id", businessId)
      .gte("invoice_date", from).lte("invoice_date", to).limit(10000),
    client.from("expenses").select("amount, expense_date, financial_classification, labor_class, transaction_type, voided_at")
      .eq("business_id", businessId).gte("expense_date", from).lte("expense_date", to).limit(10000),
    client.from("labor_entries").select("worker_type, labor_class, period_end, gross_wages, employer_payroll_taxes, benefits, voided_at")
      .eq("business_id", businessId).gte("period_end", from).lte("period_end", to).limit(10000),
    listOwnerCompensation(client, businessId, `${from.slice(0, 7)}-01`, monthEnd),
    client.from("equipment").select("purchase_cost, salvage_value, in_service_date, useful_life_months, depreciation_method")
      .eq("business_id", businessId),
    client.from("monthly_financial_snapshots").select("*").eq("business_id", businessId)
      .lte("period_month", monthEnd).order("period_month", { ascending: false }).limit(1).maybeSingle(),
  ]);
  for (const result of [payments, invoices, expenses, laborEntries, equipment, snapshot]) {
    if (result.error) throw new Error(`Unable to build management report: ${result.error.message}`);
  }
  return {
    settings,
    payments: payments.data ?? [],
    invoices: invoices.data ?? [],
    expenses: expenses.data ?? [],
    laborEntries: laborEntries.data ?? [],
    ownerCompensation,
    equipment: equipment.data ?? [],
    snapshot: snapshot.data,
  };
}
