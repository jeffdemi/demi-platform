import type { SupabaseClient } from "@supabase/supabase-js";
import type { SimpleFinAccountSet } from "@/lib/integrations/simplefin";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

export function simpleFinAccountKey(connectionId: string, accountId: string) {
  return `${connectionId}\u0000${accountId}`;
}

export async function listBankConnections(client: Client, businessId: number) {
  const result = await client.from("bank_connections")
    .select("*, bank_connection_accounts(*)")
    .eq("business_id", businessId)
    .order("institution_name");
  if (result.error) throw new Error(`Unable to load bank connections: ${result.error.message}`);
  return result.data ?? [];
}

export async function saveSimpleFinCredential(client: Client, admin: Client, values: {
  businessId: number;
  userId: string;
  encryptedAccessUrl: string;
}) {
  const connection = await client.from("bank_connections").upsert({
    business_id: values.businessId,
    provider: "simplefin",
    provider_connection_id: "simplefin-bridge",
    institution_name: "SimpleFIN Bridge",
    status: "active",
    last_error: null,
    created_by: values.userId,
  }, { onConflict: "business_id,provider,provider_connection_id" }).select("id").single();
  if (connection.error) throw new Error(`Unable to save the bank connection: ${connection.error.message}`);

  const secret = await admin.from("bank_connection_secrets").upsert({
    connection_id: connection.data.id,
    business_id: values.businessId,
    encrypted_access_token: values.encryptedAccessUrl,
  }, { onConflict: "connection_id" });
  if (secret.error) throw new Error("The SimpleFIN credential could not be stored safely.");
  return connection.data.id;
}

function inferredAccountType(name: string, extra: Record<string, unknown> | undefined) {
  const text = `${name} ${JSON.stringify(extra ?? {})}`.toLowerCase();
  if (/credit|card|visa|mastercard/.test(text)) return { type: "credit", subtype: "credit_card" };
  if (/saving/.test(text)) return { type: "depository", subtype: "savings" };
  if (/check/.test(text)) return { type: "depository", subtype: "checking" };
  return { type: "unknown", subtype: "unknown" };
}

function inferredLastFour(name: string) {
  const match = name.match(/(?:^|\D)(\d{4})(?:\D|$)/g)?.at(-1)?.match(/\d{4}/);
  return match?.[0] ?? null;
}

export async function saveSimpleFinAccounts(client: Client, values: {
  businessId: number;
  connectionId: string;
  accountSet: SimpleFinAccountSet;
  accountMappings: Map<string, number>;
}) {
  const connections = new Map(values.accountSet.connections.map((connection) => [connection.conn_id, connection]));
  for (const account of values.accountSet.accounts) {
    const institution = connections.get(account.conn_id);
    const inferred = inferredAccountType(account.name, account.extra);
    const key = simpleFinAccountKey(account.conn_id, account.id);
    const bankAccountId = values.accountMappings.get(key) ?? null;
    const saved = await client.from("bank_connection_accounts").upsert({
      business_id: values.businessId,
      connection_id: values.connectionId,
      provider_institution_connection_id: account.conn_id,
      provider_account_id: account.id,
      provider_account_name: account.name,
      provider_account_type: inferred.type,
      provider_account_subtype: inferred.subtype,
      institution_id: institution?.org_id ?? null,
      institution_name: institution?.org_name || institution?.name || account.conn_name || "Connected institution",
      last_four: inferredLastFour(account.name),
      currency: account.currency,
      provider_status: "open",
      bank_account_id: bankAccountId,
      selected: bankAccountId !== null,
    }, { onConflict: "business_id,connection_id,provider_institution_connection_id,provider_account_id" });
    if (saved.error) throw new Error(`Unable to save ${account.name}: ${saved.error.message}`);
  }
}

export async function updateBankConnectionHealth(client: Client, businessId: number, connectionId: string, values: {
  status: "active" | "error";
  lastError: string | null;
}) {
  const result = await client.from("bank_connections").update({
    status: values.status,
    last_error: values.lastError,
  }).eq("business_id", businessId).eq("id", connectionId);
  if (result.error) throw new Error(`Unable to update the bank connection: ${result.error.message}`);
}

