import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { getJobForEdit, listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { InvoiceForm } from "../invoice-form";
export const metadata: Metadata = { title: "Add invoice" };
export default async function NewInvoicePage({ searchParams }: { searchParams: Promise<{ customerId?: string; jobId?: string }> }) { const query = await searchParams; const { business } = await requireBusinessContext(); const client = await createClient(); const requestedJobId = Number(query.jobId); const job = Number.isInteger(requestedJobId) ? await getJobForEdit(client, business.id, requestedJobId) : null; const customerId = job?.customer_id ?? (Number.isInteger(Number(query.customerId)) ? Number(query.customerId) : undefined); const [customers, jobs] = await Promise.all([listActiveCustomerOptions(client, business.id, customerId), listJobOptions(client, business.id)]); return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description="Create an invoice and link it to completed work when available." title="Add invoice" /><InvoiceForm customers={customers} defaults={{ customerId, jobId: job?.id, amount: job?.amount_quoted ?? undefined }} jobs={jobs} today={dateInTimeZone(business.timezone)} /></div>; }
