import type { SupabaseClient } from "@supabase/supabase-js";
import type { DigitalAssetImportRow } from "@/lib/domain/digital-assets";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function listBusinessLines(client: Client, businessId: number) {
  const result = await client.from("business_lines").select("*").eq("business_id", businessId).eq("active", true).order("name");
  if (result.error) throw new Error(`Unable to load business lines: ${result.error.message}`);
  return result.data ?? [];
}

export async function getBusinessIdentity(client: Client, businessId: number) {
  const result = await client.from("business_identity_settings").select("*").eq("business_id", businessId).maybeSingle();
  if (result.error) throw new Error(`Unable to load business identity: ${result.error.message}`);
  return result.data;
}

export async function saveBusinessIdentity(client: Client, values: Database["public"]["Tables"]["business_identity_settings"]["Insert"]) {
  const result = await client.from("business_identity_settings").upsert(values, { onConflict: "business_id" }).select("*").single();
  if (result.error) throw new Error(`Unable to save business identity: ${result.error.message}`);
  return result.data;
}

export async function listDigitalAssetAccounts(client: Client, businessId: number) {
  const result = await client.from("digital_asset_accounts").select("*").eq("business_id", businessId).order("active", { ascending: false }).order("name");
  if (result.error) throw new Error(`Unable to load digital asset accounts: ${result.error.message}`);
  return result.data ?? [];
}

export async function createDigitalAssetAccount(client: Client, values: Database["public"]["Tables"]["digital_asset_accounts"]["Insert"]) {
  const result = await client.from("digital_asset_accounts").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to create digital asset account: ${result.error.message}`);
  return result.data;
}

export async function listDigitalAssetTransactions(client: Client, businessId: number) {
  const result = await client.from("digital_asset_transactions").select("*, digital_asset_accounts(name)")
    .eq("business_id", businessId).neq("status", "excluded").order("occurred_at", { ascending: false }).order("id", { ascending: false }).limit(5000);
  if (result.error) throw new Error(`Unable to load digital asset transactions: ${result.error.message}`);
  return result.data ?? [];
}

export async function importDigitalAssetTransactions(client: Client, values: {
  businessId: number; accountId: number; fileName: string; sourceSha256: string; rows: DigitalAssetImportRow[];
}) {
  const result = await client.rpc("import_digital_asset_transactions", {
    target_business_id: values.businessId,
    target_account_id: values.accountId,
    import_file_name: values.fileName,
    import_source_sha256: values.sourceSha256,
    import_rows: values.rows as unknown as Json,
  });
  if (result.error) throw new Error(`Unable to import exchange activity: ${result.error.message}`);
  return result.data as { already_imported: boolean; created: number; skipped: number };
}

export async function assignBusinessLine(client: Client, values: { businessId: number; recordType: string; recordId: number; businessLineId: number }) {
  const result = await client.rpc("assign_business_line", {
    target_business_id: values.businessId,
    target_record_type: values.recordType,
    target_record_id: values.recordId,
    target_business_line_id: values.businessLineId,
  });
  if (result.error) throw new Error(`Unable to classify record: ${result.error.message}`);
}

export async function listClassificationRecords(client: Client, businessId: number) {
  const [jobs, expenses, equipment, labor, payments, journals] = await Promise.all([
    client.from("jobs").select("id, job_date, work_description, amount_paid, business_line_id").eq("business_id", businessId).order("job_date", { ascending: false }).limit(100),
    client.from("expenses").select("id, expense_date, description, vendor, amount, business_line_id").eq("business_id", businessId).is("voided_at", null).order("expense_date", { ascending: false }).limit(100),
    client.from("equipment").select("id, name, purchase_cost, business_line_id").eq("business_id", businessId).eq("active", true).order("name").limit(100),
    client.from("labor_entries").select("id, period_end, worker_name, gross_wages, business_line_id").eq("business_id", businessId).is("voided_at", null).order("period_end", { ascending: false }).limit(100),
    client.from("payments").select("id, payment_date, amount, reference, business_line_id").eq("business_id", businessId).is("voided_at", null).order("payment_date", { ascending: false }).limit(100),
    client.from("journal_entries").select("id, entry_date, description, business_line_id").eq("business_id", businessId).eq("status", "posted").order("entry_date", { ascending: false }).limit(100),
  ]);
  for (const result of [jobs, expenses, equipment, labor, payments, journals]) if (result.error) throw new Error(`Unable to load classification workbench: ${result.error.message}`);
  return { jobs: jobs.data ?? [], expenses: expenses.data ?? [], equipment: equipment.data ?? [], labor: labor.data ?? [], payments: payments.data ?? [], journals: journals.data ?? [] };
}

export async function listCapitalTransactions(client: Client, businessId: number) {
  const result = await client.from("capital_transactions").select("*").eq("business_id", businessId).order("transaction_date", { ascending: false }).order("id", { ascending: false });
  if (result.error) throw new Error(`Unable to load owner activity: ${result.error.message}`);
  return result.data ?? [];
}

export async function recordCapitalTransaction(client: Client, values: {
  businessId: number; businessLineId?: number; bankAccountId?: number; transactionDate: string;
  transactionType: string; amount: number; counterparty?: string; memo: string;
}) {
  const result = await client.rpc("record_capital_transaction", {
    target_business_id: values.businessId,
    target_business_line_id: values.businessLineId ?? null,
    target_bank_account_id: values.bankAccountId ?? null,
    target_date: values.transactionDate,
    target_type: values.transactionType,
    target_amount: values.amount,
    target_counterparty: values.counterparty ?? null,
    target_memo: values.memo,
  });
  if (result.error) throw new Error(`Unable to record owner activity: ${result.error.message}`);
  return result.data;
}

export async function listCleanupItems(client: Client, businessId: number) {
  const result = await client.from("bookkeeping_cleanup_items").select("*").eq("business_id", businessId).order("status").order("effective_date").order("id");
  if (result.error) throw new Error(`Unable to load cleanup items: ${result.error.message}`);
  return result.data ?? [];
}

export async function createCleanupItem(client: Client, values: Database["public"]["Tables"]["bookkeeping_cleanup_items"]["Insert"]) {
  const result = await client.from("bookkeeping_cleanup_items").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to add cleanup item: ${result.error.message}`);
  return result.data;
}

export async function postCleanupItem(client: Client, businessId: number, itemId: number) {
  const result = await client.rpc("post_bookkeeping_cleanup_item", { target_business_id: businessId, target_item_id: itemId });
  if (result.error) throw new Error(`Unable to post opening balance: ${result.error.message}`);
  return result.data;
}

export async function saveDigitalAssetReconciliation(client: Client, values: Database["public"]["Tables"]["digital_asset_reconciliations"]["Insert"]) {
  const result = await client.from("digital_asset_reconciliations").upsert(values, { onConflict: "business_id,account_id,as_of_date" }).select("id").single();
  if (result.error) throw new Error(`Unable to save digital asset reconciliation: ${result.error.message}`);
  return result.data;
}

export async function listDigitalAssetReconciliations(client: Client, businessId: number) {
  const result = await client.from("digital_asset_reconciliations").select("*, digital_asset_accounts(name)").eq("business_id", businessId).order("as_of_date", { ascending: false });
  if (result.error) throw new Error(`Unable to load digital asset reconciliations: ${result.error.message}`);
  return result.data ?? [];
}
