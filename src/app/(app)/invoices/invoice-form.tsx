"use client";
import Link from "next/link";
import { AlertTriangle, Save } from "lucide-react";
import { useActionState, useState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { invoiceStatusOptions } from "@/lib/domain/finance";
import { saveInvoice, type InvoiceFormState } from "./actions";
export function InvoiceForm({ customers, jobs, today, defaults, invoicesByJob }: { customers: { id: number; label: string }[]; jobs: { id: number; customer_id: number; label: string; amount_quoted: number | null }[]; today: string; defaults: { customerId?: number; jobId?: number; amount?: number; notes?: string }; invoicesByJob: Record<number, string[]> }) {
  const [state, action, pending] = useActionState(saveInvoice, {} as InvoiceFormState);
  const [selectedJobId, setSelectedJobId] = useState(defaults.jobId ? String(defaults.jobId) : "");
  const [prompting, setPrompting] = useState(false);
  const existing = invoicesByJob[Number(selectedJobId)] ?? [];
  return <form action={action} className="mt-6 space-y-7"><section className="grid gap-5 sm:grid-cols-2">
  <Field errors={state.errors?.customerId} label="Customer" name="customerId"><select className={inputClass} defaultValue={defaults.customerId ?? ""} id="customerId" name="customerId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></Field>
  <Field errors={state.errors?.jobId} label="Job" name="jobId"><select className={inputClass} defaultValue={defaults.jobId ?? ""} id="jobId" name="jobId" onChange={(event) => { setSelectedJobId(event.target.value); setPrompting(false); }} required><option value="">Select job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}</select></Field>
  <Field errors={state.errors?.amount} label="Amount" name="amount"><input className={inputClass} defaultValue={defaults.amount ?? ""} id="amount" min="0" name="amount" required step="0.01" type="number" /></Field>
  <Field errors={state.errors?.status} label="Status" name="status"><select className={inputClass} defaultValue="unpaid" id="status" name="status">{invoiceStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
  <Field errors={state.errors?.invoiceDate} label="Invoice date" name="invoiceDate"><input className={inputClass} defaultValue={today} id="invoiceDate" name="invoiceDate" required type="date" /></Field>
  <Field errors={state.errors?.dueDate} label="Due date" name="dueDate"><input className={inputClass} id="dueDate" name="dueDate" type="date" /></Field>
  <Field errors={state.errors?.paymentTerms} label="Payment terms" name="paymentTerms"><input className={inputClass} defaultValue="Due on receipt" id="paymentTerms" name="paymentTerms" /></Field>
  <Field errors={state.errors?.paidDate} label="Paid date" name="paidDate"><input className={inputClass} id="paidDate" name="paidDate" type="date" /></Field>
  <div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Internal notes" name="notes"><textarea className={textAreaClass} defaultValue={defaults.notes ?? ""} id="notes" name="notes" /></Field></div>
  </section><FormFeedback message={state.message} /><div className="space-y-4 border-t border-line pt-5">
  {existing.length ? <p className="flex items-start gap-2 rounded-md border border-accent-line bg-accent-soft p-4 text-sm text-warning-ink"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0" size={16} />This job already has {existing.length === 1 ? "an invoice" : `${existing.length} invoices`}: {existing.join(", ")}.</p> : null}
  {prompting
    ? <div className="rounded-md border border-line-strong bg-surface-muted p-4"><p className="font-semibold">Create a second invoice for this job?</p><p className="mt-1 text-sm text-muted">{existing.join(", ")} already {existing.length === 1 ? "exists" : "exist"} against it. Creating another leaves both on the job.</p><div className="mt-4 flex gap-3"><button className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" onClick={() => setPrompting(false)} type="button">Cancel</button><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending} type="submit"><Save size={17} />{pending ? "Creating..." : "Create anyway"}</button></div></div>
    : <div className="flex gap-3">{existing.length
        ? <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" onClick={() => setPrompting(true)} type="button"><Save size={17} />Create invoice</button>
        : <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending} type="submit"><Save size={17} />{pending ? "Creating..." : "Create invoice"}</button>}<Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href="/invoices">Cancel</Link></div>}
  </div></form>; }
