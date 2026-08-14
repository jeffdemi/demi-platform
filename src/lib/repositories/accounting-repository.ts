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

export async function listBankStatementPeriods(client: Client, businessId: number, status?: string) {
  let query = client.from("bank_statement_periods").select("*, bank_accounts(name, account_type, last_four)")
    .eq("business_id", businessId).order("statement_end_date", { ascending: false }).limit(240);
  if (status) query = query.eq("status", status);
  const result = await query;
  if (result.error) throw new Error(`Unable to load statement reconciliations: ${result.error.message}`);
  return result.data ?? [];
}

export async function getBankStatementPeriod(client: Client, businessId: number, periodId: number) {
  const result = await client.from("bank_statement_periods").select("*, bank_accounts(name, account_type, last_four)")
    .eq("business_id", businessId).eq("id", periodId).maybeSingle();
  if (result.error) throw new Error(`Unable to load statement reconciliation: ${result.error.message}`);
  return result.data;
}

export async function getBankStatementPeriodActivity(client: Client, businessId: number, periodId: number, accountId: number, from: string, to: string) {
  const [transactions, cashLines] = await Promise.all([
    client.from("bank_transactions").select("*").eq("business_id", businessId)
      .eq("statement_period_id", periodId).order("transaction_date").order("id"),
    client.from("journal_lines")
      .select("debit, credit, journal_entries!inner(entry_date, status), ledger_accounts!inner(system_key)")
      .eq("business_id", businessId).eq("bank_account_id", accountId)
      .eq("journal_entries.status", "posted").gte("journal_entries.entry_date", from).lte("journal_entries.entry_date", to)
      .eq("ledger_accounts.system_key", "cash"),
  ]);
  if (transactions.error || cashLines.error) {
    throw new Error(`Unable to load reconciliation activity: ${transactions.error?.message || cashLines.error?.message}`);
  }
  return { transactions: transactions.data ?? [], cashLines: cashLines.data ?? [] };
}

export async function saveBankStatementPeriod(client: Client, values: {
  businessId: number;
  accountId: number;
  statementStart: string;
  statementEnd: string;
  openingBalance: number;
  closingBalance: number;
  notes?: string;
}) {
  const result = await client.rpc("save_bank_statement_period", {
    target_business_id: values.businessId,
    target_account_id: values.accountId,
    statement_start: values.statementStart,
    statement_end: values.statementEnd,
    statement_opening_balance: values.openingBalance,
    statement_closing_balance: values.closingBalance,
    statement_notes: values.notes ?? null,
  });
  if (result.error) throw new Error(`Unable to create statement reconciliation: ${result.error.message}`);
  return result.data as number;
}

export async function reconcileBankStatementPeriod(client: Client, businessId: number, periodId: number) {
  const result = await client.rpc("reconcile_bank_statement_period", {
    target_business_id: businessId,
    target_period_id: periodId,
  });
  if (result.error) throw new Error(`Unable to reconcile statement: ${result.error.message}`);
  return result.data;
}

export async function getBankTransaction(client: Client, businessId: number, transactionId: number) {
  const result = await client.from("bank_transactions").select("*, bank_accounts(name)")
    .eq("business_id", businessId).eq("id", transactionId).maybeSingle();
  if (result.error) throw new Error(`Unable to load bank transaction: ${result.error.message}`);
  return result.data;
}

export async function getBankTransactionReview(client: Client, businessId: number, transactionId: number) {
  const [transaction, allocations, ledgerAccounts, transferCandidates] = await Promise.all([
    getBankTransaction(client, businessId, transactionId),
    client.from("bank_transaction_allocations").select("*, ledger_accounts(code, name, account_type)")
      .eq("business_id", businessId).eq("bank_transaction_id", transactionId).is("voided_at", null).order("id"),
    listLedgerAccounts(client, businessId),
    client.from("bank_transactions").select("id, account_id, transaction_date, description, amount, bank_accounts(name)")
      .eq("business_id", businessId).eq("status", "unreviewed").neq("id", transactionId)
      .order("transaction_date", { ascending: false }).limit(250),
  ]);
  if (allocations.error || transferCandidates.error) {
    throw new Error(`Unable to load transaction review: ${allocations.error?.message || transferCandidates.error?.message}`);
  }
  return {
    transaction,
    allocations: allocations.data ?? [],
    ledgerAccounts,
    transferCandidates: transferCandidates.data ?? [],
  };
}

