"use client";

import { Trash2 } from "lucide-react";
import { useActionState } from "react";
import { deleteQuoteKnowledgeEntry, type QuoteKnowledgeFormState } from "./actions";

export function DeleteKnowledgeButton({ id }: { id: number }) {
  const [state, action, pending] = useActionState(deleteQuoteKnowledgeEntry.bind(null, id), {} as QuoteKnowledgeFormState);
  return <form action={action}>
    <button aria-label="Delete entry" className="flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-semibold text-danger disabled:opacity-60" disabled={pending} type="submit"><Trash2 size={15} />{pending ? "Deleting..." : "Delete"}</button>
    {state.message ? <p className="mt-1 text-xs text-danger">{state.message}</p> : null}
  </form>;
}
