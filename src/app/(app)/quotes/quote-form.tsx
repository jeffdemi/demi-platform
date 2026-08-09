"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { acceptedMethodOptions, contactMethodOptions, optionLabel, propertyLocationOptions, quoteStatusOptions, type Quote } from "@/lib/domain/quotes";
import { saveQuote, type QuoteFormState } from "./actions";

export function QuoteForm({ customers, quote, today, defaultCustomerId }: { customers: { id: number; label: string }[]; quote?: Quote; today: string; defaultCustomerId?: number }) {
  const [state, action, pending] = useActionState(saveQuote.bind(null, quote?.id ?? null), {} as QuoteFormState);
  return <form action={action} className="mt-6 space-y-8">
    <section><h2 className="border-b border-line pb-3 text-lg font-bold">Customer and quote</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field errors={state.errors?.customerId} label="Customer" name="customerId"><select className={inputClass} defaultValue={quote?.customer_id ?? defaultCustomerId ?? ""} id="customerId" name="customerId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></Field>
      {quote ? <Field errors={state.errors?.status} label="Status" name="status"><select className={inputClass} defaultValue={quote.status} id="status" name="status">{quoteStatusOptions.filter((status) => status.value !== "converted" || quote.status === "converted").map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field> : <Field label="Status" name="status"><input name="status" type="hidden" value="draft" /><div className={`${inputClass} flex items-center bg-surface-muted font-semibold`}>Draft - not delivered</div></Field>}
      <Field errors={state.errors?.quoteDate} label="Quote date" name="quoteDate"><input className={inputClass} defaultValue={quote?.quote_date ?? today} id="quoteDate" name="quoteDate" required type="date" /></Field>
      <Field errors={state.errors?.expirationDate} label="Expiration date" name="expirationDate"><input className={inputClass} defaultValue={quote?.expiration_date ?? ""} id="expirationDate" name="expirationDate" type="date" /></Field>
      <Field errors={state.errors?.contactMethod} label="Contact method" name="contactMethod"><select className={inputClass} defaultValue={quote?.contact_method ?? ""} id="contactMethod" name="contactMethod"><option value="">Not set</option>{contactMethodOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></Field>
      <Field errors={state.errors?.referralSource} label="Referral source" name="referralSource"><input className={inputClass} defaultValue={quote?.referral_source ?? ""} id="referralSource" name="referralSource" /></Field>
    </div></section>
    <section><h2 className="border-b border-line pb-3 text-lg font-bold">Location and scope</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field errors={state.errors?.serviceAddress} label="Service address" name="serviceAddress"><input className={inputClass} defaultValue={quote?.service_address ?? ""} id="serviceAddress" name="serviceAddress" /></Field></div>
      <Field errors={state.errors?.municipality} label="Municipality" name="municipality"><input className={inputClass} defaultValue={quote?.municipality ?? ""} id="municipality" name="municipality" /></Field>
      <Field errors={state.errors?.propertyLocation} label="Property location" name="propertyLocation"><select className={inputClass} defaultValue={quote?.property_location ?? ""} id="propertyLocation" name="propertyLocation"><option value="">Not set</option>{propertyLocationOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></Field>
      <div className="sm:col-span-2"><Field errors={state.errors?.locationDescription} label="Location description" name="locationDescription"><textarea className={textAreaClass} defaultValue={quote?.location_description ?? ""} id="locationDescription" name="locationDescription" /></Field></div>
      <div className="sm:col-span-2"><Field errors={state.errors?.customerScope} label="Customer-facing scope" name="customerScope"><textarea className={textAreaClass} defaultValue={quote?.customer_scope ?? ""} id="customerScope" name="customerScope" /></Field></div>
      <div className="sm:col-span-2"><Field errors={state.errors?.hazardNotes} label="Hazard notes" name="hazardNotes"><textarea className={textAreaClass} defaultValue={quote?.hazard_notes ?? ""} id="hazardNotes" name="hazardNotes" /></Field></div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={quote?.pa811_required ?? false} name="pa811Required" type="checkbox" />PA 811 required</label>
    </div></section>
    <section><h2 className="border-b border-line pb-3 text-lg font-bold">Pricing and response</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field errors={state.errors?.normalPrice} label="Normal price" name="normalPrice"><input className={inputClass} defaultValue={quote?.normal_price ?? ""} id="normalPrice" min="0" name="normalPrice" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.quotedPrice} label="Quoted price (optional)" name="quotedPrice"><input className={inputClass} defaultValue={quote && quote.quoted_price > 0 ? quote.quoted_price : ""} id="quotedPrice" min="0" name="quotedPrice" placeholder="Price pending" step="0.01" type="number" /></Field>
      <label className="flex min-h-11 items-center gap-3 self-end text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={quote?.pro_bono ?? false} name="proBono" type="checkbox" />Pro bono</label>
      <Field errors={state.errors?.discountReason} label="Discount reason" name="discountReason"><input className={inputClass} defaultValue={quote?.discount_reason ?? ""} id="discountReason" name="discountReason" /></Field>
      <Field errors={state.errors?.sentDate} label="Sent date" name="sentDate"><input className={inputClass} defaultValue={quote?.sent_date ?? ""} id="sentDate" name="sentDate" type="date" /></Field>
      <Field errors={state.errors?.responseDate} label="Response date" name="responseDate"><input className={inputClass} defaultValue={quote?.response_date ?? ""} id="responseDate" name="responseDate" type="date" /></Field>
      <Field errors={state.errors?.acceptedMethod} label="Accepted method" name="acceptedMethod"><select className={inputClass} defaultValue={quote?.accepted_method ?? ""} id="acceptedMethod" name="acceptedMethod"><option value="">Not set</option>{acceptedMethodOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></Field>
      <div className="sm:col-span-2"><Field errors={state.errors?.acceptanceNotes} label="Acceptance notes" name="acceptanceNotes"><textarea className={textAreaClass} defaultValue={quote?.acceptance_notes ?? ""} id="acceptanceNotes" name="acceptanceNotes" /></Field></div>
    </div></section>
    <section><Field errors={state.errors?.internalNotes} label="Internal notes" name="internalNotes"><textarea className="min-h-36 w-full rounded-md border border-line-strong bg-surface p-3" defaultValue={quote?.internal_notes ?? ""} id="internalNotes" name="internalNotes" /></Field></section>
    <FormFeedback message={state.message} /><div className="flex gap-3 border-t border-line pt-6"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : quote ? "Save changes" : "Continue to photos & estimate"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href={quote ? `/quotes/${quote.id}` : "/quotes"}>Cancel</Link></div>
  </form>;
}
