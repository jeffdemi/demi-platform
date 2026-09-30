"use client";

import Link from "next/link";
import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass, textAreaClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { saveManualMileageTrip, type MileageState } from "../actions";

export function ManualMileageTripForm({ homeBaseAddress, today }: { homeBaseAddress: string; today: string }) {
  const [state, action, pending] = useActionState(saveManualMileageTrip, {} as MileageState);
  const text = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  return <form action={action} className="space-y-5">
    <div>
      <p className="mb-2 text-sm font-semibold text-muted-strong">Origin</p>
      <p className={`${inputClass} flex items-center bg-surface-muted`}>{homeBaseAddress}</p>
    </div>
    <Field errors={state.errors?.tripDate} label="Trip date" name="tripDate"><input className={inputClass} defaultValue={text("tripDate", today)} name="tripDate" required type="date" /></Field>
    <Field errors={state.errors?.destination} label="Destination" name="destination"><input className={inputClass} defaultValue={text("destination", "")} name="destination" placeholder="Where you drove to" required /></Field>
    <Field errors={state.errors?.purpose} label="Purpose" name="purpose"><textarea className={textAreaClass} defaultValue={text("purpose", "")} name="purpose" placeholder="What the trip was for" required /></Field>
    <Field errors={state.errors?.manualMiles} label="Miles (leave blank to look up automatically)" name="manualMiles"><input className={inputClass} defaultValue={text("manualMiles", "")} min="0" name="manualMiles" placeholder="Looked up automatically if left blank" step="0.1" type="number" /></Field>
    <FormFeedback message={state.message} tone={state.message === "Trip recorded." ? "success" : "danger"} />
    <div className="flex gap-3 border-t border-line pt-5">
      <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : "Save trip"}</button>
      <Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold" href="/mileage">Cancel</Link>
    </div>
  </form>;
}
