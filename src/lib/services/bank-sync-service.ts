import type { SupabaseClient } from "@supabase/supabase-js";
import {
  bankSyncImportSha256,
  addDays,
  reconcileBankTransactions,
  simpleFinDateWindows,
  subtractDays,
  type BankSyncAccountPreview,
  type BankSyncPreview,
  type BankSyncSummary,
} from "@/lib/domain/bank-sync";
import { getSimpleFinConfiguration } from "@/lib/integrations/simplefin-config";
import {
  claimSimpleFinSetupToken,
  getSimpleFinAccountSet,
  simpleFinTransactions,
  simpleFinWarnings,
  type SimpleFinAccount,
} from "@/lib/integrations/simplefin";
import {
  createBankSyncRun,
  disconnectBankConnection,
  getBankConnectionSecret,
  getFirstBankTransactionDate,
  listBankConnections,
  listBankTransactionsForSync,
  saveSimpleFinAccounts,
  saveSimpleFinCredential,
  simpleFinAccountKey,
  updateBankConnectionHealth,
} from "@/lib/repositories/bank-sync-repository";
import { decryptBankAccessToken, encryptBankAccessToken } from "@/lib/security/bank-secrets";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;

function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

function startOfCurrentYear() {
  return `${new Date().getUTCFullYear()}-01-01`;
}

async function markConnectionError(client: Client, businessId: number, connectionId: string, error: unknown) {
  const message = error instanceof Error ? error.message : "The SimpleFIN connection needs attention.";
  try {
    await updateBankConnectionHealth(client, businessId, connectionId, { status: "error", lastError: message.slice(0, 1000) });
  } catch {
    // Preserve the provider error, which is the actionable failure for the user.
  }
  return message;
}

export async function refreshSimpleFinAccounts(values: {
  client: Client;
  admin: Client;
  businessId: number;
  connectionId: string;
}) {
  const configuration = getSimpleFinConfiguration();
  try {
    const [encryptedAccessUrl, connections] = await Promise.all([
      getBankConnectionSecret(values.admin, values.businessId, values.connectionId),
      listBankConnections(values.client, values.businessId),
    ]);
    const connection = connections.find((candidate) => candidate.id === values.connectionId && candidate.provider === "simplefin");
    if (!connection) throw new Error("This SimpleFIN connection is no longer available.");
    const accessUrl = decryptBankAccessToken(encryptedAccessUrl, configuration.encryptionKey);
    const accountSet = await getSimpleFinAccountSet(accessUrl, { balancesOnly: true });
    const warnings = simpleFinWarnings(accountSet);
    if (!accountSet.accounts.length) {
      throw new Error(warnings[0] || "SimpleFIN did not return any accounts. Check the connections under My Account in SimpleFIN.");
    }
    const existingMappings = new Map(connection.bank_connection_accounts.flatMap((account) =>
      account.bank_account_id === null ? [] : [[simpleFinAccountKey(account.provider_institution_connection_id, account.provider_account_id), account.bank_account_id] as const],
    ));
    await saveSimpleFinAccounts(values.client, {
      businessId: values.businessId,
      connectionId: values.connectionId,
      accountSet,
      accountMappings: existingMappings,
    });
    await updateBankConnectionHealth(values.client, values.businessId, values.connectionId, {
      status: "active",
      lastError: warnings.length ? warnings.join(" ").slice(0, 1000) : null,
    });
    return { accountCount: accountSet.accounts.length, warnings };
  } catch (error) {
    const message = await markConnectionError(values.client, values.businessId, values.connectionId, error);
    throw new Error(message);
  }
}

export async function connectSimpleFinSetupToken(values: {
  client: Client;
  admin: Client;
  businessId: number;
  userId: string;
  setupToken: string;
}) {
  const configuration = getSimpleFinConfiguration();
  const accessUrl = await claimSimpleFinSetupToken(values.setupToken);
  const connectionId = await saveSimpleFinCredential(values.client, values.admin, {
    businessId: values.businessId,
    userId: values.userId,
    encryptedAccessUrl: encryptBankAccessToken(accessUrl, configuration.encryptionKey),
  });
  try {
    const refresh = await refreshSimpleFinAccounts({ ...values, connectionId });
    return { connectionId, ...refresh };
  } catch (error) {
    const message = error instanceof Error ? error.message : "SimpleFIN account discovery failed.";
    throw new Error(`The secure access was saved, but the account list could not refresh: ${message}`);
  }
}

type MappedConnectionAccount = Awaited<ReturnType<typeof listBankConnections>>[number]["bank_connection_accounts"][number];

function mergeProviderAccounts(target: Map<string, SimpleFinAccount>, accounts: SimpleFinAccount[]) {
  for (const account of accounts) {
    const key = simpleFinAccountKey(account.conn_id, account.id);
    const previous = target.get(key);
    if (!previous) {
      target.set(key, { ...account, transactions: [...account.transactions] });
      continue;
    }
    const transactions = new Map(previous.transactions.map((transaction) => [transaction.id, transaction]));
    for (const transaction of account.transactions) transactions.set(transaction.id, transaction);
    target.set(key, { ...account, transactions: [...transactions.values()] });
  }
}

