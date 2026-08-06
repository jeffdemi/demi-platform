"use client";

import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { inputClass } from "@/components/form-fields";
import { addBankAccount, excludeTransaction, type FinanceState } from "./actions";

export function BankAccountForm() {
  const [state, action, pending] = useActionState(addBankAccount, {} as FinanceState);
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <input className={inputClass} name="name" placeholder="Account name" required />
    <input className={inputClass} name="institution" placeholder="Institution" />
    <select className={inputClass} defaultValue="checking" name="accountType"><option value="checking">Checking</option><option value="savings">Savings</option><option value="credit_card">Credit card</option><option value="cash">Cash</option><option value="other">Other</option></select>
    <input className={inputClass} inputMode="numeric" maxLength={4} name="lastFour" placeholder="Last four digits" />
    <div className="sm:col-span-2"><button className="h-10 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}>{pending ? "Adding..." : "Add account"}</button></div>
    <div className="sm:col-span-2"><FormFeedback message={state.message || Object.values(state.errors ?? {}).flat()[0]} tone={state.message === "Account added." ? "success" : "danger"} /></div>
  </form>;
}

export function ExcludeTransactionForm({ transactionId }: { transactionId: number }) {
  const [state, action, pending] = useActionState(excludeTransaction.bind(null, transactionId), {} as FinanceState);
  return <form action={action} className="flex min-w-[260px] gap-2">
    <input aria-label="Exclusion reason" className="h-9 min-w-0 flex-1 rounded-md border border-line-strong bg-surface px-2 text-sm" name="reason" placeholder="Reason" required />
    <button className="h-9 rounded-md border border-line-strong px-3 text-sm font-semibold disabled:opacity-60" disabled={pending}>Exclude</button>
    {state.message ? <span className="sr-only">{state.message}</span> : null}
  </form>;
}
