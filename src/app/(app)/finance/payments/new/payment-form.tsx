"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { savePayment, type FinanceState } from "../../actions";

export function PaymentForm({ defaults, invoices, jobs }: {
  defaults: { invoiceId?: number; jobId?: number; bankTransactionId?: number; paymentDate: string; amount?: number; reference?: string };
  invoices: { id: number; label: string }[];
  jobs: { id: number; label: string }[];
}) {
  const [state, action, pending] = useActionState(savePayment, {} as FinanceState);
  return <form action={action} className="mt-6 space-y-6"><div className="grid gap-5 sm:grid-cols-2"><Field errors={state.errors?.invoiceId} label="Invoice" name="invoiceId"><select className={inputClass} defaultValue={defaults.invoiceId ?? ""} name="invoiceId"><option value="">No invoice</option>{invoices.map((invoice) => <option key={invoice.id} value={invoice.id}>{invoice.label}</option>)}</select></Field><Field errors={state.errors?.jobId} label="Job" name="jobId"><select className={inputClass} defaultValue={defaults.jobId ?? ""} name="jobId"><option value="">No job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}</select></Field><Field errors={state.errors?.paymentDate} label="Payment date" name="paymentDate"><input className={inputClass} defaultValue={defaults.paymentDate} name="paymentDate" required type="date" /></Field><Field errors={state.errors?.amount} label="Amount" name="amount"><input className={inputClass} defaultValue={defaults.amount ?? ""} min="0.01" name="amount" required step="0.01" type="number" /></Field><Field errors={state.errors?.method} label="Payment method" name="method"><input className={inputClass} name="method" placeholder="Check, card, cash..." /></Field><Field errors={state.errors?.reference} label="Reference" name="reference"><input className={inputClass} defaultValue={defaults.reference ?? ""} name="reference" /></Field><div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Notes" name="notes"><textarea className={textAreaClass} name="notes" /></Field></div>{defaults.bankTransactionId ? <input name="bankTransactionId" type="hidden" value={defaults.bankTransactionId} /> : null}</div><FormFeedback message={state.message} /><div className="flex gap-3 border-t border-line pt-5"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Recording..." : "Record payment"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href="/finance">Cancel</Link></div></form>;
}
