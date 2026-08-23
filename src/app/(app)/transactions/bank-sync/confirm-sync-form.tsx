"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { confirmLatestBankActivity, type BankSyncActionState } from "./actions";

export function ConfirmSyncForm({ runId, disabled }: { runId: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(confirmLatestBankActivity.bind(null, runId), {} as BankSyncActionState);
  return <div className="space-y-3"><form action={action}><button className="h-11 rounded-md bg-brand px-5 font-semibold text-on-brand disabled:opacity-50" disabled={disabled || pending}>{pending ? "Importing..." : "Confirm and import safe rows"}</button></form><FormFeedback message={state.message} tone={state.success ? "success" : "danger"} /></div>;
}
