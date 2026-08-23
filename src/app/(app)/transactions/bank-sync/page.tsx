import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { getSimpleFinConfiguration } from "@/lib/integrations/simplefin-config";
import { listBankAccounts } from "@/lib/repositories/accounting-repository";
import { listBankConnections, listRecentBankSyncRuns } from "@/lib/repositories/bank-sync-repository";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { BankSyncControls } from "./bank-sync-controls";
import { ConnectionCard } from "./connection-card";

export const metadata: Metadata = { title: "Bank activity sync" };

function objectValue(value: Json | null, key: string) {
  if (!value || Array.isArray(value) || typeof value !== "object") return 0;
  const candidate = value[key];
  return typeof candidate === "number" ? candidate : 0;
}

export default async function BankSyncPage() {
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) redirect("/transactions");
  const client = await createClient();
  const [connections, bankAccounts, recentRuns] = await Promise.all([
    listBankConnections(client, context.business.id),
    listBankAccounts(client, context.business.id),
    listRecentBankSyncRuns(client, context.business.id),
  ]);
  let configured = false;
  try { getSimpleFinConfiguration(); configured = true; } catch { configured = false; }
  const businessAccounts = bankAccounts.filter((account) => account.active && ["checking", "savings", "credit_card"].includes(account.account_type)).map((account) => ({
    id: account.id,
    name: account.name,
    institution: account.institution,
    lastFour: account.last_four,
    accountType: account.account_type,
  }));
  const connectionProps = connections.map((connection) => ({
    id: connection.id,
    institutionName: connection.institution_name,
    status: connection.status,
    lastSyncedLabel: connection.last_synced_at ? formatDate(connection.last_synced_at.slice(0, 10)) : null,
    lastError: connection.last_error,
    accounts: connection.bank_connection_accounts.toSorted((left, right) => `${left.institution_name} ${left.provider_account_name}`.localeCompare(`${right.institution_name} ${right.provider_account_name}`)).map((account) => ({
      id: account.id,
      name: account.provider_account_name,
      institutionName: account.institution_name,
      subtype: account.provider_account_subtype,
      lastFour: account.last_four,
      bankAccountId: account.bank_account_id,
      selected: account.selected,
      status: account.provider_status,
    })),
  }));
  const hasMappedAccounts = connections.some((connection) => connection.status === "active"
    && connection.bank_connection_accounts.some((account) => account.selected && account.bank_account_id !== null));
  const hasSavedConnection = connections.some((connection) => connection.status !== "disconnected");

  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<><Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/transactions"><ArrowLeft size={17} />Transactions</Link><Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/transactions/import"><FileSpreadsheet size={17} />CSV import</Link></>} description="Pull posted transactions on demand, compare them with prior CSV imports, then confirm the safe rows." title="Bank activity sync" />
    <div className="space-y-5 pt-6">
      <BankSyncControls configured={configured} hasMappedAccounts={hasMappedAccounts} hasSavedConnection={hasSavedConnection} />
      <section><h2 className="mb-3 text-lg font-bold">Connections and account mappings</h2>{connectionProps.length ? <div className="space-y-4">{connectionProps.map((connection) => <ConnectionCard businessAccounts={businessAccounts} connection={connection} key={connection.id} />)}</div> : <div className="rounded-lg border border-dashed border-line-strong p-8 text-center text-muted">No SimpleFIN app connected yet. The connection should discover all four authorized accounts; you choose which ones belong in Demi Platform here.</div>}</section>
      {recentRuns.length ? <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Recent previews</h2></div><div className="divide-y divide-line">{recentRuns.map((run) => <Link className="grid gap-2 px-5 py-4 hover:bg-surface-muted sm:grid-cols-[180px_1fr_auto] sm:items-center" href={`/transactions/bank-sync/${run.id}`} key={run.id}><span>{formatDate(run.created_at.slice(0, 10))}</span><span className="text-sm text-muted">{objectValue(run.summary, "new")} new · {objectValue(run.summary, "existing")} already present · {objectValue(run.summary, "ambiguous")} held</span><strong>{run.status}</strong></Link>)}</div></section> : null}
      <section className="rounded-lg border border-line bg-surface-muted p-5 text-sm leading-6 text-muted"><h2 className="font-bold text-foreground">Current release boundary</h2><p className="mt-1">This is a manual transaction feed, not statement reconciliation. It does not download PDFs, move money, import balances, or automatically classify transactions. Pending bank items wait until they post. CSV import remains available as a fallback.</p></section>
    </div>
  </div>;
}
