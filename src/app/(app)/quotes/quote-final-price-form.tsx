"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import type { Quote } from "@/lib/domain/quotes";
import { setQuoteFinalPrice, type QuoteFormState } from "./actions";

export function QuoteFinalPriceForm({ quote, suggestedPrice, readOnly }: { quote: Quote; suggestedPrice: number | null; readOnly?: boolean }) {
  const [state, action, pending] = useActionState(setQuoteFinalPrice.bind(null, quote.id), {} as QuoteFormState);
  const startingPrice = quote.quoted_price > 0 ? quote.quoted_price : suggestedPrice ?? "";
  if (readOnly) return null;
  return <form action={action} className="mt-5 space-y-4 rounded-lg border border-line bg-surface p-5 shadow-sm">
    <h2 className="font-bold">Final price</h2>
    <p className="text-sm text-muted">This is the number of record — it stays separate from the AI&apos;s estimate above and is never overwritten automatically.</p>
    <div className="grid gap-4 sm:grid-cols-2">
      <Field errors={state.errors?.normalPrice} label="Normal price" name="normalPrice"><input className={inputClass} defaultValue={quote.normal_price ?? ""} id="normalPrice" min="0" name="normalPrice" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.quotedPrice} label="Final price" name="quotedPrice"><input className={inputClass} defaultValue={startingPrice} id="quotedPrice" min="0" name="quotedPrice" placeholder="Price pending" step="0.01" type="number" /></Field>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={quote.pro_bono} name="proBono" type="checkbox" />Pro bono</label>
      <Field errors={state.errors?.discountReason} label="Discount reason" name="discountReason"><input className={inputClass} defaultValue={quote.discount_reason ?? ""} id="discountReason" name="discountReason" /></Field>
    </div>
    <FormFeedback message={state.message} tone={state.message === "Final price saved." ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending} type="submit"><Save size={17} />{pending ? "Saving..." : "Save final price"}</button>
  </form>;
}
