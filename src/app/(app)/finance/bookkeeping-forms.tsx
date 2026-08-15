"use client";

import { useActionState, useState } from "react";
import { ArrowRightLeft, CheckCircle2, Save, Undo2 } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import {
  createStatementPeriod,
  matchExpense,
  postBookkeepingAdjustment,
  reconcileStatement,
  reverseTransactionAllocation,
  saveBankTransfer,
  saveTransactionAllocation,
  type FinanceState,
} from "./actions";

type AccountOption = { id: number; code?: string; name: string; account_type?: string; system_key?: string | null };
type TransactionOption = { id: number; transaction_date: string; description: string; amount: number; bank_accounts: { name: string } | null };
type ExpenseMatchOption = { id: number; expense_date: string; vendor: string | null; description: string | null; category: string; amount: number; transaction_type: string };

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

export function AllocationForm({ transactionId, accounts, remaining, description }: { transactionId: number; accounts: AccountOption[]; remaining: number; description: string }) {
  const [state, action, pending] = useActionState(saveTransactionAllocation.bind(null, transactionId), {} as FinanceState);
  const [values, setValues] = useState({
    ledgerAccountId: "",
    amount: remaining.toFixed(2),
    memo: description,
    taxCategory: "",
    deductiblePercent: "100",
    rememberRule: false,
    merchantPattern: description,
  });
  return <form action={action} className="grid gap-4 sm:grid-cols-2">
    <Field errors={state.errors?.ledgerAccountId} label="Bookkeeping account" name="ledgerAccountId"><select className={inputClass} id="ledgerAccountId" name="ledgerAccountId" onChange={(event) => setValues((current) => ({ ...current, ledgerAccountId: event.target.value }))} required value={values.ledgerAccountId}><option disabled value="">Select account</option>{accounts.filter((account) => account.system_key !== "cash").map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}</option>)}</select></Field>
    <Field errors={state.errors?.amount} label={`Amount remaining: $${remaining.toFixed(2)}`} name="amount"><input className={inputClass} id="amount" max={remaining} min="0.01" name="amount" onChange={(event) => setValues((current) => ({ ...current, amount: event.target.value }))} required step="0.01" type="number" value={values.amount} /></Field>
    <Field errors={state.errors?.memo} label="Memo" name="memo"><input className={inputClass} id="memo" name="memo" onChange={(event) => setValues((current) => ({ ...current, memo: event.target.value }))} required value={values.memo} /></Field>
    <Field errors={state.errors?.taxCategory} label="Tax category" name="taxCategory"><input className={inputClass} id="taxCategory" name="taxCategory" onChange={(event) => setValues((current) => ({ ...current, taxCategory: event.target.value }))} placeholder="Optional" value={values.taxCategory} /></Field>
    <Field errors={state.errors?.deductiblePercent} label="Business deductible %" name="deductiblePercent"><input className={inputClass} id="deductiblePercent" max="100" min="0" name="deductiblePercent" onChange={(event) => setValues((current) => ({ ...current, deductiblePercent: event.target.value }))} step="0.01" type="number" value={values.deductiblePercent} /></Field>
    <div />
    <div className="space-y-2 rounded-md border border-line bg-surface-muted p-3 sm:col-span-2"><label className="flex items-start gap-2 text-sm font-semibold"><input checked={values.rememberRule} className="mt-1" name="rememberRule" onChange={(event) => setValues((current) => ({ ...current, rememberRule: event.target.checked }))} type="checkbox" value="yes" /><span>After posting, find similar transactions and remember this classification for future imports.</span></label><label className="block text-sm font-semibold">Merchant text to recognize<input className={`${inputClass} mt-1`} name="merchantPattern" onChange={(event) => setValues((current) => ({ ...current, merchantPattern: event.target.value }))} value={values.merchantPattern} /></label><p className="text-xs text-muted">Shorten this to the stable merchant name—for example, HISCOX. Future matches will wait for your approval.</p></div>
    <div className="sm:col-span-2"><FormFeedback message={state.message} tone={state.message === "Allocation posted." ? "success" : "danger"} /></div>
    <div className="sm:col-span-2"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending || remaining <= 0}><Save size={17} />{pending ? "Posting..." : "Post allocation"}</button></div>
  </form>;
}

export function TransferForm({ transactionId, candidates }: { transactionId: number; candidates: TransactionOption[] }) {
  const [state, action, pending] = useActionState(saveBankTransfer.bind(null, transactionId), {} as FinanceState);
  return <form action={action} className="grid gap-4">
    <Field errors={state.errors?.otherTransactionId} label="Matching transaction" name="otherTransactionId"><select className={inputClass} defaultValue="" id="otherTransactionId" name="otherTransactionId" required><option disabled value="">Select matching deposit or withdrawal</option>{candidates.map((transaction) => <option key={transaction.id} value={transaction.id}>{transaction.transaction_date} · {transaction.bank_accounts?.name ?? "Account"} · {transaction.description} · ${Math.abs(transaction.amount).toFixed(2)}</option>)}</select></Field>
    <Field errors={state.errors?.memo} label="Transfer memo" name="memo"><input className={inputClass} id="memo" name="memo" placeholder="Transfer between business accounts" /></Field>
    <FormFeedback message={state.message} />
    <button className="flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong px-4 font-semibold disabled:opacity-60" disabled={pending || !candidates.length}><ArrowRightLeft size={17} />{pending ? "Matching..." : "Match transfer"}</button>
  </form>;
}

export function ExistingExpenseMatchForm({ transactionId, candidates }: { transactionId: number; candidates: ExpenseMatchOption[] }) {
  const [state, action, pending] = useActionState(matchExpense.bind(null, transactionId), {} as FinanceState);
  return <form action={action} className="grid gap-3">
    <Field errors={state.errors?.expenseId} label="Matching recorded expense" name="expenseId"><select className={inputClass} defaultValue="" id="expenseId" name="expenseId" required><option disabled value="">Select an expense</option>{candidates.map((expense) => <option key={expense.id} value={expense.id}>{expense.expense_date} · {expense.vendor || expense.description || expense.category} · ${Number(expense.amount).toFixed(2)}</option>)}</select></Field>
    <FormFeedback message={state.message} tone={state.message === "Existing expense matched." ? "success" : "danger"} />
    <button className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand disabled:opacity-60" disabled={pending || !candidates.length}><CheckCircle2 size={16} />{pending ? "Matching..." : "Match existing expense"}</button>
  </form>;
}

export function ReverseAllocationForm({ transactionId, allocationId }: { transactionId: number; allocationId: number }) {
  const [state, action, pending] = useActionState(reverseTransactionAllocation.bind(null, transactionId, allocationId), {} as FinanceState);
  return <form action={action} className="flex min-w-[260px] gap-2">
    <input aria-label="Correction reason" className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm" name="reason" placeholder="Correction reason" required />
    <button className="flex h-9 items-center gap-1 rounded-md border border-line-strong px-3 text-sm font-semibold disabled:opacity-60" disabled={pending}><Undo2 size={14} />Reverse</button>
    {state.message ? <span className="sr-only">{state.message}</span> : null}
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
