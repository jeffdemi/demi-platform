"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { confirmBulkExpenseMatches, type BulkMatchState } from "./actions";

export function BulkMatchForm({ count }: { count: number }) {
  const [state, action, pending] = useActionState(confirmBulkExpenseMatches, {} as BulkMatchState);
  return <form action={action}>
    <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    <button className="mt-3 flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || count === 0}><CheckCircle2 size={17} />{pending ? "Matching..." : `Confirm all ${count} matches`}</button>
  </form>;
}
