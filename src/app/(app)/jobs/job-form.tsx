"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { isSupportedJobStatus, jobStatusLabel, jobStatusOptions, type Job } from "@/lib/domain/jobs";
import { saveJob, type JobFormState } from "./actions";

const initialState: JobFormState = {};
const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const textAreaClass = "min-h-28 w-full rounded-md border border-line-strong bg-surface p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-2 block text-sm font-semibold text-muted-strong";

function Errors({ errors }: { errors?: string[] }) {
  return errors?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>);
}

function Field({ label, name, errors, children }: { label: string; name: string; errors?: string[]; children: React.ReactNode }) {
  return <div><label className={labelClass} htmlFor={name}>{label}</label>{children}<Errors errors={errors} /></div>;
}

export type JobFromQuote = {
  id: number;
  quote_number: string;
  service_address: string | null;
  municipality: string | null;
  property_location: string | null;
  location_description: string | null;
  referral_source: string | null;
  customer_scope: string | null;
  hazard_notes: string | null;
  quoted_price: number;
  pro_bono: boolean;
  pa811_required: boolean;
  acceptance_notes: string | null;
};

export function JobForm({
  customers,
  job,
  defaultCustomerId,
  defaultJobDate,
  fromQuote,
  quoteOptions,
}: {
  customers: { id: number; label: string }[];
  job?: Job;
  defaultCustomerId?: number;
  defaultJobDate?: string;
  fromQuote?: JobFromQuote;
  quoteOptions?: { id: number; label: string }[];
}) {
  const actionWithId = saveJob.bind(null, job?.id ?? null);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  const cancelHref = job ? `/jobs/${job.id}` : "/jobs";
  const importedStatus = job && !isSupportedJobStatus(job.status) ? job.status : null;
  const quotePriceReady = fromQuote && (fromQuote.pro_bono || fromQuote.quoted_price > 0);

  return (
    <div className="mt-6 space-y-6">
      {!job && quoteOptions && quoteOptions.length > 0 ? (
        <form className="flex flex-wrap items-end gap-3 rounded-lg border border-accent-line bg-accent-soft p-4" method="get">
          <div className="min-w-0 flex-1">
            <label className={labelClass} htmlFor="quoteId">Start from an existing quote</label>
            <select className={inputClass} defaultValue={fromQuote?.id ?? ""} id="quoteId" name="quoteId">
              <option value="">Don&apos;t prefill from a quote</option>
              {quoteOptions.map((quote) => <option key={quote.id} value={quote.id}>{quote.label}</option>)}
            </select>
          </div>
          {defaultCustomerId ? <input name="customerId" type="hidden" value={defaultCustomerId} /> : null}
          <button className="h-11 rounded-md border border-line-strong bg-surface px-4 font-semibold hover:bg-surface-muted">Load quote details</button>
        </form>
      ) : null}
      {fromQuote ? (
        <p className="rounded-lg border border-brand-border bg-brand-soft px-4 py-3 text-sm font-medium text-brand-strong">
          Prefilled from quote {fromQuote.quote_number}. Fields below are editable. Saving converts an accepted quote and retains these values. Other quote states only prefill a new job.
        </p>
      ) : null}
      <form action={action} className="space-y-8">
      {!job && fromQuote ? <input type="hidden" name="sourceQuoteId" value={fromQuote.id} /> : null}
      <section>
        <h2 className="border-b border-line pb-3 text-lg font-bold">Schedule and customer</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field errors={state.errors?.customerId} label="Customer" name="customerId"><select className={inputClass} defaultValue={job?.customer_id ?? defaultCustomerId ?? ""} id="customerId" name="customerId" required><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></Field>
          <Field errors={state.errors?.status} label="Status" name="status"><select className={inputClass} defaultValue={job?.status ?? "lead"} id="status" name="status">{importedStatus && <option value={importedStatus}>Imported: {jobStatusLabel(importedStatus)}</option>}{jobStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
          <Field errors={state.errors?.scheduledDate} label="Scheduled date" name="scheduledDate"><input className={inputClass} defaultValue={job?.scheduled_date ?? ""} id="scheduledDate" name="scheduledDate" type="date" /></Field>
          <Field errors={state.errors?.scheduledStartTime} label="Start time" name="scheduledStartTime"><input className={inputClass} defaultValue={job?.scheduled_start_time?.slice(0, 5) ?? ""} id="scheduledStartTime" name="scheduledStartTime" type="time" /></Field>
          <Field errors={state.errors?.estimatedDurationMinutes} label="Estimated duration (minutes)" name="estimatedDurationMinutes"><input className={inputClass} defaultValue={job?.estimated_duration_minutes ?? ""} id="estimatedDurationMinutes" min="0" name="estimatedDurationMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.completedDate} label="Completion date" name="completedDate"><input className={inputClass} defaultValue={job?.completed_date ?? ""} id="completedDate" name="completedDate" type="date" /></Field>
          <div>
            <label className={labelClass} htmlFor="jobDate">Job date <span className="font-normal text-muted">(completed/imported jobs only)</span></label>
            <input className={inputClass} defaultValue={job?.job_date ?? defaultJobDate ?? ""} id="jobDate" name="jobDate" type="date" />
            <p className="mt-1 text-xs text-muted">Leave blank for new work — Scheduled date above is what the rest of the app shows. Only set this for a job that&apos;s already done or came from imported records.</p>
            <Errors errors={state.errors?.jobDate} />
          </div>
        </div>
      </section>

      <section>
        <h2 className="border-b border-line pb-3 text-lg font-bold">Work location and scope</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field errors={state.errors?.serviceAddress} label="Service address" name="serviceAddress"><input autoComplete="street-address" className={inputClass} defaultValue={job?.service_address ?? fromQuote?.service_address ?? ""} id="serviceAddress" name="serviceAddress" /></Field></div>
          <Field errors={state.errors?.municipality} label="Municipality" name="municipality"><input className={inputClass} defaultValue={job?.municipality ?? fromQuote?.municipality ?? ""} id="municipality" name="municipality" /></Field>
          <Field errors={state.errors?.propertyLocation} label="Property location" name="propertyLocation"><input className={inputClass} defaultValue={job?.property_location ?? fromQuote?.property_location ?? ""} id="propertyLocation" name="propertyLocation" /></Field>
          <div className="sm:col-span-2"><Field errors={state.errors?.locationDescription} label="Location description" name="locationDescription"><textarea className={textAreaClass} defaultValue={job?.location_description ?? fromQuote?.location_description ?? ""} id="locationDescription" name="locationDescription" /></Field></div>
          <Field errors={state.errors?.referralSource} label="Referral source" name="referralSource"><input className={inputClass} defaultValue={job?.referral_source ?? fromQuote?.referral_source ?? ""} id="referralSource" name="referralSource" /></Field>
          <div className="sm:col-span-2"><Field errors={state.errors?.workDescription} label="Work description" name="workDescription"><textarea className={textAreaClass} defaultValue={job?.work_description ?? fromQuote?.customer_scope ?? ""} id="workDescription" name="workDescription" /></Field></div>
          <div className="sm:col-span-2"><Field errors={state.errors?.hazardNotes} label="Hazard notes" name="hazardNotes"><textarea className={textAreaClass} defaultValue={job?.hazard_notes ?? fromQuote?.hazard_notes ?? ""} id="hazardNotes" name="hazardNotes" /></Field></div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={job?.pa811_required ?? fromQuote?.pa811_required ?? false} name="pa811Required" type="checkbox" />PA 811 required</label>
        </div>
      </section>

      <section>
        <h2 className="border-b border-line pb-3 text-lg font-bold">Price, payment, and time</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field errors={state.errors?.amountQuoted} label="Quoted amount" name="amountQuoted"><input className={inputClass} defaultValue={job?.amount_quoted ?? (quotePriceReady ? fromQuote?.quoted_price : undefined) ?? ""} id="amountQuoted" min="0" name="amountQuoted" step="0.01" type="number" /></Field>
          <Field errors={state.errors?.amountPaid} label="Amount paid" name="amountPaid"><input className={inputClass} defaultValue={job?.amount_paid ?? ""} id="amountPaid" min="0" name="amountPaid" step="0.01" type="number" /></Field>
          <Field errors={state.errors?.paymentMethod} label="Payment method" name="paymentMethod"><input className={inputClass} defaultValue={job?.payment_method ?? ""} id="paymentMethod" name="paymentMethod" /></Field>
          <Field errors={state.errors?.paidDate} label="Paid date" name="paidDate"><input className={inputClass} defaultValue={job?.paid_date ?? ""} id="paidDate" name="paidDate" type="date" /></Field>
          <Field errors={state.errors?.travelMinutes} label="Travel minutes" name="travelMinutes"><input className={inputClass} defaultValue={job?.travel_minutes ?? ""} id="travelMinutes" min="0" name="travelMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.grindingMinutes} label="Grinding minutes" name="grindingMinutes"><input className={inputClass} defaultValue={job?.grinding_minutes ?? ""} id="grindingMinutes" min="0" name="grindingMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.cleanupMinutes} label="Cleanup minutes" name="cleanupMinutes"><input className={inputClass} defaultValue={job?.cleanup_minutes ?? ""} id="cleanupMinutes" min="0" name="cleanupMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.machineHours} label="Machine hours" name="machineHours"><input className={inputClass} defaultValue={job?.machine_hours ?? ""} id="machineHours" min="0" name="machineHours" step="0.1" type="number" /></Field>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={job?.pro_bono ?? fromQuote?.pro_bono ?? false} name="proBono" type="checkbox" />Pro bono</label>
        </div>
      </section>

      <section><Field errors={state.errors?.notes} label="Internal notes" name="notes"><textarea className="min-h-36 w-full rounded-md border border-line-strong bg-surface p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" defaultValue={job?.notes ?? fromQuote?.acceptance_notes ?? ""} id="notes" name="notes" /></Field></section>
      <FormFeedback message={state.message} />
      <div className="flex flex-wrap gap-3 border-t border-line pt-6"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-65" disabled={pending} type="submit"><Save aria-hidden="true" size={17} />{pending ? "Saving..." : "Save job"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold text-muted-strong hover:bg-surface-muted" href={cancelHref}>Cancel</Link></div>
      </form>
    </div>
  );
}
