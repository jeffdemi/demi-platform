import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { getJobForEdit } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../../job-form";

export const metadata: Metadata = { title: "Edit job" };

export default async function EditJobPage({ params }: { params: Promise<{ jobId: string }> }) {
  const jobId = Number((await params).jobId);
  if (!Number.isInteger(jobId)) notFound();
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect(`/jobs/${jobId}`);
  const client = await createClient();
  const job = await getJobForEdit(client, business.id, jobId);
  if (!job) notFound();
  const customers = await listActiveCustomerOptions(client, business.id, job.customer_id);
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader description={`Job ${job.source_job_number || `#${job.id}`}`} title="Edit job" /><JobForm customers={customers} job={job} /></div>;
}
