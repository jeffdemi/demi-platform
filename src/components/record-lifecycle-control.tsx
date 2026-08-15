"use client";

import { useActionState } from "react";
import { Archive, RotateCcw, Trash2 } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { changeRecordLifecycle, type RecordLifecycleState, type RemovableRecordType } from "@/app/(app)/record-lifecycle-actions";

export function RecordLifecycleControl({ archived, id, label, type }: { archived: boolean; id: number; label: string; type: RemovableRecordType }) {
  const boundAction = changeRecordLifecycle.bind(null, type, id);
  const [state, action, pending] = useActionState(boundAction, {} as RecordLifecycleState);
  if (archived) return <div className="space-y-3"><p className="text-sm text-muted">This {label} is archived and excluded from normal lists.</p><form action={action}><button className="flex h-10 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold disabled:opacity-60" disabled={pending} name="intent" value="restore"><RotateCcw size={16} />{pending ? "Restoring..." : "Restore"}</button></form><FormFeedback message={state.message} tone={state.success ? "success" : "danger"} /></div>;
  return <details className="rounded-md border border-line p-3"><summary className="cursor-pointer font-semibold text-danger">Remove {label}…</summary><form action={action} className="mt-4 space-y-3"><label className="block text-sm font-semibold">Reason<textarea className="mt-1 min-h-20 w-full rounded-md border border-line-strong bg-surface p-3 font-normal" name="reason" required /></label><label className="flex items-start gap-2 text-sm"><input className="mt-1" name="confirm" required type="checkbox" value="yes" /><span>I understand this removes the record from normal lists.</span></label><div className="flex flex-wrap gap-2"><button className="flex h-10 items-center gap-2 rounded-md border border-danger px-4 font-semibold text-danger disabled:opacity-60" disabled={pending} name="intent" value="archive"><Archive size={16} />{pending ? "Working..." : "Archive"}</button><button className="flex h-10 items-center gap-2 rounded-md bg-danger px-4 font-semibold text-white disabled:opacity-60" disabled={pending} name="intent" value="delete"><Trash2 size={16} />Permanently delete if safe</button></div><p className="text-xs leading-5 text-muted">Permanent deletion is blocked when linked accounting or operational records exist.</p><FormFeedback message={state.message} tone={state.success ? "success" : "danger"} /></form></details>;
}
