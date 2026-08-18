"use client";

import { useActionState } from "react";
import { UserMinus } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { removeTeamMember, type RemoveMemberState } from "./actions";

const initialState: RemoveMemberState = {};

export function RemoveMemberButton({ memberId }: { memberId: number }) {
  const [state, action, pending] = useActionState(removeTeamMember.bind(null, memberId), initialState);

  return (
    <form
      action={action}
      className="flex flex-col items-end gap-1"
      onSubmit={(event) => {
        if (!window.confirm("Remove this team member? They will immediately lose access to this workspace.")) {
          event.preventDefault();
        }
      }}
    >
      <button
        className="flex h-9 items-center gap-1.5 rounded-md border border-line-strong px-3 text-sm font-semibold text-danger hover:bg-danger-soft disabled:cursor-wait disabled:opacity-65"
        disabled={pending}
        type="submit"
      >
        <UserMinus aria-hidden="true" size={15} />
        {pending ? "Removing..." : "Remove"}
      </button>
      {state.message ? <FormFeedback message={state.message} tone={state.success ? "success" : "danger"} /> : null}
    </form>
  );
}
