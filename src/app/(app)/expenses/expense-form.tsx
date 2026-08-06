"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { expenseCategories, expenseTypeOptions } from "@/lib/domain/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { saveExpense, type ExpenseState } from "./actions";

type Defaults = {
  expenseDate: string;
  category?: string;
  vendor?: string;
  description?: string;
  amount?: number;
  paymentMethod?: string;
  jobId?: number;
  equipmentId?: number;
  notes?: string;
  transactionType?: string;
  refundOfExpenseId?: number;
  bankTransactionId?: number;
  taxCategory?: string;
  deductiblePercent?: number;
  hasReceipt?: boolean;
};

type RefundOption = {
  id: number;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  amount: number;
};

export function ExpenseForm({
  expenseId,
  jobs,
  equipment,
  refundOptions,
  defaults,
}: {
  expenseId?: number;
  jobs: { id: number; label: string }[];
  equipment: { id: number; name: string }[];
  refundOptions: RefundOption[];
  defaults: Defaults;
}) {
  const [state, action, pending] = useActionState(saveExpense.bind(null, expenseId ?? null), {} as ExpenseState);
  return <form action={action} className="mt-6 space-y-6">
    <div className="grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.transactionType} label="Record type" name="transactionType"><select className={inputClass} defaultValue={defaults.transactionType ?? "expense"} id="transactionType" name="transactionType" required>{expenseTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field errors={state.errors?.expenseDate} label="Date" name="expenseDate"><input className={inputClass} defaultValue={defaults.expenseDate} id="expenseDate" name="expenseDate" required type="date" /></Field>
      <Field errors={state.errors?.category} label="Category" name="category"><select className={inputClass} defaultValue={defaults.category ?? ""} id="category" name="category" required><option value="">Select category</option>{expenseCategories.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field errors={state.errors?.amount} label="Amount" name="amount"><input className={inputClass} defaultValue={defaults.amount ?? ""} id="amount" min="0" name="amount" required step="0.01" type="number" /></Field>
      <Field errors={state.errors?.taxCategory} label="Tax category" name="taxCategory"><input className={inputClass} defaultValue={defaults.taxCategory ?? defaults.category ?? ""} id="taxCategory" name="taxCategory" /></Field>
      <Field errors={state.errors?.deductiblePercent} label="Business deductible %" name="deductiblePercent"><input className={inputClass} defaultValue={defaults.deductiblePercent ?? 100} id="deductiblePercent" max="100" min="0" name="deductiblePercent" required step="0.01" type="number" /></Field>
      <Field errors={state.errors?.vendor} label="Vendor" name="vendor"><input className={inputClass} defaultValue={defaults.vendor ?? ""} id="vendor" name="vendor" /></Field>
      <Field errors={state.errors?.description} label="Description" name="description"><input className={inputClass} defaultValue={defaults.description ?? ""} id="description" name="description" /></Field>
      <Field errors={state.errors?.paymentMethod} label="Payment method" name="paymentMethod"><input className={inputClass} defaultValue={defaults.paymentMethod ?? ""} id="paymentMethod" name="paymentMethod" /></Field>
      <Field errors={state.errors?.refundOfExpenseId} label="Original expense (refunds only)" name="refundOfExpenseId"><select className={inputClass} defaultValue={defaults.refundOfExpenseId ?? ""} id="refundOfExpenseId" name="refundOfExpenseId"><option value="">Not a refund</option>{refundOptions.map((item) => <option key={item.id} value={item.id}>{formatDate(item.expense_date)} · {item.vendor || item.description || `Expense #${item.id}`} · {formatCurrency(item.amount)}</option>)}</select></Field>
      <Field errors={state.errors?.jobId} label="Job (optional)" name="jobId"><select className={inputClass} defaultValue={defaults.jobId ?? ""} id="jobId" name="jobId"><option value="">No job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}</select></Field>
      <Field errors={state.errors?.equipmentId} label="Equipment (optional)" name="equipmentId"><select className={inputClass} defaultValue={defaults.equipmentId ?? ""} id="equipmentId" name="equipmentId"><option value="">No equipment</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label={defaults.hasReceipt ? "Replace receipt" : "Receipt"} name="receipt"><input accept="image/jpeg,image/png,image/webp,application/pdf" className={inputClass} id="receipt" name="receipt" type="file" /><p className="mt-1 text-xs text-muted">JPG, PNG, WebP, or PDF up to 4 MB.</p></Field>
      {defaults.bankTransactionId ? <input name="bankTransactionId" type="hidden" value={defaults.bankTransactionId} /> : null}
      <div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Notes" name="notes"><textarea className={textAreaClass} defaultValue={defaults.notes ?? ""} id="notes" name="notes" /></Field></div>
    </div>
    <FormFeedback message={state.message} />
    <div className="flex gap-3 border-t border-line pt-5"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : expenseId ? "Save changes" : "Save record"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href={expenseId ? `/expenses/${expenseId}` : "/expenses"}>Cancel</Link></div>
  </form>;
}
