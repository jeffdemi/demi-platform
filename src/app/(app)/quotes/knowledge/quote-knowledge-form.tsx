"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import type { QuoteKnowledge } from "@/lib/domain/quote-knowledge";
import { saveQuoteKnowledge, type QuoteKnowledgeFormState } from "./actions";

export function QuoteKnowledgeForm({ entry }: { entry?: QuoteKnowledge }) {
  const [state, action, pending] = useActionState(saveQuoteKnowledge.bind(null, entry?.id ?? null), {} as QuoteKnowledgeFormState);
  return <form action={action} className="mt-6 space-y-5">
    <Field errors={state.errors?.title} label="Title" name="title"><input className={inputClass} defaultValue={entry?.title ?? ""} id="title" maxLength={200} name="title" required /></Field>
    <Field errors={state.errors?.body} label="Body" name="body"><textarea className={`${textAreaClass} min-h-48`} defaultValue={entry?.body ?? ""} id="body" maxLength={5000} name="body" placeholder="A pricing rule, a standing assumption, anything the AI estimator should apply to every quote." required /></Field>
    <Field errors={state.errors?.tags} label="Tags (comma-separated, optional)" name="tags"><input className={inputClass} defaultValue={entry?.tags?.join(", ") ?? ""} id="tags" name="tags" placeholder="pricing, access, equipment" /></Field>
    <FormFeedback message={state.message} />
    <div className="flex gap-3 border-t border-line pt-6">
      <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : "Save entry"}</button>
      <Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href="/quotes/knowledge">Cancel</Link>
    </div>
  </form>;
}
