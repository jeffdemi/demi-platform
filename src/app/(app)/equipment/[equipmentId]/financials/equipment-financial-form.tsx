"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { FinancialTermHelp } from "@/components/financial-term-help";
import { saveEquipmentFinancials, type EquipmentState } from "../../actions";

type Equipment = {
  purchase_date: string | null;
  in_service_date: string | null;
  purchase_cost: number | null;
  salvage_value: number | null;
  useful_life_months: number | null;
  depreciation_method: string | null;
  loan_lender: string | null;
  loan_original_amount: number | null;
  loan_balance: number | null;
  loan_interest_rate: number | null;
  loan_maturity_date: string | null;
};

export function EquipmentFinancialForm({ equipmentId, equipment }: { equipmentId: number; equipment: Equipment }) {
  const [state, action, pending] = useActionState(saveEquipmentFinancials.bind(null, equipmentId), {} as EquipmentState);
  return <form action={action} className="mt-6 space-y-6">
    <section><h2 className="font-bold">Purchase & depreciation</h2><div className="mt-4 grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.purchaseDate} help={<FinancialTermHelp termId="purchase-date" />} label="Purchase date" name="purchaseDate"><input className={inputClass} defaultValue={equipment.purchase_date ?? ""} id="purchaseDate" name="purchaseDate" type="date" /></Field>
      <Field errors={state.errors?.inServiceDate} help={<FinancialTermHelp termId="in-service-date" />} label="Placed in service" name="inServiceDate"><input className={inputClass} defaultValue={equipment.in_service_date ?? ""} id="inServiceDate" name="inServiceDate" type="date" /></Field>
      <Field errors={state.errors?.purchaseCost} help={<FinancialTermHelp termId="purchase-cost" />} label="Purchase cost" name="purchaseCost"><input className={inputClass} defaultValue={equipment.purchase_cost ?? ""} id="purchaseCost" min="0" name="purchaseCost" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.salvageValue} help={<FinancialTermHelp termId="salvage-value" />} label="Estimated salvage value" name="salvageValue"><input className={inputClass} defaultValue={equipment.salvage_value ?? 0} id="salvageValue" min="0" name="salvageValue" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.usefulLifeMonths} help={<FinancialTermHelp termId="useful-life" />} label="Useful life (months)" name="usefulLifeMonths"><input className={inputClass} defaultValue={equipment.useful_life_months ?? ""} id="usefulLifeMonths" min="1" name="usefulLifeMonths" step="1" type="number" /></Field>
      <Field errors={state.errors?.depreciationMethod} help={<FinancialTermHelp termId="straight-line-depreciation" />} label="Management depreciation" name="depreciationMethod"><select className={inputClass} defaultValue={equipment.depreciation_method ?? ""} id="depreciationMethod" name="depreciationMethod"><option value="">Not configured</option><option value="straight_line">Straight line</option></select></Field>
    </div></section>
    <section className="border-t border-line pt-5"><h2 className="font-bold">Equipment loan</h2><div className="mt-4 grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.loanLender} label="Lender" name="loanLender"><input className={inputClass} defaultValue={equipment.loan_lender ?? ""} id="loanLender" name="loanLender" /></Field>
      <Field errors={state.errors?.loanOriginalAmount} help={<FinancialTermHelp termId="original-loan-amount" />} label="Original loan amount" name="loanOriginalAmount"><input className={inputClass} defaultValue={equipment.loan_original_amount ?? ""} id="loanOriginalAmount" min="0" name="loanOriginalAmount" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.loanBalance} help={<FinancialTermHelp termId="loan-balance" />} label="Current loan balance" name="loanBalance"><input className={inputClass} defaultValue={equipment.loan_balance ?? ""} id="loanBalance" min="0" name="loanBalance" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.loanInterestRate} help={<FinancialTermHelp termId="loan-interest-rate" />} label="Interest rate %" name="loanInterestRate"><input className={inputClass} defaultValue={equipment.loan_interest_rate ?? ""} id="loanInterestRate" max="100" min="0" name="loanInterestRate" step="0.001" type="number" /></Field>
      <Field errors={state.errors?.loanMaturityDate} help={<FinancialTermHelp termId="loan-maturity-date" />} label="Loan maturity date" name="loanMaturityDate"><input className={inputClass} defaultValue={equipment.loan_maturity_date ?? ""} id="loanMaturityDate" name="loanMaturityDate" type="date" /></Field>
    </div></section>
    <FormFeedback message={state.message} tone={state.message === "Equipment financials saved." ? "success" : "danger"} />
    <div className="flex gap-3 border-t border-line pt-5"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : "Save financials"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href="/equipment">Cancel</Link></div>
  </form>;
}
