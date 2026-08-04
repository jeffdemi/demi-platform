"use client";
import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { invoiceStatusOptions } from "@/lib/domain/finance";
import { markInvoice, type InvoiceFormState } from "./actions";
export function InvoiceStatusForm({ invoiceId, status }: { invoiceId: number; status: string }) { const [state, action, pending] = useActionState(markInvoice.bind(null, invoiceId), {} as InvoiceFormState); return <form action={action} className="space-y-3"><div className="flex gap-2"><select className="h-10 flex-1 rounded-md border border-line-strong bg-surface px-3" defaultValue={status} name="status">{invoiceStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}>{pending ? "Updating..." : "Update"}</button></div><FormFeedback message={state.message} tone={state.message?.includes("updated") ? "success" : "danger"} /></form>; }
