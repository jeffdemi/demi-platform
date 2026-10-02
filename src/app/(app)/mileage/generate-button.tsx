"use client";

import { RefreshCw } from "lucide-react";
import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { generateMileageSuggestionsNow, type MileageState } from "./actions";

export function GenerateSuggestionsButton() {
  const [state, action, pending] = useActionState(generateMileageSuggestionsNow, {} as MileageState);
  return <form action={action}>
    <button className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold hover:bg-surface-muted disabled:opacity-60" disabled={pending}><RefreshCw size={16} />{pending ? "Checking..." : "Generate suggestions now"}</button>
    <FormFeedback message={state.message} tone={state.message?.startsWith("Suggested") ? "success" : "danger"} />
  </form>;
}
