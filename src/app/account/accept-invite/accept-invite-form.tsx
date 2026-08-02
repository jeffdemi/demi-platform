"use client";

import { useActionState } from "react";
import { UserCheck } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { acceptInvitation, type AcceptInvitationState } from "./actions";

const initialState: AcceptInvitationState = {};

export function AcceptInviteForm({ invitationId }: { invitationId: string }) {
  const [state, action, pending] = useActionState(acceptInvitation, initialState);

  return (
    <form action={action} className="mt-7 space-y-5">
      <input name="invitationId" type="hidden" value={invitationId} />
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="fullName">Full name</label>
        <input
          aria-invalid={Boolean(state.errors?.fullName)}
          autoComplete="name"
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="fullName"
          name="fullName"
          required
        />
        {state.errors?.fullName?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="password">Create password</label>
        <input
          aria-describedby="invite-password-help"
          aria-invalid={Boolean(state.errors?.password)}
          autoComplete="new-password"
          className="h-12 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="password"
          name="password"
          required
          type="password"
        />
        <p className="mt-2 text-sm text-muted" id="invite-password-help">Use at least 12 characters.</p>
        {state.errors?.password?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="passwordConfirmation">Confirm password</label>
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
      <FormFeedback message={state.message} />
      <button
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        <UserCheck aria-hidden="true" size={18} />
        {pending ? "Creating account..." : "Accept invitation"}
      </button>
    </form>
  );
}
