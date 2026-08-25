"use client";

import Link from "next/link";
import { ExternalLink, FileCheck2, Save, Sparkles } from "lucide-react";
import { useActionState, useState } from "react";
import { CategoryCombobox } from "@/components/category-combobox";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { FinancialTermHelp } from "@/components/financial-term-help";
import { expensePaymentMethodOptions, expenseTypeOptions } from "@/lib/domain/finance";
import { financialClassificationOptions, laborClassOptions } from "@/lib/domain/management-accounting";
import { formatCurrency, formatDate } from "@/lib/format";
import { suggestExpenseFieldsAction } from "./expense-ai-actions";
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
  financialClassification?: string;
  laborClass?: string;
  hasReceipt?: boolean;
  receiptUrl?: string;
};

type RefundOption = {
  id: number;
  expense_date: string;
  vendor: string | null;
  description: string | null;
  amount: number;
  financial_classification: string;
  labor_class: string | null;
  deductible_percent: number;
};

type ConfidenceLevel = "high" | "medium" | "low";

type AiFields = "category" | "vendor" | "taxCategory" | "deductiblePercent" | "financialClassification" | "laborClass" | "paymentMethod" | "jobId" | "equipmentId";

function ConfidenceHint({ level }: { level?: ConfidenceLevel }) {
  if (!level) return null;
  const tone = level === "high"
    ? "border-brand-border bg-brand-soft text-brand-strong"
    : level === "medium"
      ? "border-accent-line bg-accent-soft text-warning-ink"
      : "border-danger-line bg-danger-soft text-danger-strong";
  const text = level === "high" ? "AI: looks right" : level === "medium" ? "AI: double-check" : "AI: needs review";
  return <span className={`ml-2 inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${tone}`}>{text}</span>;
}

function toneRing(level?: ConfidenceLevel) {
  if (level === "low") return "border-danger-line";
  if (level === "medium") return "border-accent-line";
  if (level === "high") return "border-brand-border";
  return "";
}