async function previewConnection(values: {
  client: Client;
  admin: Client;
  businessId: number;
  connection: Awaited<ReturnType<typeof listBankConnections>>[number];
}) {
  const configuration = getSimpleFinConfiguration();
  const mappedAccounts = values.connection.bank_connection_accounts.filter((account) =>
    account.selected && account.bank_account_id !== null && account.provider_status === "open",
  );
  if (!mappedAccounts.length) return [];

  const starts = new Map<string, string>();
  await Promise.all(mappedAccounts.map(async (account) => {
    const firstExisting = await getFirstBankTransactionDate(values.client, values.businessId, account.bank_account_id!);
    const startDate = account.last_synced_at
      ? subtractDays(account.last_synced_at.slice(0, 10), 5)
      : firstExisting ? subtractDays(firstExisting, 5) : startOfCurrentYear();
    starts.set(account.id, startDate);
  }));
  const earliestStart = [...starts.values()].sort()[0];
  const today = isoToday();
  const endDateExclusive = addDays(today, 1);
  const encryptedAccessUrl = await getBankConnectionSecret(values.admin, values.businessId, values.connection.id);
  const accessUrl = decryptBankAccessToken(encryptedAccessUrl, configuration.encryptionKey);
  const providerAccounts = new Map<string, SimpleFinAccount>();
  const warnings: string[] = [];
  for (const window of simpleFinDateWindows(earliestStart, endDateExclusive)) {
    const accountSet = await getSimpleFinAccountSet(accessUrl, { ...window, includePending: true });
    warnings.push(...simpleFinWarnings(accountSet));
    mergeProviderAccounts(providerAccounts, accountSet.accounts);
  }
  if (warnings.length) throw new Error(`SimpleFIN reported: ${[...new Set(warnings)].join(" ")}`);

  const previewAccounts: BankSyncAccountPreview[] = [];
  for (const account of mappedAccounts) {
    previewAccounts.push(await previewMappedAccount(values, account, providerAccounts, starts.get(account.id)!, today));
  }
  return previewAccounts;
}

async function previewMappedAccount(
  values: { client: Client; businessId: number },
  account: MappedConnectionAccount,
  providerAccounts: Map<string, SimpleFinAccount>,
  startDate: string,
  endDate: string,
) {
  const key = simpleFinAccountKey(account.provider_institution_connection_id, account.provider_account_id);
  const providerAccount = providerAccounts.get(key);
  if (!providerAccount) throw new Error(`${account.institution_name} did not return ${account.provider_account_name}. Refresh the account list and check its mapping.`);
  const providerTransactions = simpleFinTransactions(providerAccount).filter((transaction) => transaction.transactionDate >= startDate && transaction.transactionDate <= endDate);
  const existingTransactions = await listBankTransactionsForSync(values.client, values.businessId, account.bank_account_id!, startDate, endDate);
  const reconciliation = reconcileBankTransactions("simplefin", providerTransactions, existingTransactions, account.bank_account_id!);
  return {
    connectionId: account.connection_id,
    connectionAccountId: account.id,
    providerAccountId: account.provider_account_id,
    providerInstitutionConnectionId: account.provider_institution_connection_id,
    bankAccountId: account.bank_account_id!,
    accountName: account.provider_account_name,
    institutionName: account.institution_name,
    importName: `SimpleFIN sync · ${account.institution_name} · ${account.provider_account_name} · ${endDate}`,
    importSha256: bankSyncImportSha256("simplefin", key, reconciliation.rows),
    startDate,
    endDate,
    rows: reconciliation.rows,
    summary: reconciliation.summary,
  } satisfies BankSyncAccountPreview;
}

export async function buildBankSyncPreview(values: {
  client: Client;
  admin: Client;
  businessId: number;
  userId: string;
}) {
  const connections = await listBankConnections(values.client, values.businessId);
  const activeConnections = connections.filter((connection) => connection.status === "active" && connection.provider === "simplefin");
  const previewAccounts: BankSyncAccountPreview[] = [];

  for (const connection of activeConnections) {
    try {
      previewAccounts.push(...await previewConnection({ ...values, connection }));
      await updateBankConnectionHealth(values.client, values.businessId, connection.id, { status: "active", lastError: null });
    } catch (error) {
      const message = await markConnectionError(values.client, values.businessId, connection.id, error);
      throw new Error(`${connection.institution_name}: ${message}`);
    }
  }
  if (!previewAccounts.length) throw new Error("Map at least one connected business account before importing activity.");

  const summary = previewAccounts.reduce<BankSyncSummary>((totals, account) => {
    for (const outcome of ["existing", "new", "ambiguous", "pending"] as const) totals[outcome] += account.summary[outcome];
    return totals;
  }, { existing: 0, new: 0, ambiguous: 0, pending: 0 });
  const preview: BankSyncPreview = { generatedAt: new Date().toISOString(), accounts: previewAccounts };
  return createBankSyncRun(values.client, {
    businessId: values.businessId,
    userId: values.userId,
    preview: preview as unknown as Json,
    summary: summary as unknown as Json,
  });
}

export async function disconnectSimpleFinConnection(values: {
  client: Client;
  admin: Client;
  businessId: number;
  connectionId: string;
}) {
  await disconnectBankConnection(values.client, values.admin, values.businessId, values.connectionId);
}
