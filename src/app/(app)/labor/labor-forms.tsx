"use client";

import { Archive, Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { FinancialTermHelp } from "@/components/financial-term-help";
import { laborClassOptions, workerTypeOptions } from "@/lib/domain/management-accounting";
import { saveLaborEntry, type LaborState, voidLaborEntry } from "./actions";

export function LaborEntryForm({
  jobs,
  periodStart,
  periodEnd,
}: {
  jobs: { id: number; label: string }[];
  periodStart: string;
  periodEnd: string;
}) {
  const [state, action, pending] = useActionState(saveLaborEntry, {} as LaborState);
  return <form action={action} className="space-y-4">
    <Field errors={state.errors?.workerName} label="Worker name" name="workerName"><input className={inputClass} id="workerName" name="workerName" required /></Field>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      <Field errors={state.errors?.workerType} help={<FinancialTermHelp termId="worker-type" />} label="Worker type" name="workerType"><select className={inputClass} defaultValue="employee" id="workerType" name="workerType">{workerTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
      <Field errors={state.errors?.laborClass} help={<FinancialTermHelp termId="labor-class" />} label="Labor class" name="laborClass"><select className={inputClass} defaultValue="direct" id="laborClass" name="laborClass">{laborClassOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
      <Field errors={state.errors?.periodStart} label="Period start" name="periodStart"><input className={inputClass} defaultValue={periodStart} id="periodStart" name="periodStart" required type="date" /></Field>
      <Field errors={state.errors?.periodEnd} label="Period end" name="periodEnd"><input className={inputClass} defaultValue={periodEnd} id="periodEnd" name="periodEnd" required type="date" /></Field>
      <Field errors={state.errors?.paidDate} label="Paid date" name="paidDate"><input className={inputClass} id="paidDate" name="paidDate" type="date" /></Field>
      <Field errors={state.errors?.jobId} label="Job (optional)" name="jobId"><select className={inputClass} defaultValue="" id="jobId" name="jobId"><option value="">Not job-specific</option>{jobs.map((job) => <option key={job.id} value={job.id}>{job.label}</option>)}</select></Field>
      <Field errors={state.errors?.regularHours} help={<FinancialTermHelp termId="regular-hours" />} label="Regular hours" name="regularHours"><input className={inputClass} defaultValue="0" id="regularHours" min="0" name="regularHours" step="0.25" type="number" /></Field>
      <Field errors={state.errors?.overtimeHours} help={<FinancialTermHelp termId="overtime-hours" />} label="Overtime hours" name="overtimeHours"><input className={inputClass} defaultValue="0" id="overtimeHours" min="0" name="overtimeHours" step="0.25" type="number" /></Field>
      <Field errors={state.errors?.grossWages} help={<FinancialTermHelp termId="gross-wages" />} label="Gross wages" name="grossWages"><input className={inputClass} defaultValue="0" id="grossWages" min="0" name="grossWages" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.employerPayrollTaxes} help={<FinancialTermHelp termId="employer-payroll-taxes" />} label="Employer payroll taxes" name="employerPayrollTaxes"><input className={inputClass} defaultValue="0" id="employerPayrollTaxes" min="0" name="employerPayrollTaxes" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.benefits} help={<FinancialTermHelp termId="benefits" />} label="Benefits" name="benefits"><input className={inputClass} defaultValue="0" id="benefits" min="0" name="benefits" step="0.01" type="number" /></Field>
    </div>
    <Field errors={state.errors?.notes} label="Notes" name="notes"><textarea className={textAreaClass} id="notes" name="notes" /></Field>
    <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : "Save labor entry"}</button>
  </form>;
}

export function ArchiveLaborEntryForm({ entryId }: { entryId: number }) {
  const [state, action, pending] = useActionState(voidLaborEntry.bind(null, entryId), {} as LaborState);
  return <form action={action} className="flex min-w-[260px] gap-2">
    <input aria-label="Archive reason" className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm" name="reason" placeholder="Correction reason" required />
    <button aria-label="Archive labor entry" className="grid size-9 place-items-center rounded-md border border-line-strong text-danger disabled:opacity-60" disabled={pending} title="Archive entry"><Archive size={15} /></button>
    {state.message ? <span className="sr-only">{state.message}</span> : null}
  </form>;
}
