"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import { isSupportedJobStatus, jobStatusLabel, jobStatusOptions, type Job } from "@/lib/domain/jobs";
import { quoteStatusLabel } from "@/lib/domain/quotes";
import { jobDefaultsFromQuote, quotesForCustomer, type JobQuotePrefill } from "@/lib/job-quote-prefill";
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

export function JobForm({
  customers,
  job,
  defaultCustomerId,
  defaultJobDate,
  defaultQuoteId,
  quoteOptions,
}: {
  customers: { id: number; label: string }[];
  job?: Job;
  defaultCustomerId?: number;
  defaultJobDate?: string;
  defaultQuoteId?: number;
  quoteOptions?: JobQuotePrefill[];
}) {
  const actionWithId = saveJob.bind(null, job?.id ?? null);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  const cancelHref = job ? `/jobs/${job.id}` : "/jobs";
  const importedStatus = job && !isSupportedJobStatus(job.status) ? job.status : null;
  const initialQuote = quoteOptions?.find((quote) => quote.id === defaultQuoteId);
  const [selectedCustomerId, setSelectedCustomerId] = useState(
    String(job?.customer_id ?? initialQuote?.customer_id ?? defaultCustomerId ?? ""),
  );
  const [selectedQuoteId, setSelectedQuoteId] = useState(String(initialQuote?.id ?? ""));
  const [selectedStatus, setSelectedStatus] = useState(job?.status ?? (initialQuote ? "quoted" : "lead"));
  const showCompletionDate = ["completed", "invoiced", "paid"].includes(selectedStatus);
  const showLegacyJobDate = Boolean(importedStatus) || selectedStatus === "completed";
  const selectedQuote = quoteOptions?.find((quote) => quote.id === Number(selectedQuoteId));
  const quoteDefaults = selectedQuote ? jobDefaultsFromQuote(selectedQuote) : undefined;
  const customerId = selectedCustomerId ? Number(selectedCustomerId) : null;
  const availableQuotes = quotesForCustomer(quoteOptions ?? [], customerId);
  const customerLabels = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.label])),
    [customers],
  );

  function handleCustomerChange(value: string) {
    setSelectedCustomerId(value);
    if (selectedQuote && selectedQuote.customer_id !== Number(value)) {
      setSelectedQuoteId("");
      setSelectedStatus("lead");
    }
  }

  function handleQuoteChange(value: string) {
    setSelectedQuoteId(value);
    const quote = quoteOptions?.find((option) => option.id === Number(value));
    if (quote) {
      setSelectedCustomerId(String(quote.customer_id));
      setSelectedStatus("quoted");
    } else if (selectedQuote) {
      setSelectedStatus("lead");
    }
  }

  function quoteLabel(quote: JobQuotePrefill) {
    const customer = customerLabels.get(quote.customer_id) ?? "Customer";
    const detail = quote.customer_scope || quote.service_address || "Quote details not entered";
    return `${customer} — ${quote.quote_number} (${quoteStatusLabel(quote.status)}) — ${detail}`;
  }

  return (
    <div className="mt-6">
      <form action={action} className="space-y-8">
      {selectedQuote ? (
        <p className="rounded-lg border border-brand-border bg-brand-soft px-4 py-3 text-sm font-medium text-brand-strong">
          {selectedQuote.status === "accepted"
            ? `Prefilled from accepted quote ${selectedQuote.quote_number}. You can change any field before saving. Saving will link the new job and mark this quote converted.`
            : `Prefilled from ${selectedQuote.quote_number}. You can change any field before saving. This quote will remain unchanged unless it is accepted first.`}
        </p>
      ) : null}
      <section>
        <h2 className="border-b border-line pb-3 text-lg font-bold">Schedule and customer</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field errors={state.errors?.customerId} label="Customer" name="customerId"><select className={inputClass} id="customerId" name="customerId" onChange={(event) => handleCustomerChange(event.target.value)} required value={selectedCustomerId}><option value="">Select customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.label}</option>)}</select></Field>
          {!job ? (
            <Field errors={state.errors?.quoteId} label="Quote" name="quoteId">
              <select className={inputClass} disabled={!quoteOptions?.length} id="quoteId" name="quoteId" onChange={(event) => handleQuoteChange(event.target.value)} value={selectedQuoteId}>
                <option value="">{quoteOptions?.length ? "No quote — enter job manually" : "No available quotes"}</option>
                {availableQuotes.map((quote) => <option key={quote.id} value={quote.id}>{quoteLabel(quote)}</option>)}
              </select>
              <p className="mt-1 text-xs text-muted">Choose a customer first to narrow the list, or choose a quote to fill its customer and job details automatically.</p>
            </Field>
          ) : null}
          <Field errors={state.errors?.status} label="Status" name="status"><select className={inputClass} id="status" name="status" onChange={(event) => setSelectedStatus(event.target.value)} value={selectedStatus}>{importedStatus && <option value={importedStatus}>Imported: {jobStatusLabel(importedStatus)}</option>}{jobStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select></Field>
          {showCompletionDate
            ? <><Field errors={state.errors?.completedDate} label="Completion date" name="completedDate"><input className={inputClass} defaultValue={job?.completed_date ?? ""} id="completedDate" name="completedDate" type="date" /></Field><input defaultValue={job?.scheduled_date ?? ""} name="scheduledDate" type="hidden" /></>
            : <><Field errors={state.errors?.scheduledDate} label="Scheduled date" name="scheduledDate"><input className={inputClass} defaultValue={job?.scheduled_date ?? ""} id="scheduledDate" name="scheduledDate" type="date" /></Field><input defaultValue={job?.completed_date ?? ""} name="completedDate" type="hidden" /></>}
          <Field errors={state.errors?.scheduledStartTime} label="Start time" name="scheduledStartTime"><input className={inputClass} defaultValue={job?.scheduled_start_time?.slice(0, 5) ?? ""} id="scheduledStartTime" name="scheduledStartTime" type="time" /></Field>
          <Field errors={state.errors?.estimatedDurationMinutes} label="Estimated duration (minutes)" name="estimatedDurationMinutes"><input className={inputClass} defaultValue={job?.estimated_duration_minutes ?? ""} id="estimatedDurationMinutes" min="0" name="estimatedDurationMinutes" step="1" type="number" /></Field>
          {showLegacyJobDate ? (
            <div>
              <label className={labelClass} htmlFor="jobDate">Job date <span className="font-normal text-muted">(imported records)</span></label>
              <input className={inputClass} defaultValue={job?.job_date ?? defaultJobDate ?? ""} id="jobDate" name="jobDate" type="date" />
              <p className="mt-1 text-xs text-muted">Only used to record a job date carried over from older, already-completed or imported records. New jobs should use Scheduled date and Completion date instead.</p>
              <Errors errors={state.errors?.jobDate} />
            </div>
          ) : <input defaultValue={job?.job_date ?? defaultJobDate ?? ""} name="jobDate" type="hidden" />}
        </div>
      </section>

      <section>
        <h2 className="border-b border-line pb-3 text-lg font-bold">Work location and scope</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <div className="sm:col-span-2"><Field errors={state.errors?.serviceAddress} label="Service address" name="serviceAddress"><input autoComplete="street-address" className={inputClass} defaultValue={job?.service_address ?? quoteDefaults?.serviceAddress ?? ""} id="serviceAddress" key={`service-${selectedQuoteId}`} name="serviceAddress" /></Field></div>
          <Field errors={state.errors?.propertyLocation} label="Property location" name="propertyLocation"><input className={inputClass} defaultValue={job?.property_location ?? quoteDefaults?.propertyLocation ?? ""} id="propertyLocation" key={`property-${selectedQuoteId}`} name="propertyLocation" /></Field>
          <div className="sm:col-span-2"><Field errors={state.errors?.locationDescription} label="Location description" name="locationDescription"><textarea className={textAreaClass} defaultValue={job?.location_description ?? quoteDefaults?.locationDescription ?? ""} id="locationDescription" key={`location-${selectedQuoteId}`} name="locationDescription" /></Field></div>
          <Field errors={state.errors?.referralSource} label="Referral source" name="referralSource"><input className={inputClass} defaultValue={job?.referral_source ?? quoteDefaults?.referralSource ?? ""} id="referralSource" key={`referral-${selectedQuoteId}`} name="referralSource" /></Field>
          <div className="sm:col-span-2"><Field errors={state.errors?.workDescription} label="Work description" name="workDescription"><textarea className={textAreaClass} defaultValue={job?.work_description ?? quoteDefaults?.workDescription ?? ""} id="workDescription" key={`work-${selectedQuoteId}`} name="workDescription" /></Field></div>
          <div className="sm:col-span-2"><Field errors={state.errors?.hazardNotes} label="Hazard notes" name="hazardNotes"><textarea className={textAreaClass} defaultValue={job?.hazard_notes ?? quoteDefaults?.hazardNotes ?? ""} id="hazardNotes" key={`hazards-${selectedQuoteId}`} name="hazardNotes" /></Field></div>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={job?.pa811_required ?? quoteDefaults?.pa811Required ?? false} key={`pa811-${selectedQuoteId}`} name="pa811Required" type="checkbox" />PA 811 required</label>
        </div>
      </section>

      <section>
        <h2 className="border-b border-line pb-3 text-lg font-bold">Price, payment, and time</h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field errors={state.errors?.amountQuoted} label="Quoted amount" name="amountQuoted"><input className={inputClass} defaultValue={job?.amount_quoted ?? quoteDefaults?.amountQuoted ?? ""} id="amountQuoted" key={`amount-${selectedQuoteId}`} min="0" name="amountQuoted" step="0.01" type="number" /></Field>
          <Field errors={state.errors?.amountPaid} label="Amount paid" name="amountPaid"><input className={inputClass} defaultValue={job?.amount_paid ?? ""} id="amountPaid" min="0" name="amountPaid" step="0.01" type="number" /></Field>
          <Field errors={state.errors?.paymentMethod} label="Payment method" name="paymentMethod"><input className={inputClass} defaultValue={job?.payment_method ?? ""} id="paymentMethod" name="paymentMethod" /></Field>
          <Field errors={state.errors?.paidDate} label="Paid date" name="paidDate"><input className={inputClass} defaultValue={job?.paid_date ?? ""} id="paidDate" name="paidDate" type="date" /></Field>
          <Field errors={state.errors?.travelMinutes} label="Travel minutes" name="travelMinutes"><input className={inputClass} defaultValue={job?.travel_minutes ?? ""} id="travelMinutes" min="0" name="travelMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.grindingMinutes} label="Grinding minutes" name="grindingMinutes"><input className={inputClass} defaultValue={job?.grinding_minutes ?? ""} id="grindingMinutes" min="0" name="grindingMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.cleanupMinutes} label="Cleanup minutes" name="cleanupMinutes"><input className={inputClass} defaultValue={job?.cleanup_minutes ?? ""} id="cleanupMinutes" min="0" name="cleanupMinutes" step="1" type="number" /></Field>
          <Field errors={state.errors?.machineHours} label="Machine hours" name="machineHours"><input className={inputClass} defaultValue={job?.machine_hours ?? ""} id="machineHours" min="0" name="machineHours" step="0.1" type="number" /></Field>
          <label className="flex min-h-11 items-center gap-3 text-sm font-semibold"><input className="size-5 accent-brand" defaultChecked={job?.pro_bono ?? quoteDefaults?.proBono ?? false} key={`pro-bono-${selectedQuoteId}`} name="proBono" type="checkbox" />Pro bono</label>
        </div>
      </section>

      <section><Field errors={state.errors?.notes} label="Internal notes" name="notes"><textarea className="min-h-36 w-full rounded-md border border-line-strong bg-surface p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" defaultValue={job?.notes ?? quoteDefaults?.notes ?? ""} id="notes" key={`notes-${selectedQuoteId}`} name="notes" /></Field></section>
      <FormFeedback message={state.message} />
      <div className="flex flex-wrap gap-3 border-t border-line pt-6"><button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-65" disabled={pending} type="submit"><Save aria-hidden="true" size={17} />{pending ? "Saving..." : "Save job"}</button><Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold text-muted-strong hover:bg-surface-muted" href={cancelHref}>Cancel</Link></div>
      </form>
    </div>
  );
}
