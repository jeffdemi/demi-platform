"use client";

import { Save } from "lucide-react";
import { useActionState } from "react";
import { Field, inputClass } from "@/components/form-fields";
import { FormFeedback } from "@/components/form-feedback";
import { saveMileageSettings, type MileageState } from "./actions";

export function MileageSettingsForm({ homeBaseAddress, irsStandardMileageRate }: { homeBaseAddress: string | null; irsStandardMileageRate: number | null }) {
  const [state, action, pending] = useActionState(saveMileageSettings, {} as MileageState);
  const text = (name: string, fallback: string) => state.values?.[name] ?? fallback;
  return <form action={action} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field errors={state.errors?.homeBaseAddress} label="Home base address" name="homeBaseAddress"><input className={inputClass} defaultValue={text("homeBaseAddress", homeBaseAddress ?? "")} id="homeBaseAddress" name="homeBaseAddress" placeholder="Where your vehicle starts and ends every day" required /></Field>
      <Field errors={state.errors?.irsStandardMileageRate} label="IRS standard mileage rate ($/mile)" name="irsStandardMileageRate"><input className={inputClass} defaultValue={text("irsStandardMileageRate", irsStandardMileageRate === null ? "" : String(irsStandardMileageRate))} id="irsStandardMileageRate" min="0" name="irsStandardMileageRate" placeholder="Not set -- check the current IRS rate" step="0.001" type="number" /></Field>
    </div>
    <FormFeedback message={state.message} tone={state.message === "Mileage settings saved." ? "success" : "danger"} />
    <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={pending}><Save size={17} />{pending ? "Saving..." : "Save settings"}</button>
  </form>;
}
