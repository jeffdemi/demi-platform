"use client";

import { useActionState } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import {
  createStatementPeriod,
  postBookkeepingAdjustment,
  reconcileStatement,
  type FinanceState,
} from "./actions";

type AccountOption = { id: number; code?: string; name: string; account_type?: string; system_key?: string | null };

export function StatementPeriodForm({ accounts, defaultAccountId }: { accounts: AccountOption[]; defaultAccountId?: number }) {
  const [state, action, pending] = useActionState(createStatementPeriod, {} as FinanceState);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <Field errors={state.errors?.accountId} label="Account" name="accountId"><select className={inputClass} defaultValue={defaultAccountId ?? ""} id="accountId" name="accountId" required><option disabled value="">Select account</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></Field>
    <div />
    <Field errors={state.errors?.statementStart} label="Statement start" name="statementStart"><input className={inputClass} id="statementStart" name="statementStart" required type="date" /></Field>
    <Field errors={state.errors?.statementEnd} label="Statement end" name="statementEnd"><input className={inputClass} id="statementEnd" name="statementEnd" required type="date" /></Field>
    <Field errors={state.errors?.openingBalance} label="Opening balance" name="openingBalance"><input className={inputClass} id="openingBalance" name="openingBalance" required step="0.01" type="number" /></Field>
    <Field errors={state.errors?.closingBalance} label="Closing balance" name="closingBalance"><input className={inputClass} id="closingBalance" name="closingBalance" required step="0.01" type="number" /></Field>
    <div className="sm:col-span-2"><Field errors={state.errors?.notes} label="Notes" name="notes"><textarea className={textAreaClass} id="notes" name="notes" /></Field></div>
    <div className="sm:col-span-2"><FormFeedback message={state.message} /></div>
    <div className="sm:col-span-2"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Creating..." : "Create reconciliation"}</button></div>
  </form>;
}

export function ReconcileStatementForm({ periodId, disabled }: { periodId: number; disabled?: boolean }) {
  const [state, action, pending] = useActionState(reconcileStatement.bind(null, periodId), {} as FinanceState);
  return <form action={action} className="space-y-3">
    <FormFeedback message={state.message} tone={state.message?.startsWith("Statement reconciled") ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || disabled}><CheckCircle2 size={17} />{pending ? "Reconciling..." : "Reconcile statement"}</button>
  </form>;
}

export function AdjustmentForm({ accounts, defaultDate }: { accounts: AccountOption[]; defaultDate: string }) {
  const [state, action, pending] = useActionState(postBookkeepingAdjustment, {} as FinanceState);
  const options = accounts.map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>);
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <Field errors={state.errors?.entryDate} label="Entry date" name="entryDate"><input className={inputClass} defaultValue={defaultDate} id="entryDate" name="entryDate" required type="date" /></Field>
    <Field errors={state.errors?.amount} label="Amount" name="amount"><input className={inputClass} id="amount" min="0.01" name="amount" required step="0.01" type="number" /></Field>
    <Field errors={state.errors?.debitAccountId} label="Debit account" name="debitAccountId"><select className={inputClass} defaultValue="" id="debitAccountId" name="debitAccountId" required><option disabled value="">Select debit account</option>{options}</select></Field>
    <Field errors={state.errors?.creditAccountId} label="Credit account" name="creditAccountId"><select className={inputClass} defaultValue="" id="creditAccountId" name="creditAccountId" required><option disabled value="">Select credit account</option>{options}</select></Field>
    <div className="sm:col-span-2"><Field errors={state.errors?.description} label="Description" name="description"><input className={inputClass} id="description" name="description" required /></Field></div>
    <div className="sm:col-span-2"><Field errors={state.errors?.reason} label="Reason and supporting detail" name="reason"><textarea className={textAreaClass} id="reason" name="reason" required /></Field></div>
    <div className="sm:col-span-2"><FormFeedback message={state.message} tone={state.message === "Balanced adjustment posted." ? "success" : "danger"} /></div>
    <div className="sm:col-span-2"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Posting..." : "Post balanced adjustment"}</button></div>
  </form>;
}
