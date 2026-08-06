"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { type ExpenseState, unvoidExpense, voidExpense } from "./actions";

export function ArchiveExpenseForm({ expenseId, archived }: { expenseId: number; archived: boolean }) {
  const action = archived ? unvoidExpense.bind(null, expenseId) : voidExpense.bind(null, expenseId);
  const [state, formAction, pending] = useActionState(action, {} as ExpenseState);
  if (archived) return <form action={formAction} className="space-y-3"><button className="h-10 rounded-md border border-line-strong px-4 font-semibold disabled:opacity-60" disabled={pending}>{pending ? "Restoring..." : "Restore record"}</button><FormFeedback message={state.message} tone={state.message?.includes("restored") ? "success" : "danger"} /></form>;
  return <form action={formAction} className="space-y-3"><label className="block text-sm font-semibold" htmlFor="reason">Archive reason</label><textarea className="min-h-20 w-full rounded-md border border-line-strong bg-surface p-3" id="reason" name="reason" required /><label className="flex items-start gap-2 text-sm"><input className="mt-1" name="confirm" required type="checkbox" value="yes" /><span>Exclude this record from financial totals. The source record and receipt will be retained.</span></label><button className="h-10 rounded-md border border-danger px-4 font-semibold text-danger disabled:opacity-60" disabled={pending}>{pending ? "Archiving..." : "Archive record"}</button><FormFeedback message={state.message} tone={state.message?.includes("archived") ? "success" : "danger"} /></form>;
}