export function ExpenseForm({
  expenseId,
  jobs,
  equipment,
  refundOptions,
  categories,
  defaults,
  aiConfigured,
  bankContext,
}: {
  expenseId?: number;
  jobs: { id: number; label: string }[];
  equipment: { id: number; name: string }[];
  refundOptions: RefundOption[];
  categories: string[];
  defaults: Defaults;
  aiConfigured?: boolean;
  bankContext?: { description?: string | null; amount?: number | null; date?: string | null };
}) {
  const [state, action, pending] = useActionState(saveExpense.bind(null, expenseId ?? null), {} as ExpenseState);

  const [description, setDescription] = useState(defaults.description ?? "");
  const [values, setValues] = useState({
    category: defaults.category ?? "",
    vendor: defaults.vendor ?? "",
    taxCategory: defaults.taxCategory ?? defaults.category ?? "",
    deductiblePercent: String(defaults.deductiblePercent ?? 100),
    financialClassification: defaults.financialClassification ?? "operating",
    laborClass: defaults.laborClass ?? "",
    paymentMethod: defaults.paymentMethod ?? "",
    jobId: defaults.jobId ? String(defaults.jobId) : "",
    equipmentId: defaults.equipmentId ? String(defaults.equipmentId) : "",
  });
  const [confidence, setConfidence] = useState<Partial<Record<AiFields, ConfidenceLevel>>>({});
  const [suggesting, setSuggesting] = useState(false);
  const [suggestMessage, setSuggestMessage] = useState<string | null>(null);
  // CategoryCombobox is an uncontrolled input (defaultValue only applies on mount). Bumping this
  // key when the AI suggests a category forces a remount so the new value actually shows up,
  // without remounting (and losing cursor position) on every keystroke of manual typing.
  const [suggestionVersion, setSuggestionVersion] = useState(0);

  function setValue<K extends keyof typeof values>(key: K, value: (typeof values)[K]) {
    setValues((current) => ({ ...current, [key]: value }));
    // Once Jeff touches a field himself, the AI's confidence read on it no longer applies.
    setConfidence((current) => ({ ...current, [key]: undefined }));
  }

  async function handleSuggest() {
    if (!description.trim()) return;
    setSuggesting(true);
    setSuggestMessage(null);
    const result = await suggestExpenseFieldsAction(description, bankContext);
    setSuggesting(false);
    if (!result.ok) {
      setSuggestMessage(result.message);
      return;
    }
    const s = result.suggestion;
    setValues({
      category: s.category,
      vendor: s.vendor ?? "",
      taxCategory: s.taxCategory ?? "",
      deductiblePercent: String(s.deductiblePercent),
      financialClassification: s.financialClassification,
      laborClass: s.laborClass ?? "",
      paymentMethod: s.paymentMethod ?? "",
      jobId: s.jobId ? String(s.jobId) : "",
      equipmentId: s.equipmentId ? String(s.equipmentId) : "",
    });
    setSuggestionVersion((version) => version + 1);
    setConfidence({
      category: s.confidence.category,
      vendor: s.confidence.vendor,
      taxCategory: s.confidence.taxCategory,
      deductiblePercent: s.confidence.deductiblePercent,
      financialClassification: s.confidence.financialClassification,
      laborClass: s.confidence.laborClass,
      paymentMethod: s.confidence.paymentMethod,
      jobId: s.confidence.jobId,
      equipmentId: s.confidence.equipmentId,
    });
    setSuggestMessage(s.assistantNote);
  }

  return <form action={action} className="mt-6 space-y-6">
    <div className="rounded-lg border border-line bg-surface-muted p-4">
      <Field errors={state.errors?.description} label="Description" name="description">
        <textarea className={textAreaClass} id="description" name="description" onChange={(event) => setDescription(event.target.value)} placeholder="Start here — describe what this was for, e.g. &quot;Home Depot, lumber and screws for the Elm St stump job&quot;" value={description} />
      </Field>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button className="flex h-10 items-center gap-2 rounded-md border border-brand-border bg-brand-soft px-3 font-semibold text-brand-strong disabled:opacity-60" disabled={suggesting || !description.trim() || aiConfigured === false} onClick={handleSuggest} type="button">
          <Sparkles aria-hidden="true" size={16} />{suggesting ? "Thinking..." : "Suggest fields with AI"}
        </button>
        {aiConfigured === false ? <span className="text-xs text-muted">AI suggestions aren&apos;t configured for this business yet.</span> : null}
        {suggestMessage ? <p className="text-sm text-muted-strong">{suggestMessage}</p> : null}
      </div>
    </div>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.transactionType} label="Record type" name="transactionType"><select className={inputClass} defaultValue={defaults.transactionType ?? "expense"} id="transactionType" name="transactionType" required>{expenseTypeOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field errors={state.errors?.expenseDate} label="Date" name="expenseDate"><input className={inputClass} defaultValue={defaults.expenseDate} id="expenseDate" name="expenseDate" required type="date" /></Field>
      <Field errors={state.errors?.category} help={<ConfidenceHint level={confidence.category} />} label="Category" name="category"><CategoryCombobox categories={categories} className={`${inputClass} ${toneRing(confidence.category)}`} defaultValue={values.category} id="category" key={`category-${suggestionVersion}`} name="category" onChange={() => setConfidence((current) => ({ ...current, category: undefined }))} required /></Field>
      <Field errors={state.errors?.amount} label="Amount" name="amount"><input className={inputClass} defaultValue={defaults.amount ?? ""} id="amount" min="0" name="amount" required step="0.01" type="number" /></Field>
      <Field errors={state.errors?.taxCategory} help={<><FinancialTermHelp termId="tax-category" /><ConfidenceHint level={confidence.taxCategory} /></>} label="Tax category" name="taxCategory"><input className={`${inputClass} ${toneRing(confidence.taxCategory)}`} id="taxCategory" name="taxCategory" onChange={(event) => setValue("taxCategory", event.target.value)} value={values.taxCategory} /></Field>
      <Field errors={state.errors?.deductiblePercent} help={<><FinancialTermHelp termId="deductible-percent" /><ConfidenceHint level={confidence.deductiblePercent} /></>} label="Business deductible %" name="deductiblePercent"><input className={`${inputClass} ${toneRing(confidence.deductiblePercent)}`} id="deductiblePercent" max="100" min="0" name="deductiblePercent" onChange={(event) => setValue("deductiblePercent", event.target.value)} required step="0.01" type="number" value={values.deductiblePercent} /></Field>
      <Field errors={state.errors?.financialClassification} help={<><FinancialTermHelp termId="management-classification" /><ConfidenceHint level={confidence.financialClassification} /></>} label="Management classification" name="financialClassification"><select className={`${inputClass} ${toneRing(confidence.financialClassification)}`} id="financialClassification" name="financialClassification" onChange={(event) => setValue("financialClassification", event.target.value)} required value={values.financialClassification}>{financialClassificationOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field errors={state.errors?.laborClass} help={<><FinancialTermHelp termId="labor-class" /><ConfidenceHint level={confidence.laborClass} /></>} label="Labor class (labor only)" name="laborClass"><select className={`${inputClass} ${toneRing(confidence.laborClass)}`} id="laborClass" name="laborClass" onChange={(event) => setValue("laborClass", event.target.value)} value={values.laborClass}><option value="">Not labor</option>{laborClassOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <Field errors={state.errors?.vendor} help={<ConfidenceHint level={confidence.vendor} />} label="Vendor" name="vendor"><input className={`${inputClass} ${toneRing(confidence.vendor)}`} id="vendor" name="vendor" onChange={(event) => setValue("vendor", event.target.value)} value={values.vendor} /></Field>
      <Field errors={state.errors?.paymentMethod} help={<ConfidenceHint level={confidence.paymentMethod} />} label="Funding / payment source" name="paymentMethod"><select className={`${inputClass} ${toneRing(confidence.paymentMethod)}`} id="paymentMethod" name="paymentMethod" onChange={(event) => setValue("paymentMethod", event.target.value)} value={values.paymentMethod}><option value="">Select source</option>{values.paymentMethod && !expensePaymentMethodOptions.some((option) => option.value === values.paymentMethod) ? <option value={values.paymentMethod}>{values.paymentMethod}</option> : null}{expensePaymentMethodOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select><p className="mt-1 text-xs text-muted">Personal funds create an owner contribution or an amount the business owes you; they do not wait for a business-bank match.</p></Field>
      <Field errors={state.errors?.refundOfExpenseId} label="Original expense (refunds only)" name="refundOfExpenseId"><select className={inputClass} defaultValue={defaults.refundOfExpenseId ?? ""} id="refundOfExpenseId" name="refundOfExpenseId"><option value="">Not a refund</option>{refundOptions.map((item) => <option key={item.id} value={item.id}>{formatDate(item.expense_date)} · {item.vendor || item.description || `Expense #${item.id}`} · {formatCurrency(item.amount)}</option>)}</select></Field>
      <Field errors={state.errors?.jobId} help={<ConfidenceHint level={confidence.jobId} />} label="Job (optional)" name="jobId"><select className={`${inputClass} ${toneRing(confidence.jobId)}`} id="jobId" name="jobId" onChange={(event) => setValue("jobId", event.target.value)} value={values.jobId}><option value="">No job</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}</select></Field>
      <Field errors={state.errors?.equipmentId} help={<ConfidenceHint level={confidence.equipmentId} />} label="Equipment (optional)" name="equipmentId"><select className={`${inputClass} ${toneRing(confidence.equipmentId)}`} id="equipmentId" name="equipmentId" onChange={(event) => setValue("equipmentId", event.target.value)} value={values.equipmentId}><option value="">No equipment</option>{equipment.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
      <Field label={defaults.hasReceipt ? "Replace receipt" : "Receipt"} name="receipt">{defaults.hasReceipt ? <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-brand-border bg-brand-soft px-3 py-2 text-sm"><span className="inline-flex items-center gap-2 font-semibold"><FileCheck2 size={17} />Receipt attached</span>{defaults.receiptUrl ? <a className="inline-flex items-center gap-1 font-semibold text-brand" href={defaults.receiptUrl} rel="noreferrer" target="_blank">Open current receipt<ExternalLink size={14} /></a> : null}</div> : null}<input accept="image/jpeg,image/png,image/webp,application/pdf" className={inputClass} id="receipt" name="receipt" type="file" /><p className="mt-1 text-xs text-muted">{defaults.hasReceipt ? "The current receipt stays attached unless you choose a replacement. A replacement must be reviewed again." : "JPG, PNG, WebP, or PDF up to 4 MB."}</p></Field>
      {defaults.bankTransactionId ? <input name="bankTransactionId" type="hidden" value={defaults.bankTransactionId} /> : null}
      <div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Notes" name="notes"><textarea className={textAreaClass} defaultValue={defaults.notes ?? ""} id="notes" name="notes" /></Field></div>
    </div>
    <FormFeedback message={state.message} />
    <div className="flex gap-3 border-t border-line pt-5"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : expenseId ? "Save changes" : "Save record"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href={expenseId ? `/expenses/${expenseId}` : "/expenses"}>Cancel</Link></div>
  </form>;
}

