"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Save } from "lucide-react";
import { FormFeedback } from "@/components/form-feedback";
import type { Customer } from "@/lib/domain/customers";
import { saveCustomer, type CustomerFormState } from "./actions";

const initialState: CustomerFormState = {};
const inputClass = "h-11 w-full rounded-md border border-line-strong bg-surface px-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15";
const labelClass = "mb-2 block text-sm font-semibold text-muted-strong";

function Errors({ errors }: { errors?: string[] }) {
  return errors?.map((error) => <p className="mt-2 text-sm text-danger" key={error}>{error}</p>);
}

export function CustomerForm({ customer }: { customer?: Customer }) {
  const actionWithId = saveCustomer.bind(null, customer?.id ?? null);
  const [state, action, pending] = useActionState(actionWithId, initialState);
  const cancelHref = customer ? `/customers/${customer.id}` : "/customers";

  return (
    <form action={action} className="mt-6 space-y-6">
      <div className="grid gap-5 border-b border-line pb-6 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="customerType">Customer type</label>
          <select className={inputClass} defaultValue={customer?.customer_type ?? "individual"} id="customerType" name="customerType">
            <option value="individual">Individual</option>
            <option value="company">Company</option>
          </select>
          <Errors errors={state.errors?.customerType} />
        </div>
        <div>
          <label className={labelClass} htmlFor="companyName">Company name</label>
          <input className={inputClass} defaultValue={customer?.company_name ?? ""} id="companyName" name="companyName" />
          <Errors errors={state.errors?.companyName} />
        </div>
        <div>
          <label className={labelClass} htmlFor="firstName">First name</label>
          <input autoComplete="given-name" className={inputClass} defaultValue={customer?.first_name ?? ""} id="firstName" name="firstName" />
          <Errors errors={state.errors?.firstName} />
        </div>
        <div>
          <label className={labelClass} htmlFor="lastName">Last name</label>
          <input autoComplete="family-name" className={inputClass} defaultValue={customer?.last_name ?? ""} id="lastName" name="lastName" />
          <Errors errors={state.errors?.lastName} />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Phone</label>
          <input autoComplete="tel" className={inputClass} defaultValue={customer?.phone ?? ""} id="phone" name="phone" type="tel" />
          <Errors errors={state.errors?.phone} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Email</label>
          <input autoComplete="email" className={inputClass} defaultValue={customer?.email ?? ""} id="email" name="email" type="email" />
          <Errors errors={state.errors?.email} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="streetAddress">Street address</label>
          <input autoComplete="street-address" className={inputClass} defaultValue={customer?.street_address ?? ""} id="streetAddress" name="streetAddress" />
          <Errors errors={state.errors?.streetAddress} />
        </div>
        <div>
          <label className={labelClass} htmlFor="city">City</label>
          <input autoComplete="address-level2" className={inputClass} defaultValue={customer?.city ?? ""} id="city" name="city" />
          <Errors errors={state.errors?.city} />
        </div>
        <div className="grid grid-cols-2 gap-5">
          <div>
            <label className={labelClass} htmlFor="state">State</label>
            <input autoComplete="address-level1" className={inputClass} defaultValue={customer?.state ?? ""} id="state" name="state" />
            <Errors errors={state.errors?.state} />
          </div>
          <div>
            <label className={labelClass} htmlFor="zip">ZIP</label>
            <input autoComplete="postal-code" className={inputClass} defaultValue={customer?.zip ?? ""} id="zip" name="zip" />
            <Errors errors={state.errors?.zip} />
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold sm:col-span-2">
          <input className="size-5 accent-brand" defaultChecked={customer?.active ?? true} name="active" type="checkbox" />
          Active customer
        </label>
      </div>
      <div>
        <label className={labelClass} htmlFor="notes">Internal notes</label>
        <textarea className="min-h-32 w-full rounded-md border border-line-strong bg-surface p-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" defaultValue={customer?.notes ?? ""} id="notes" name="notes" />
        <Errors errors={state.errors?.notes} />
      </div>
      <FormFeedback message={state.message} />
      <div className="flex flex-wrap gap-3">
        <button className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong disabled:opacity-65" disabled={pending} type="submit">
          <Save aria-hidden="true" size={17} />
          {pending ? "Saving..." : "Save customer"}
        </button>
        <Link className="flex h-11 items-center rounded-md border border-line-strong px-4 font-semibold text-muted-strong hover:bg-surface-muted" href={cancelHref}>Cancel</Link>
      </div>
    </form>
  );
}
