"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { acceptedMethodOptions, optionLabel } from "@/lib/domain/quotes";
import { convertQuoteToJob, markQuoteStatus, type QuoteFormState } from "./actions";

export function QuoteStatusActions({ quoteId, accepted, converted, priceReady, readOnly }: { quoteId: number; accepted: boolean; converted: boolean; priceReady: boolean; readOnly?: boolean }) {
  const [statusState, statusAction, pending] = useActionState(markQuoteStatus.bind(null, quoteId), {} as QuoteFormState);
  const [convertState, convertAction, converting] = useActionState(convertQuoteToJob.bind(null, quoteId), {} as QuoteFormState);
  if (converted) return <p className="text-sm text-muted">This quote has been converted and its status is locked to preserve the job link.</p>;
  if (readOnly) return <p className="text-sm text-muted">Interns have read-only access and cannot update quote status.</p>;
  if (!priceReady) return <p className="rounded-md border border-accent-border bg-accent-soft px-3 py-2 text-sm text-ink">Add a quoted price or apply an AI recommendation before sending this quote.</p>;
  return <div className="space-y-4"><form action={statusAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><select className="h-10 rounded-md border border-line-strong bg-surface px-3" name="status" required><option value="sent">Mark sent</option><option value="accepted">Mark accepted</option><option value="declined">Mark declined</option><option value="no_response">Mark no response</option><option value="expired">Mark expired</option></select><select className="h-10 rounded-md border border-line-strong bg-surface px-3" name="acceptedMethod"><option value="">Accepted method</option>{acceptedMethodOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select><button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}>{pending ? "Updating..." : "Update"}</button></form><FormFeedback message={statusState.message} tone={statusState.message === "Status updated." ? "success" : "danger"} />{accepted && !converted && <form action={convertAction}><button className="h-10 rounded-md bg-accent px-4 font-semibold text-ink disabled:opacity-60" disabled={converting}>{converting ? "Converting..." : "Convert to job"}</button></form>}<FormFeedback message={convertState.message} /></div>;
}
