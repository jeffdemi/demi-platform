"use client";

import { useActionState } from "react";
import { ArrowRight } from "lucide-react";
import { createBusiness, type OnboardingState } from "./actions";

const initialState: OnboardingState = {};

export function OnboardingForm({ businessName }: { businessName: string }) {
  const [state, action, pending] = useActionState(createBusiness, initialState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold" htmlFor="name">Business name</label>
        <input
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 shadow-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          defaultValue={businessName}
          id="name"
          name="name"
          required
        />
        {state.errors?.name?.map((error) => (
          <p className="mt-2 text-sm text-danger" key={error}>{error}</p>
        ))}
      </div>
      {state.message && <p className="text-sm text-danger" role="alert">{state.message}</p>}
      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        {pending ? "Creating workspace..." : "Create workspace"}
        {!pending && <ArrowRight aria-hidden="true" size={18} />}
      </button>
    </form>
  );
}