export async function getBankConnectionSecret(admin: Client, businessId: number, connectionId: string) {
  const result = await admin.from("bank_connection_secrets").select("encrypted_access_token")
    .eq("business_id", businessId).eq("connection_id", connectionId).maybeSingle();
  if (result.error) throw new Error("The bank credential could not be loaded.");
  if (!result.data) throw new Error("This SimpleFIN connection needs to be reconnected.");
  return result.data.encrypted_access_token;
}

export async function saveBankAccountMappings(
  client: Client,
  businessId: number,
  connectionId: string,
  mappings: { connectionAccountId: string; bankAccountId: number | null }[],
) {
  const result = await client.rpc("save_bank_connection_mappings", {
    target_business_id: businessId,
    target_connection_id: connectionId,
    mappings: mappings as unknown as Json,
  });
  if (result.error) throw new Error(`Unable to save the account mappings: ${result.error.message}`);
}

export async function listBankTransactionsForSync(
  client: Client,
  businessId: number,
  accountId: number,
  startDate: string,
  endDate: string,
) {
  const result = await client.from("bank_transactions")
    .select("id, account_id, transaction_date, posted_date, description, amount, fingerprint, provider, provider_transaction_id")
    .eq("business_id", businessId).eq("account_id", accountId)
    .gte("transaction_date", startDate).lte("transaction_date", endDate)
    .order("transaction_date").order("id");
  if (result.error) throw new Error(`Unable to compare existing bank activity: ${result.error.message}`);
  return result.data ?? [];
}

export async function getFirstBankTransactionDate(client: Client, businessId: number, accountId: number) {
  const result = await client.from("bank_transactions").select("transaction_date")
    .eq("business_id", businessId).eq("account_id", accountId)
    .order("transaction_date", { ascending: true }).limit(1).maybeSingle();
  if (result.error) throw new Error(`Unable to determine the sync window: ${result.error.message}`);
  return result.data?.transaction_date ?? null;
}

export async function createBankSyncRun(client: Client, values: {
  businessId: number;
  userId: string;
  preview: Json;
  summary: Json;
}) {
  const result = await client.from("bank_sync_runs").insert({
    business_id: values.businessId,
    provider: "simplefin",
    preview: values.preview,
    summary: values.summary,
    created_by: values.userId,
  }).select("id").single();
  if (result.error) throw new Error(`Unable to save the bank preview: ${result.error.message}`);
  return result.data.id;
}

export async function getBankSyncRun(client: Client, businessId: number, runId: string) {
  const result = await client.from("bank_sync_runs").select("*")
    .eq("business_id", businessId).eq("id", runId).maybeSingle();
  if (result.error) throw new Error(`Unable to load the bank preview: ${result.error.message}`);
  return result.data;
}

export async function listRecentBankSyncRuns(client: Client, businessId: number) {
  const result = await client.from("bank_sync_runs")
    .select("id, status, summary, result, created_at, confirmed_at")
    .eq("business_id", businessId).order("created_at", { ascending: false }).limit(10);
  if (result.error) throw new Error(`Unable to load recent bank syncs: ${result.error.message}`);
  return result.data ?? [];
}

export async function confirmBankSyncRun(client: Client, businessId: number, runId: string) {
  const result = await client.rpc("confirm_bank_sync_run", {
    target_business_id: businessId,
    target_run_id: runId,
  });
  if (result.error) throw new Error(`Unable to import bank activity: ${result.error.message}`);
  return result.data;
}

export async function disconnectBankConnection(client: Client, admin: Client, businessId: number, connectionId: string) {
  const secret = await admin.from("bank_connection_secrets").delete()
    .eq("business_id", businessId).eq("connection_id", connectionId);
  if (secret.error) throw new Error("The saved bank credential could not be removed.");
  const accounts = await client.from("bank_connection_accounts").update({ selected: false })
    .eq("business_id", businessId).eq("connection_id", connectionId);
  if (accounts.error) throw new Error(`Unable to disable connected accounts: ${accounts.error.message}`);
  const connection = await client.from("bank_connections").update({ status: "disconnected", last_error: null })
    .eq("business_id", businessId).eq("id", connectionId);
  if (connection.error) throw new Error(`Unable to disconnect the bank: ${connection.error.message}`);
}
