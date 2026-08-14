"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { FinancialTermHelp } from "@/components/financial-term-help";
import { laborClassOptions } from "@/lib/domain/management-accounting";
import { updateFinancialSettings, updateOwnerCompensation, type ReportingSettingsState } from "./actions";

type Settings = {
  owner_market_salary_annual: number | null;
  owner_labor_class: string;
  has_non_owner_labor: boolean;
  reporting_basis: string;
  target_total_ler: number;
  minimum_profit_to_gross_margin: number;
  target_profit_to_gross_margin: number;
  stretch_profit_to_gross_margin: number;
  core_capital_months: number;
  minimum_roic: number;
};

const Submit = ({ pending, label }: { pending: boolean; label: string }) => <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : label}</button>;

export function FinancialSettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(updateFinancialSettings, {} as ReportingSettingsState);
  return <form action={action} className="mt-5 space-y-5">
    <div className="grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.ownerMarketSalaryAnnual} help={<FinancialTermHelp termId="owner-market-salary" />} label="Owner market salary (annual)" name="ownerMarketSalaryAnnual"><input className={inputClass} defaultValue={settings.owner_market_salary_annual ?? ""} id="ownerMarketSalaryAnnual" min="0" name="ownerMarketSalaryAnnual" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.ownerLaborClass} help={<FinancialTermHelp termId="owner-labor-class" />} label="Owner labor class" name="ownerLaborClass"><select className={inputClass} defaultValue={settings.owner_labor_class} id="ownerLaborClass" name="ownerLaborClass">{laborClassOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></Field>
      <Field errors={state.errors?.reportingBasis} help={<FinancialTermHelp termId="reporting-basis" />} label="Management reporting basis" name="reportingBasis"><select className={inputClass} defaultValue={settings.reporting_basis} id="reportingBasis" name="reportingBasis"><option value="cash">Cash collected</option><option value="accrual">Invoices earned</option></select></Field>
      <Field errors={state.errors?.targetTotalLer} help={<FinancialTermHelp termId="total-ler" />} label="Target Total LER" name="targetTotalLer"><input className={inputClass} defaultValue={settings.target_total_ler} id="targetTotalLer" min="0.01" name="targetTotalLer" required step="0.01" type="number" /></Field>
      <Field errors={state.errors?.minimumProfitPercent} help={<FinancialTermHelp termId="profit-to-gross-margin" />} label="Minimum profit / gross margin %" name="minimumProfitPercent"><input className={inputClass} defaultValue={settings.minimum_profit_to_gross_margin * 100} id="minimumProfitPercent" min="0" max="100" name="minimumProfitPercent" required step="0.1" type="number" /></Field>
      <Field errors={state.errors?.targetProfitPercent} help={<FinancialTermHelp termId="profit-to-gross-margin" />} label="Target profit / gross margin %" name="targetProfitPercent"><input className={inputClass} defaultValue={settings.target_profit_to_gross_margin * 100} id="targetProfitPercent" min="0" max="100" name="targetProfitPercent" required step="0.1" type="number" /></Field>
      <Field errors={state.errors?.stretchProfitPercent} help={<FinancialTermHelp termId="profit-to-gross-margin" />} label="Stretch profit / gross margin %" name="stretchProfitPercent"><input className={inputClass} defaultValue={settings.stretch_profit_to_gross_margin * 100} id="stretchProfitPercent" min="0" max="100" name="stretchProfitPercent" required step="0.1" type="number" /></Field>
      <Field errors={state.errors?.coreCapitalMonths} help={<FinancialTermHelp termId="core-capital" />} label="Core capital months" name="coreCapitalMonths"><input className={inputClass} defaultValue={settings.core_capital_months} id="coreCapitalMonths" min="0.1" name="coreCapitalMonths" required step="0.1" type="number" /></Field>
      <Field errors={state.errors?.minimumRoicPercent} help={<FinancialTermHelp termId="roic" />} label="Minimum ROIC %" name="minimumRoicPercent"><input className={inputClass} defaultValue={settings.minimum_roic * 100} id="minimumRoicPercent" min="0" name="minimumRoicPercent" required step="1" type="number" /></Field>
      <label className="flex items-center gap-3 self-end pb-3 font-semibold"><input className="size-5 accent-brand" defaultChecked={settings.has_non_owner_labor} name="hasNonOwnerLabor" type="checkbox" />Track employees or helpers in the monthly checklist</label>
    </div>
    <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    <Submit label="Save financial settings" pending={pending} />
  </form>;
}

type OwnerCompensationDefaults = {
  market_salary_amount: number;
  actual_wages: number;
  distributions: number;
  contributions: number;
  notes: string | null;
};

export function OwnerCompensationForm({ month, suggestedMarketSalary, defaults }: { month: string; suggestedMarketSalary: number; defaults?: OwnerCompensationDefaults }) {
  const [state, action, pending] = useActionState(updateOwnerCompensation, {} as ReportingSettingsState);
  return <form action={action} className="mt-5 space-y-5">
    <div className="grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.periodMonth} label="Month" name="periodMonth"><input className={inputClass} defaultValue={month} id="periodMonth" name="periodMonth" required type="month" /></Field>
      <Field errors={state.errors?.marketSalaryAmount} help={<FinancialTermHelp termId="market-salary-month" />} label="Market-rate salary for month" name="marketSalaryAmount"><input className={inputClass} defaultValue={defaults?.market_salary_amount ?? suggestedMarketSalary.toFixed(2)} id="marketSalaryAmount" min="0" name="marketSalaryAmount" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.actualWages} help={<FinancialTermHelp termId="actual-owner-wages" />} label="Actual owner wages paid" name="actualWages"><input className={inputClass} defaultValue={defaults?.actual_wages ?? 0} id="actualWages" min="0" name="actualWages" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.distributions} help={<FinancialTermHelp termId="owner-distributions" />} label="Owner distributions" name="distributions"><input className={inputClass} defaultValue={defaults?.distributions ?? 0} id="distributions" min="0" name="distributions" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.contributions} help={<FinancialTermHelp termId="owner-contributions" />} label="Owner contributions" name="contributions"><input className={inputClass} defaultValue={defaults?.contributions ?? 0} id="contributions" min="0" name="contributions" step="0.01" type="number" /></Field>
      <div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Notes" name="notes"><textarea className={textAreaClass} defaultValue={defaults?.notes ?? ""} id="notes" name="notes" /></Field></div>
    </div>
    <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    <Submit label="Save compensation month" pending={pending} />
  </form>;
}
