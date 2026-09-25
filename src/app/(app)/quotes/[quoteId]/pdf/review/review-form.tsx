"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { formatCurrency } from "@/lib/format";
import type { QuotePdfReviewValues } from "@/lib/quote-pdf-review";
import { saveReview, type ReviewState } from "./actions";

type Props = { quoteId: number; initial: QuotePdfReviewValues; versions: { quote: string; customer: string; business: string }; canEditBusiness: boolean };
const highlight = "rounded-lg border border-brand-border bg-brand-soft/40 p-3";
export function ReviewForm(props: Props) {
  const [state, action, pending] = useActionState(saveReview.bind(null, props.quoteId), {} as ReviewState);
  if (state.pdf) return <section aria-live="polite" className="mt-6 rounded-lg border border-brand-border bg-brand-soft p-6">
    <h2 className="text-xl font-bold">Changes saved. Your PDF is ready.</h2>
    <p className="mt-2 text-sm">The quote and shared customer and business records now contain your saved edits.</p>
    <a className="mt-5 inline-flex rounded-md bg-brand px-5 py-3 font-semibold text-on-brand" download={`quote-${props.quoteId}.pdf`} href={`data:application/pdf;base64,${state.pdf}`}>Download PDF</a>
    <Link className="ml-4 font-semibold text-brand hover:underline" href={`/quotes/${props.quoteId}?step=2`}>Return to quote</Link>
  </section>;
  return <ReviewFields {...props} action={action} pending={pending} state={state} key={state.attemptId ?? "initial"} />;
}
function ReviewFields({ initial, versions, canEditBusiness, quoteId, action, pending, state }: Props & { action: (form: FormData) => void; pending: boolean; state: ReviewState }) {
  const [values, setValues] = useState<Record<string, string>>(() => state.values ?? Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, typeof v === "boolean" ? v ? "on" : "" : String(v)])));
  const change = (name: string, value: string) => setValues(previous => ({ ...previous, [name]: value }));
  function field(name: keyof QuotePdfReviewValues, label: string, options: { multiline?: boolean; type?: string; required?: boolean; business?: boolean } = {}) {
    const shared = { id: name, name, value: values[name] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(name, event.target.value), readOnly: options.business && !canEditBusiness, required: options.required, "aria-invalid": Boolean(state.errors?.[name]) };
    return <div className={highlight} key={name}><Field errors={state.errors?.[name]} label={label} name={name}>{options.multiline ? <textarea {...shared} className={textAreaClass} rows={4} /> : <input {...shared} className={inputClass} type={options.type ?? "text"} {...(options.type === "number" ? { min: 0, step: "0.01" } : {})} />}</Field></div>;
  }
  const price = Number(values.quoted_price);
  const proBono = values.pro_bono === "on";
  return <form action={action} className="mt-6 space-y-6">
    <input name="quote_version" type="hidden" value={versions.quote} />
    <input name="customer_version" type="hidden" value={versions.customer} />
    <input name="business_version" type="hidden" value={versions.business} />
    <div className="rounded-lg border border-line bg-surface p-4 text-sm">Saving updates this quote and any edited customer or business records everywhere they are used. Internal notes and AI observations are not included in the PDF.</div>
    <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">Business details</h2>
        {!canEditBusiness && <p className="mt-2 text-sm text-muted">Only owners and administrators can change business details. You can still review them here.</p>}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("business_name", "Business name", { required: true, business: true })}
          {field("legal_name", "Legal name", { business: true })}
          {field("business_phone", "Business phone", { business: true, type: "tel" })}
          {field("business_email", "Business email", { business: true, type: "email" })}
          {field("address_line_1", "Business street address", { business: true })}
          {field("address_line_2", "Address line 2", { business: true })}
          {field("city", "City", { business: true })}{field("region", "State / region", { business: true })}{field("postal_code", "Postal code", { business: true })}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">Customer</h2>
        <p className="mt-1 text-sm text-muted">The PDF uses the company name for companies, or the first and last name for individuals.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className={highlight}><Field label="Customer type" name="customer_type"><select className={inputClass} id="customer_type" name="customer_type" value={values.customer_type} onChange={event => change("customer_type", event.target.value)}><option value="individual">Individual</option><option value="company">Company</option></select></Field></div>
          {values.customer_type === "company" ? field("company_name", "Company name", { required: true }) : <>{field("first_name", "First name")}{field("last_name", "Last name")}</>}
          {values.customer_type === "company" ? <><input type="hidden" name="first_name" value={values.first_name ?? ""} /><input type="hidden" name="last_name" value={values.last_name ?? ""} /></> : <input type="hidden" name="company_name" value={values.company_name ?? ""} />}
          {field("customer_phone", "Customer phone", { type: "tel" })}{field("customer_email", "Customer email", { type: "email" })}
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">Quote details</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("quote_number", "Quote number", { required: true })}{field("quote_date", "Quote date", { type: "date", required: true })}
          {field("expiration_date", "Valid through", { type: "date" })}{field("service_address", "Service address")}
          {field("property_location", "Property location")}{field("location_description", "Location details", { multiline: true })}
          <div className="sm:col-span-2">{field("customer_scope", "Scope of work", { multiline: true, required: true })}</div>
        </div>
      </section>
      <section className="rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">Price</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {field("quoted_price", "Final quoted price", { type: "number", required: true })}
          <label className={`${highlight} flex items-center gap-3 font-semibold`}><input className="size-5 accent-brand" name="pro_bono" type="checkbox" checked={proBono} onChange={event => change("pro_bono", event.target.checked ? "on" : "")} />Pro bono — no charge</label>
        </div>
        <p aria-live="polite" className="mt-4 text-lg font-bold">Quote total: {proBono ? "$0.00 (no charge)" : Number.isFinite(price) && price > 0 ? formatCurrency(price) : "Enter a final price"}</p>
      </section>
      <section className="space-y-3 rounded-xl border border-line bg-surface p-5">
        <h2 className="text-lg font-bold">Customer-facing text</h2>
        {field("pdf_terms", "Terms and acceptance instructions", { multiline: true })}
        {field("pdf_notes", "Notes shown on the PDF", { multiline: true })}
      </section>
    </fieldset>
    <FormFeedback message={state.message} />
    <div className="flex flex-wrap items-center gap-4 border-t border-line pt-5">
      <button className="rounded-md bg-brand px-5 py-3 font-semibold text-on-brand disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving & generating…" : "Save changes & Generate PDF"}</button>
      <Link className="font-semibold text-muted hover:underline" href={`/quotes/${quoteId}?step=2`}>Cancel</Link>
    </div>
  </form>;
}
