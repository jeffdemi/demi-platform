"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { FinancialTermHelp } from "@/components/financial-term-help";
import { updateMonthlySnapshot, type MonthEndState } from "./actions";

type Snapshot = {
  cash_book_balance: number;
  cash_bank_balance: number;
  accounts_receivable: number;
  accounts_payable: number;
  inventory: number;
  taxes_payable: number;
  credit_card_balance: number;
  short_term_debt: number;
  long_term_debt: number;
  fixed_assets_net: number;
  notes: string | null;
  reconciled_at: string | null;
} | null;

export function MonthEndForm({ month, snapshot }: { month: string; snapshot: Snapshot }) {
  const [state, action, pending] = useActionState(updateMonthlySnapshot, {} as MonthEndState);
  const money = (value: number | undefined) => value ?? 0;
  return <form action={action} className="mt-5 space-y-5">
    <Field errors={state.errors?.periodMonth} label="Month" name="periodMonth"><input className={inputClass} defaultValue={month} id="periodMonth" name="periodMonth" required type="month" /></Field>
    <div className="grid gap-5 sm:grid-cols-2">
      <Field errors={state.errors?.cashBookBalance} help={<FinancialTermHelp termId="book-cash" />} label="Book cash balance" name="cashBookBalance"><input className={inputClass} defaultValue={money(snapshot?.cash_book_balance)} id="cashBookBalance" name="cashBookBalance" required step="0.01" type="number" /></Field>
      <Field errors={state.errors?.cashBankBalance} help={<FinancialTermHelp termId="bank-cash" />} label="Bank statement cash" name="cashBankBalance"><input className={inputClass} defaultValue={money(snapshot?.cash_bank_balance)} id="cashBankBalance" name="cashBankBalance" required step="0.01" type="number" /></Field>
      <Field errors={state.errors?.accountsReceivable} help={<FinancialTermHelp termId="accounts-receivable" />} label="Accounts receivable" name="accountsReceivable"><input className={inputClass} defaultValue={money(snapshot?.accounts_receivable)} id="accountsReceivable" min="0" name="accountsReceivable" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.accountsPayable} help={<FinancialTermHelp termId="accounts-payable" />} label="Accounts payable" name="accountsPayable"><input className={inputClass} defaultValue={money(snapshot?.accounts_payable)} id="accountsPayable" min="0" name="accountsPayable" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.inventory} help={<FinancialTermHelp termId="inventory" />} label="Inventory" name="inventory"><input className={inputClass} defaultValue={money(snapshot?.inventory)} id="inventory" min="0" name="inventory" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.fixedAssetsNet} help={<FinancialTermHelp termId="fixed-assets-net" />} label="Net equipment and fixed assets" name="fixedAssetsNet"><input className={inputClass} defaultValue={money(snapshot?.fixed_assets_net)} id="fixedAssetsNet" min="0" name="fixedAssetsNet" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.taxesPayable} help={<FinancialTermHelp termId="taxes-payable" />} label="Taxes payable" name="taxesPayable"><input className={inputClass} defaultValue={money(snapshot?.taxes_payable)} id="taxesPayable" min="0" name="taxesPayable" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.creditCardBalance} help={<FinancialTermHelp termId="credit-card-balance" />} label="Credit card balance" name="creditCardBalance"><input className={inputClass} defaultValue={money(snapshot?.credit_card_balance)} id="creditCardBalance" min="0" name="creditCardBalance" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.shortTermDebt} help={<FinancialTermHelp termId="short-term-debt" />} label="Short-term debt" name="shortTermDebt"><input className={inputClass} defaultValue={money(snapshot?.short_term_debt)} id="shortTermDebt" min="0" name="shortTermDebt" step="0.01" type="number" /></Field>
      <Field errors={state.errors?.longTermDebt} help={<FinancialTermHelp termId="long-term-debt" />} label="Long-term debt" name="longTermDebt"><input className={inputClass} defaultValue={money(snapshot?.long_term_debt)} id="longTermDebt" min="0" name="longTermDebt" step="0.01" type="number" /></Field>
      <div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Reconciliation notes" name="notes"><textarea className={textAreaClass} defaultValue={snapshot?.notes ?? ""} id="notes" name="notes" /></Field></div>
    </div>
    <div className="flex items-start gap-3 rounded-md border border-line bg-surface-muted p-3 text-sm"><input className="mt-1 size-5 accent-brand" defaultChecked={Boolean(snapshot?.reconciled_at)} id="reconcile" name="reconcile" type="checkbox" /><div><div className="flex items-center gap-1"><label className="font-bold" htmlFor="reconcile">Mark cash reconciled</label><FinancialTermHelp termId="cash-reconciliation" /></div><p>Book cash and bank cash must agree within one cent.</p></div></div>
    <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : "Save month end"}</button>
  </form>;
}
