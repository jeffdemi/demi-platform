"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { createAdditionalBusiness, type CreateBusinessState } from "./actions";

const initialState: CreateBusinessState = {};

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState(createAdditionalBusiness, initialState);

  return (
    <form action={action} className="mt-4 flex max-w-lg flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <label className="sr-only" htmlFor="name">Business name</label>
        <input
          className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="name"
          name="name"
          placeholder="Business name"
          required
        />
        {state.errors?.name?.map((error) => (
          <p className="mt-2 text-sm text-danger" key={error}>{error}</p>
        ))}
        {state.message && <p className="mt-2 text-sm text-danger" role="alert">{state.message}</p>}
      </div>
      <button
        className="flex h-11 shrink-0 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        <Plus aria-hidden="true" size={18} />
        {pending ? "Creating..." : "Create business"}
      </button>
    </form>
  );
}
