"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { inputClass } from "@/components/form-fields";
import { disconnectConnection, refreshConnectionAccounts, saveConnectionMappings, type BankSyncActionState } from "./actions";

type BusinessAccount = { id: number; name: string; institution: string | null; lastFour: string | null; accountType: string };
type ConnectedAccount = { id: string; name: string; institutionName: string; subtype: string; lastFour: string | null; bankAccountId: number | null; selected: boolean; status: string };

export function ConnectionCard({ connection, businessAccounts }: {
  connection: { id: string; institutionName: string; status: string; lastSyncedLabel: string | null; lastError: string | null; accounts: ConnectedAccount[] };
  businessAccounts: BusinessAccount[];
}) {
  const [mappingState, mappingAction, mappingPending] = useActionState(saveConnectionMappings.bind(null, connection.id), {} as BankSyncActionState);
  const [refreshState, refreshAction, refreshPending] = useActionState(refreshConnectionAccounts.bind(null, connection.id), {} as BankSyncActionState);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(disconnectConnection.bind(null, connection.id), {} as BankSyncActionState);
  return <article className="rounded-lg border border-line bg-surface p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-bold">{connection.institutionName}</h3><p className="mt-1 text-sm text-muted">{connection.status} · {connection.accounts.length} accounts found{connection.lastSyncedLabel ? ` · last imported ${connection.lastSyncedLabel}` : " · not imported yet"}</p></div><form action={refreshAction}><button className="inline-flex h-10 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold disabled:opacity-50" disabled={refreshPending}><RefreshCw size={15} />{refreshPending ? "Refreshing..." : "Refresh account list"}</button></form></div>
    {connection.lastError ? <p className="mt-3 rounded-md border border-warning-line bg-warning-soft p-3 text-sm">{connection.lastError}</p> : null}
    <FormFeedback message={refreshState.message} tone={refreshState.success ? "success" : "danger"} />
    <form action={mappingAction} className="mt-5 space-y-4">
      {connection.accounts.map((account) => <label className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_minmax(260px,1fr)] sm:items-center" key={account.id}><span><strong className="block">{account.institutionName} · {account.name}{account.lastFour ? ` · ${account.lastFour}` : ""}</strong><span className="text-sm text-muted">{account.subtype.replaceAll("_", " ")} · {account.status}</span></span><select className={inputClass} defaultValue={account.selected ? account.bankAccountId ?? "" : ""} name={`mapping_${account.id}`}><option value="">Do not import this account</option>{businessAccounts.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.lastFour ? ` · ${candidate.lastFour}` : ""}</option>)}</select></label>)}
      <div className="flex flex-wrap items-center gap-3"><button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-50" disabled={mappingPending || connection.status !== "active"}>{mappingPending ? "Saving..." : "Save account mappings"}</button><span className="text-xs text-muted">Leave personal or unrelated accounts set to “Do not import.”</span></div>
      <FormFeedback message={mappingState.message} tone={mappingState.success ? "success" : "danger"} />
    </form>
    {connection.status !== "disconnected" ? <details className="mt-5 border-t border-line pt-4"><summary className="cursor-pointer font-semibold text-danger-strong">Disconnect SimpleFIN…</summary><form action={disconnectAction} className="mt-3 space-y-3"><label className="flex items-start gap-2 text-sm"><input className="mt-1" name="confirm" type="checkbox" value="yes" />Remove Demi Platform’s encrypted Access URL and disable all mappings. Imported transactions remain. Then revoke this app under SimpleFIN My Account.</label><button className="h-10 rounded-md border border-danger-line px-4 font-semibold text-danger-strong disabled:opacity-50" disabled={disconnectPending}>{disconnectPending ? "Disconnecting..." : "Disconnect"}</button><FormFeedback message={disconnectState.message} tone={disconnectState.success ? "success" : "danger"} /></form></details> : null}
  </article>;
}
