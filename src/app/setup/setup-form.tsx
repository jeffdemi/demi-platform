"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { completeInitialSetup, type SetupState } from "./actions";

const initialState: SetupState = {};
const inputClass = "h-12 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";

export function SetupForm({ ownerEmail }: { ownerEmail: string }) {
  const [state, action, pending] = useActionState(completeInitialSetup, initialState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="fullName">Your name</label>
        <input autoComplete="name" className={inputClass} id="fullName" name="fullName" required />
        {state.errors?.fullName?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="businessName">Business name</label>
        <input className={inputClass} defaultValue="Demi Stump Grinding" id="businessName" name="businessName" required />
        {state.errors?.businessName?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="email">Owner email</label>
        <input autoComplete="email" className={`${inputClass} bg-surface-muted`} id="email" name="email" readOnly type="email" value={ownerEmail} />
        {state.errors?.email?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="password">Password</label>
        <input aria-describedby="setup-password-help" autoComplete="new-password" className={inputClass} id="password" name="password" required type="password" />
        <p className="mt-2 text-sm text-muted" id="setup-password-help">Use at least 12 characters.</p>
        {state.errors?.password?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="passwordConfirmation">Confirm password</label>
        <input autoComplete="new-password" className={inputClass} id="passwordConfirmation" name="passwordConfirmation" required type="password" />
        {state.errors?.passwordConfirmation?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
      <button className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:cursor-wait disabled:opacity-65" disabled={pending || state.success} type="submit">
        <ShieldCheck aria-hidden="true" size={18} />
        {pending ? "Starting setup..." : state.success ? "Confirmation sent" : "Create owner account"}
      </button>
    </form>
  );
}
