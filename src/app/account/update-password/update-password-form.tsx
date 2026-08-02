"use client";

import Link from "next/link";
import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { updatePassword, type UpdatePasswordState } from "./actions";

const initialState: UpdatePasswordState = {};

export function UpdatePasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, initialState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="password">New password</label>
        <input
          aria-describedby="password-help"
          aria-invalid={Boolean(state.errors?.password)}
          autoComplete="new-password"
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="password"
          name="password"
          required
          type="password"
        />
        <p className="mt-2 text-sm text-muted" id="password-help">Use at least 12 characters and avoid reused passwords.</p>
        {state.errors?.password?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="passwordConfirmation">Confirm new password</label>
        <input
          aria-invalid={Boolean(state.errors?.passwordConfirmation)}
          autoComplete="new-password"
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="passwordConfirmation"
          name="passwordConfirmation"
          required
          type="password"
        />
        {state.errors?.passwordConfirmation?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
      {state.success ? (
        <Link className="flex h-12 w-full items-center justify-center rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong" href="/dashboard">
          Continue to dashboard
        </Link>
      ) : (
        <button
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:cursor-wait disabled:opacity-65"
          disabled={pending}
          type="submit"
        >
          <KeyRound aria-hidden="true" size={18} />
          {pending ? "Updating..." : "Update password"}
        </button>
      )}
    </form>
  );
}
