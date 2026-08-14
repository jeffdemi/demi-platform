"use client";

import { useActionState } from "react";
import { LockKeyhole, LockOpen } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { closeAccountingPeriod, reopenAccountingPeriod, type MonthEndState } from "./actions";

export function CloseMonthForm({ periodMonth, disabled }: { periodMonth: string; disabled: boolean }) {
  const [state, action, pending] = useActionState(closeAccountingPeriod.bind(null, periodMonth), {} as MonthEndState);
  return <form action={action} className="space-y-3">
    <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || disabled}><LockKeyhole size={17} />{pending ? "Closing..." : "Close and lock month"}</button>
  </form>;
}

export function ReopenMonthForm({ periodMonth }: { periodMonth: string }) {
  const [state, action, pending] = useActionState(reopenAccountingPeriod.bind(null, periodMonth), {} as MonthEndState);
  return <form action={action} className="space-y-3">
    <label className="block text-sm font-semibold" htmlFor="reason">Reason for reopening</label>
    <textarea className="min-h-24 w-full rounded-md border border-line-strong bg-surface p-3" id="reason" name="reason" required />
    <FormFeedback message={state.message || state.errors?.reason?.[0]} tone={state.success ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold disabled:opacity-60" disabled={pending}><LockOpen size={17} />{pending ? "Reopening..." : "Reopen month"}</button>
  </form>;
}
