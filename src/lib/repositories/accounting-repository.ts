import type { SupabaseClient } from "@supabase/supabase-js";
import type { BankImportRow } from "@/lib/domain/accounting";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function listBankAccounts(client: Client, businessId: number) {
  const result = await client.from("bank_accounts").select("*")
    .eq("business_id", businessId).order("active", { ascending: false }).order("name");
  if (result.error) throw new Error(`Unable to load bank accounts: ${result.error.message}`);
  return result.data ?? [];
}

export async function createBankAccount(client: Client, values: Database["public"]["Tables"]["bank_accounts"]["Insert"]) {
  const result = await client.from("bank_accounts").insert(values).select("id").single();
  if (result.error) throw new Error(`Unable to create bank account: ${result.error.message}`);
  return result.data;
}

export async function listBankTransactions(client: Client, businessId: number, status?: string) {
  let query = client.from("bank_transactions").select("*, bank_accounts(name)")
    .eq("business_id", businessId).order("transaction_date", { ascending: false }).order("id", { ascending: false }).limit(500);
  if (status) query = query.eq("status", status);
  const result = await query;
  if (result.error) throw new Error(`Unable to load bank transactions: ${result.error.message}`);
  return result.data ?? [];
}

export async function getBankTransaction(client: Client, businessId: number, transactionId: number) {
  const result = await client.from("bank_transactions").select("*, bank_accounts(name)")
    .eq("business_id", businessId).eq("id", transactionId).maybeSingle();
  if (result.error) throw new Error(`Unable to load bank transaction: ${result.error.message}`);
  return result.data;
}

export async function importBankStatement(client: Client, values: {
  businessId: number;
  accountId: number;
  fileName: string;
  sourceSha256: string;
  rows: BankImportRow[];
}) {
  const result = await client.rpc("import_bank_statement", {
    target_business_id: values.businessId,
    target_account_id: values.accountId,
    import_file_name: values.fileName,
    import_source_sha256: values.sourceSha256,
    import_rows: values.rows as unknown as Json,
  });
  if (result.error) throw new Error(`Unable to import statement: ${result.error.message}`);
  return result.data as { already_imported: boolean; created: number; skipped: number };
}

export async function excludeBankTransaction(client: Client, businessId: number, transactionId: number, userId: string, reason: string) {
  const result = await client.from("bank_transactions").update({
    status: "excluded",
    excluded_reason: reason,
    reviewed_at: new Date().toISOString(),
    reviewed_by: userId,
  }).eq("business_id", businessId).eq("id", transactionId).eq("status", "unreviewed").select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to exclude bank transaction: ${result.error.message}`);
  return result.data;
}

export async function listPayments(client: Client, businessId: number, invoiceId?: number) {
  let query = client.from("payments").select("*").eq("business_id", businessId)
    .is("voided_at", null).order("payment_date", { ascending: false }).order("id", { ascending: false });
  if (invoiceId) query = query.eq("invoice_id", invoiceId);
  const result = await query.limit(1000);
  if (result.error) throw new Error(`Unable to load payments: ${result.error.message}`);
  return result.data ?? [];
}

export async function recordPayment(client: Client, values: {
  businessId: number;
  invoiceId?: number;
  jobId?: number;
  bankTransactionId?: number;
  paymentDate: string;
  amount: number;
  method?: string;
  reference?: string;
  notes?: string;
}) {
  const result = await client.rpc("record_payment", {
    target_business_id: values.businessId,
    target_invoice_id: values.invoiceId ?? null,
    target_job_id: values.jobId ?? null,
    target_bank_transaction_id: values.bankTransactionId ?? null,
    payment_on: values.paymentDate,
    payment_amount: values.amount,
    payment_method: values.method ?? null,
    payment_reference: values.reference ?? null,
    payment_notes: values.notes ?? null,
  });
  if (result.error) throw new Error(`Unable to record payment: ${result.error.message}`);
  return result.data;
}

export async function getLedgerReport(client: Client, businessId: number, from?: string, to?: string) {
  let entriesQuery = client.from("journal_entries").select("*").eq("business_id", businessId)
    .eq("status", "posted").order("entry_date", { ascending: false }).order("id", { ascending: false }).limit(5000);
  if (from) entriesQuery = entriesQuery.gte("entry_date", from);
  if (to) entriesQuery = entriesQuery.lte("entry_date", to);
  const [entries, lines] = await Promise.all([
    entriesQuery,
    client.from("journal_lines").select("*, ledger_accounts(code, name, account_type)").eq("business_id", businessId).limit(10000),
  ]);
  if (entries.error || lines.error) throw new Error(`Unable to load general ledger: ${entries.error?.message || lines.error?.message}`);
  const entryIds = new Set((entries.data ?? []).map((entry) => entry.id));
  return { entries: entries.data ?? [], lines: (lines.data ?? []).filter((line) => entryIds.has(line.journal_entry_id)) };
}

export async function getTaxExpenses(client: Client, businessId: number, year: number) {
  const result = await client.from("expenses")
    .select("id, expense_date, vendor, description, category, tax_category, deductible_percent, amount, transaction_type, voided_at")
    .eq("business_id", businessId).gte("expense_date", `${year}-01-01`).lte("expense_date", `${year}-12-31`).limit(10000);
  if (result.error) throw new Error(`Unable to load tax expenses: ${result.error.message}`);
  return result.data ?? [];
}
