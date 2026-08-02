"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { requestPasswordReset, type ForgotPasswordState } from "./actions";

const initialState: ForgotPasswordState = {};

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordReset, initialState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="email">Email</label>
        <input
          aria-describedby={state.errors?.email ? "email-error" : undefined}
          aria-invalid={Boolean(state.errors?.email)}
          autoComplete="email"
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="email"
          inputMode="email"
          name="email"
          required
          type="email"
        />
        {state.errors?.email?.map((error) => <p className="mt-2 text-sm text-danger" id="email-error" key={error}>{error}</p>)}
      </div>
      <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:cursor-wait disabled:opacity-65"
        disabled={pending || state.success}
        type="submit"
      >
        <Mail aria-hidden="true" size={18} />
        {pending ? "Sending..." : state.success ? "Email sent" : "Send reset link"}
      </button>
    </form>
  );
}