export async function listLedgerAccounts(client: Client, businessId: number) {
  const result = await client.from("ledger_accounts").select("*").eq("business_id", businessId)
    .eq("active", true).order("code");
  if (result.error) throw new Error(`Unable to load ledger accounts: ${result.error.message}`);
  return result.data ?? [];
}

export async function addBankTransactionAllocation(client: Client, values: {
  businessId: number;
  transactionId: number;
  ledgerAccountId: number;
  amount: number;
  memo: string;
  taxCategory?: string;
  deductiblePercent: number;
}) {
  const result = await client.rpc("add_bank_transaction_allocation", {
    target_business_id: values.businessId,
    target_bank_transaction_id: values.transactionId,
    target_ledger_account_id: values.ledgerAccountId,
    allocation_amount: values.amount,
    allocation_memo: values.memo,
    allocation_tax_category: values.taxCategory ?? null,
    allocation_deductible_percent: values.deductiblePercent,
  });
  if (result.error) throw new Error(`Unable to save allocation: ${result.error.message}`);
  return result.data;
}

export async function voidBankTransactionAllocation(client: Client, businessId: number, allocationId: number, reason: string) {
  const result = await client.rpc("void_bank_transaction_allocation", {
    target_business_id: businessId,
    target_allocation_id: allocationId,
    target_reason: reason,
  });
  if (result.error) throw new Error(`Unable to reverse allocation: ${result.error.message}`);
}

export async function createBankTransfer(client: Client, values: {
  businessId: number;
  outgoingTransactionId: number;
  incomingTransactionId: number;
  memo?: string;
}) {
  const result = await client.rpc("create_bank_transfer", {
    target_business_id: values.businessId,
    target_outgoing_transaction_id: values.outgoingTransactionId,
    target_incoming_transaction_id: values.incomingTransactionId,
    target_memo: values.memo ?? null,
  });
  if (result.error) throw new Error(`Unable to record transfer: ${result.error.message}`);
  return result.data;
}

export async function createBookkeepingAdjustment(client: Client, values: {
  businessId: number;
  entryDate: string;
  description: string;
  debitAccountId: number;
  creditAccountId: number;
  amount: number;
  reason: string;
}) {
  const result = await client.rpc("create_bookkeeping_adjustment", {
    target_business_id: values.businessId,
    adjustment_date: values.entryDate,
    adjustment_description: values.description,
    target_debit_account_id: values.debitAccountId,
    target_credit_account_id: values.creditAccountId,
    adjustment_amount: values.amount,
    adjustment_reason: values.reason,
  });
  if (result.error) throw new Error(`Unable to post adjustment: ${result.error.message}`);
  return result.data;
}

export async function listBookkeepingAdjustments(client: Client, businessId: number) {
  const result = await client.from("bookkeeping_adjustments")
    .select("*, debit:ledger_accounts!bookkeeping_adjustments_business_id_debit_account_id_fkey(code, name), credit:ledger_accounts!bookkeeping_adjustments_business_id_credit_account_id_fkey(code, name)")
    .eq("business_id", businessId).order("entry_date", { ascending: false }).order("id", { ascending: false }).limit(250);
  if (result.error) throw new Error(`Unable to load adjustments: ${result.error.message}`);
  return result.data ?? [];
}

export async function closeAccountingMonth(client: Client, businessId: number, periodMonth: string) {
  const result = await client.rpc("close_accounting_month", {
    target_business_id: businessId,
    target_period_month: periodMonth,
  });
  if (result.error) throw new Error(`Unable to close accounting month: ${result.error.message}`);
}

export async function reopenAccountingMonth(client: Client, businessId: number, periodMonth: string, reason: string) {
  const result = await client.rpc("reopen_accounting_month", {
    target_business_id: businessId,
    target_period_month: periodMonth,
    target_reason: reason,
  });
  if (result.error) throw new Error(`Unable to reopen accounting month: ${result.error.message}`);
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
    client.from("journal_lines").select("*, ledger_accounts(id, code, name, account_type, normal_balance, system_key)").eq("business_id", businessId).limit(25000),
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
