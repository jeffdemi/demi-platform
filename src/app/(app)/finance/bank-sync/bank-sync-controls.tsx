"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ExternalLink, KeyRound, RefreshCw } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { connectSimpleFin, previewLatestBankActivity, type BankSyncActionState } from "./actions";

export function BankSyncControls({
  configured,
  hasMappedAccounts,
}: {
  configured: boolean;
  hasMappedAccounts: boolean;
}) {
  const [connectState, connectAction, connectPending] = useActionState(connectSimpleFin, {} as BankSyncActionState);
  const [previewState, previewAction, previewPending] = useActionState(previewLatestBankActivity, {} as BankSyncActionState);

  return <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
    <div>
      <h2 className="font-bold">Bank activity sync</h2>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">SimpleFIN will return every account you authorized—including Chase checking, the Chase credit card, and Bank of America accounts. Map each business account below and leave any personal account set to “Do not import.” Nothing enters Finance until you approve a preview.</p>
    </div>
    <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-md border border-line bg-surface-muted p-4">
        <h3 className="font-semibold">1. Create and paste a secure Setup Token</h3>
        <p className="mt-1 text-sm leading-6 text-muted">Open SimpleFIN, name the app “Demi Platform,” create the one-time token, then paste it here. Never send this token in chat or a screenshot.</p>
        <Link className="mt-3 inline-flex h-10 items-center gap-2 rounded-md border border-line-strong bg-surface px-3 font-semibold" href="https://bridge.simplefin.org/simplefin/create" rel="noreferrer" target="_blank">Open SimpleFIN <ExternalLink size={15} /></Link>
        <form action={connectAction} className="mt-4 space-y-3">
          <label className="block text-sm font-semibold" htmlFor="simplefin-setup-token">One-time Setup Token</label>
          <textarea autoCapitalize="none" autoComplete="off" className="min-h-24 w-full rounded-md border border-line-strong bg-surface px-3 py-2 font-mono text-sm" id="simplefin-setup-token" maxLength={4096} name="setupToken" required spellCheck={false} />
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-50" disabled={!configured || connectPending}><KeyRound size={16} />{connectPending ? "Connecting securely..." : "Connect SimpleFIN"}</button>
          <FormFeedback message={connectState.message} tone={connectState.success ? "success" : "danger"} />
        </form>
      </div>
      <div className="rounded-md border border-line bg-surface-muted p-4">
        <h3 className="font-semibold">2. Preview the latest activity</h3>
        <p className="mt-1 text-sm leading-6 text-muted">After saving the account mappings below, fetch recent activity. Existing CSV rows are identified first so re-importing does not duplicate them.</p>
        <form action={previewAction} className="mt-4">
          <button className="inline-flex h-10 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-50" disabled={!configured || !hasMappedAccounts || previewPending}><RefreshCw size={16} />{previewPending ? "Checking..." : "Import latest bank activity"}</button>
        </form>
        {!hasMappedAccounts ? <p className="mt-3 text-sm text-muted">Connect SimpleFIN and map at least one business account first.</p> : null}
        <div className="mt-3 space-y-3"><FormFeedback message={previewState.message} tone={previewState.success ? "success" : "danger"} />{previewState.runId ? <Link className="inline-flex h-10 items-center rounded-md border border-line-strong bg-surface px-4 font-semibold" href={`/finance/bank-sync/${previewState.runId}`}>Review safe preview</Link> : null}</div>
      </div>
    </div>
    {!configured ? <div className="mt-4 rounded-md border border-warning-line bg-warning-soft p-3 text-sm">Bank sync is not configured on this deployment. Add the server-only encryption key documented in the operations guide.</div> : null}
  </section>;
}
