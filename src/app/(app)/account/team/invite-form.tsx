"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { inviteTeamMember, type InvitationState } from "./actions";

const initialState: InvitationState = {};

export function InviteForm() {
  const [state, action, pending] = useActionState(inviteTeamMember, initialState);

  return (
    <form action={action} className="mt-5 grid gap-4 sm:grid-cols-[minmax(0,1fr)_150px_auto] sm:items-start">
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="invite-email">Email</label>
        <input
          aria-invalid={Boolean(state.errors?.email)}
          autoComplete="email"
          className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
          id="invite-email"
          name="email"
          required
          type="email"
        />
        {state.errors?.email?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>)}
      </div>
      <div>
        <label className="mb-2 block text-sm font-semibold text-muted-strong" htmlFor="invite-role">Role</label>
        <select className="h-11 w-full rounded-md border border-line-strong bg-surface px-3" defaultValue="employee" id="invite-role" name="role">
          <option value="employee">Employee</option>
          <option value="admin">Administrator</option>
        </select>
      </div>
      <button
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:cursor-wait disabled:opacity-65 sm:mt-7"
        disabled={pending}
        type="submit"
      >
        <Send aria-hidden="true" size={17} />
        {pending ? "Sending..." : "Invite"}
      </button>
      <div className="sm:col-span-3">
        <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} />
      </div>
    </form>
  );
}
