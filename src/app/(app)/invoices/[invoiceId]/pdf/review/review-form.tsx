"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import type { InvoicePdfReviewValues } from "@/lib/invoice-pdf-review";
import { saveReview, type InvoiceReviewState } from "./actions";

type Props = { invoiceId: number; initial: InvoicePdfReviewValues; versions: { invoice: string; customer: string; business: string }; canEditBusiness: boolean };
const highlight = "rounded-lg border border-brand-border bg-brand-soft/40 p-3";

export function ReviewForm(props: Props) {
  const [state, action, pending] = useActionState(saveReview.bind(null, props.invoiceId), {} as InvoiceReviewState);
  if (state.pdf) return <section aria-live="polite" className="mt-6 rounded-lg border border-brand-border bg-brand-soft p-6"><h2 className="text-xl font-bold">Changes saved. Your PDF is ready.</h2><p className="mt-2 text-sm">The invoice and shared customer and business records now contain your saved edits.</p><a className="mt-5 inline-flex rounded-md bg-brand px-5 py-3 font-semibold text-on-brand" download={`invoice-${props.invoiceId}.pdf`} href={`data:application/pdf;base64,${state.pdf}`}>Download PDF</a><Link className="ml-4 font-semibold text-brand hover:underline" href={`/invoices/${props.invoiceId}`}>Return to invoice</Link></section>;
  return <ReviewFields {...props} action={action} pending={pending} state={state} key={state.attemptId ?? "initial"} />;
}

function ReviewFields({ initial, versions, canEditBusiness, invoiceId, action, pending, state }: Props & { action: (form: FormData) => void; pending: boolean; state: InvoiceReviewState }) {
  const [values, setValues] = useState<Record<string, string>>(() => state.values ?? Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, String(value)])));
  const change = (name: string, value: string) => setValues(previous => ({ ...previous, [name]: value }));
  function field(name: keyof InvoicePdfReviewValues, label: string, options: { multiline?: boolean; type?: string; required?: boolean; business?: boolean; readOnly?: boolean } = {}) {
    const shared = { id: name, name, value: values[name] ?? "", onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => change(name, event.target.value), readOnly: options.readOnly || (options.business && !canEditBusiness), required: options.required, "aria-invalid": Boolean(state.errors?.[name]) };
    return <div className={highlight} key={name}><Field errors={state.errors?.[name]} label={label} name={name}>{options.multiline ? <textarea {...shared} className={textAreaClass} rows={4} /> : <input {...shared} className={inputClass} type={options.type ?? "text"} {...(options.type === "number" ? { min: 0, step: "0.01" } : {})} />}</Field></div>;
  }
  return <form action={action} className="mt-6 space-y-6">
    <input name="invoice_version" type="hidden" value={versions.invoice} /><input name="customer_version" type="hidden" value={versions.customer} /><input name="business_version" type="hidden" value={versions.business} />
    <div className="rounded-lg border border-line bg-surface p-4 text-sm">Saving updates this invoice and any edited customer or business records everywhere they are used. Invoice numbering, status, and payment history are protected by the billing workflow. Internal notes are not included in the PDF.</div>
    <fieldset disabled={pending} className="space-y-6 disabled:opacity-70">
      <section className="rounded-xl border border-line bg-surface p-5"><h2 className="text-lg font-bold">Business details</h2>{!canEditBusiness && <p className="mt-2 text-sm text-muted">Only owners and administrators can change business details. You can still review them here.</p>}<div className="mt-4 grid gap-3 sm:grid-cols-2">{field("business_name", "Business name", { required: true, business: true })}{field("legal_name", "Legal name", { business: true })}{field("business_phone", "Business phone", { business: true, type: "tel" })}{field("business_email", "Business email", { business: true, type: "email" })}{field("address_line_1", "Business street address", { business: true })}{field("address_line_2", "Address line 2", { business: true })}{field("city", "City", { business: true })}{field("region", "State / region", { business: true })}{field("postal_code", "Postal code", { business: true })}</div></section>
      <section className="rounded-xl border border-line bg-surface p-5"><h2 className="text-lg font-bold">Customer</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><div className={highlight}><Field label="Customer type" name="customer_type"><select className={inputClass} id="customer_type" name="customer_type" value={values.customer_type} onChange={event => change("customer_type", event.target.value)}><option value="individual">Individual</option><option value="company">Company</option></select></Field></div>{values.customer_type === "company" ? field("company_name", "Company name", { required: true }) : <>{field("first_name", "First name")}{field("last_name", "Last name")}</>}{values.customer_type === "company" ? <><input type="hidden" name="first_name" value={values.first_name ?? ""} /><input type="hidden" name="last_name" value={values.last_name ?? ""} /></> : <input type="hidden" name="company_name" value={values.company_name ?? ""} />}{field("customer_phone", "Customer phone", { type: "tel" })}{field("customer_email", "Customer email", { type: "email" })}</div></section>
      <section className="rounded-xl border border-line bg-surface p-5"><h2 className="text-lg font-bold">Invoice details</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{field("invoice_number", "Invoice number", { required: true, readOnly: true })}{field("invoice_date", "Invoice date", { type: "date", required: true })}{field("due_date", "Due date", { type: "date" })}{field("amount", "Amount", { type: "number", required: true })}{field("payment_terms", "Payment terms")}{field("status", "Status", { readOnly: true })}{field("paid_date", "Paid date", { type: "date", readOnly: true })}{field("pdf_service_address", "Service address", { multiline: true })}{field("pdf_description", "Work description", { multiline: true })}</div></section>
      <section className="space-y-3 rounded-xl border border-line bg-surface p-5"><h2 className="text-lg font-bold">Customer-facing text</h2>{field("pdf_message", "Footer message", { multiline: true, required: true })}{field("pdf_notes", "Notes shown on the PDF", { multiline: true })}</section>
    </fieldset>
    <FormFeedback message={state.message} /><div className="flex flex-wrap items-center gap-4 border-t border-line pt-5"><button className="rounded-md bg-brand px-5 py-3 font-semibold text-on-brand disabled:opacity-60" disabled={pending} type="submit">{pending ? "Saving & generating…" : "Save changes & Generate PDF"}</button><Link className="font-semibold text-muted hover:underline" href={`/invoices/${invoiceId}`}>Cancel</Link></div>
  </form>;
}
