"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { acceptedMethodOptions, contactMethodOptions, optionLabel, propertyLocationOptions, quoteStatusLabel, type Quote } from "@/lib/domain/quotes";
import { saveQuote, type QuoteFormState } from "./actions";

export function QuoteForm({ customers, quote, today, defaultCustomerId }: { customers: { id: number; label: string; addressLine?: string }[]; quote?: Quote; today: string; defaultCustomerId?: number }) {
  const [state, action, pending] = useActionState(saveQuote.bind(null, quote?.id ?? null), {} as QuoteFormState);
  // On a failed submission the server echoes back exactly what was typed in state.values;
  // remounting the form (via key) is what makes the restored defaultValues take effect.
  const restored = state.values;
  const text = (name: string, fallback: string) => restored?.[name] ?? fallback;
  const checked = (name: string, fallback: boolean) => restored ? restored[name] === "on" : fallback;
  const [selectedCustomerId, setSelectedCustomerId] = useState(text("customerId", String(quote?.customer_id ?? defaultCustomerId ?? "")));
  const selectedCustomer = customers.find((customer) => customer.id === Number(selectedCustomerId));
  return <form action={action} className="mt-6 space-y-8" key={state.attemptId ?? "initial"}>
    <section><h2 className="border-b border-line pb-3 text-lg font-bold">Customer and quote</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field errors={state.errors?.customerId} label="Customer" name="customerId"><select className={inputClass} id="customerId" name="customerId" onChange={(event) => setSelectedCustomerId(event.target.value)} required value={selectedCustomerId}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></Field>
      <Field label="Status" name="status"><input name="status" type="hidden" value={quote?.status ?? "draft"} /><div className={`${inputClass} flex items-center bg-surface-muted font-semibold`}>{quote ? quoteStatusLabel(quote.status) : "Draft - not delivered"}</div>{quote && <p className="mt-1 text-xs text-muted">Change status from the quote&apos;s Sales actions section.</p>}</Field>
      <Field errors={state.errors?.quoteDate} label="Quote date" name="quoteDate"><input className={inputClass} defaultValue={text("quoteDate", quote?.quote_date ?? today)} id="quoteDate" name="quoteDate" required type="date" /></Field>
    </div></section>
    <section><h2 className="border-b border-line pb-3 text-lg font-bold">Location and scope</h2><div className="mt-5 grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><Field errors={state.errors?.serviceAddress} label="Service address" name="serviceAddress"><input className={inputClass} defaultValue={text("serviceAddress", quote?.service_address || selectedCustomer?.addressLine || "")} id="serviceAddress" key={`service-address-${selectedCustomerId}`} name="serviceAddress" /></Field></div>
      <Field errors={state.errors?.propertyLocation} label="Property location" name="propertyLocation"><select className={inputClass} defaultValue={text("propertyLocation", quote?.property_location ?? "")} id="propertyLocation" name="propertyLocation"><option value="">Not set</option>{propertyLocationOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></Field>
      <div className="sm:col-span-2"><Field errors={state.errors?.locationDescription} label="Location description" name="locationDescription"><textarea className={textAreaClass} defaultValue={text("locationDescription", quote?.location_description ?? "")} id="locationDescription" name="locationDescription" /></Field></div>
      <div className="sm:col-span-2"><Field errors={state.errors?.customerScope} label="Customer-facing scope" name="customerScope"><textarea className={textAreaClass} defaultValue={text("customerScope", quote?.customer_scope ?? "")} id="customerScope" name="customerScope" /></Field></div>
      <div className="sm:col-span-2"><Field errors={state.errors?.hazardNotes} label="Hazard notes" name="hazardNotes"><textarea className={textAreaClass} defaultValue={text("hazardNotes", quote?.hazard_notes ?? "")} id="hazardNotes" name="hazardNotes" /></Field></div>
      <div className="sm:col-span-2">
        <Field errors={state.errors?.specialInstructions} label="Special instructions" name="specialInstructions"><textarea className={textAreaClass} defaultValue={text("specialInstructions", quote?.special_instructions ?? "")} id="specialInstructions" name="specialInstructions" placeholder="Access notes, pricing quirks, anything that should inform the AI estimate." /></Field>
        <p className="mt-1 text-xs text-muted">Unlike internal notes, this is included when the quote is sent to the AI estimator.</p>
        <label className="mt-3 flex items-start gap-3 text-sm leading-5"><input className="mt-1 size-4 accent-brand" defaultChecked={checked("saveToKnowledgeBase", false)} name="saveToKnowledgeBase" type="checkbox" value="yes" /><span>Save this to my knowledge base so future AI estimates take it into account.</span></label>
        <p className="mt-1 text-xs text-muted">Saves the special instructions text above as a standing note the AI estimator references on future quotes. Price and scope aren&apos;t saved separately.</p>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={checked("pa811Required", quote?.pa811_required ?? false)} name="pa811Required" type="checkbox" />PA 811 required</label>
    </div></section>
    <section><h2 className="border-b border-line pb-3 text-lg font-bold">Pricing</h2><div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Field errors={state.errors?.normalPrice} label="Normal price" name="normalPrice"><input className={inputClass} defaultValue={text("normalPrice", String(quote?.normal_price ?? ""))} id="normalPrice" min="0" name="normalPrice" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.quotedPrice} label="Quoted price (optional)" name="quotedPrice"><input className={inputClass} defaultValue={text("quotedPrice", quote && quote.quoted_price > 0 ? String(quote.quoted_price) : "")} id="quotedPrice" min="0" name="quotedPrice" placeholder="Price pending" step="0.01" type="number" /></Field>
      <label className="flex min-h-11 items-center gap-3 self-end text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={checked("proBono", quote?.pro_bono ?? false)} name="proBono" type="checkbox" />Pro bono</label>
      <Field errors={state.errors?.discountReason} label="Discount reason" name="discountReason"><input className={inputClass} defaultValue={text("discountReason", quote?.discount_reason ?? "")} id="discountReason" name="discountReason" /></Field>
      <div className="sm:col-span-2"><Field errors={state.errors?.acceptanceNotes} label="Acceptance notes" name="acceptanceNotes"><textarea className={textAreaClass} defaultValue={text("acceptanceNotes", quote?.acceptance_notes ?? "")} id="acceptanceNotes" name="acceptanceNotes" /></Field></div>
    </div></section>
    <details className="rounded-lg border border-line-strong"><summary className="cursor-pointer px-5 py-3 font-semibold">Additional details</summary><div className="grid gap-5 p-5 pt-0 sm:grid-cols-2 lg:grid-cols-3">
      <Field errors={state.errors?.expirationDate} label="Expiration date" name="expirationDate"><input className={inputClass} defaultValue={text("expirationDate", quote?.expiration_date ?? "")} id="expirationDate" name="expirationDate" type="date" /></Field>
      <Field errors={state.errors?.contactMethod} label="Contact method" name="contactMethod"><select className={inputClass} defaultValue={text("contactMethod", quote?.contact_method ?? "")} id="contactMethod" name="contactMethod"><option value="">Not set</option>{contactMethodOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></Field>
      <Field errors={state.errors?.referralSource} label="Referral source" name="referralSource"><input className={inputClass} defaultValue={text("referralSource", quote?.referral_source ?? "")} id="referralSource" name="referralSource" /></Field>
      <Field errors={state.errors?.sentDate} label="Sent date" name="sentDate"><input className={inputClass} defaultValue={text("sentDate", quote?.sent_date ?? "")} id="sentDate" name="sentDate" type="date" /></Field>
      <Field errors={state.errors?.responseDate} label="Response date" name="responseDate"><input className={inputClass} defaultValue={text("responseDate", quote?.response_date ?? "")} id="responseDate" name="responseDate" type="date" /></Field>
      <Field errors={state.errors?.acceptedMethod} label="Accepted method" name="acceptedMethod"><select className={inputClass} defaultValue={text("acceptedMethod", quote?.accepted_method ?? "")} id="acceptedMethod" name="acceptedMethod"><option value="">Not set</option>{acceptedMethodOptions.map((value) => <option key={value} value={value}>{optionLabel(value)}</option>)}</select></Field>
    </div></details>
    <section><Field errors={state.errors?.internalNotes} label="Internal notes" name="internalNotes"><textarea className="min-h-36 w-full rounded-md border border-line-strong bg-surface p-3" defaultValue={text("internalNotes", quote?.internal_notes ?? "")} id="internalNotes" name="internalNotes" /></Field></section>
    <FormFeedback message={state.message} /><div className="flex gap-3 border-t border-line pt-6"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : quote ? "Save changes" : "Continue to photos & estimate"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href={quote ? `/quotes/${quote.id}` : "/quotes"}>Cancel</Link></div>
  </form>;
}
