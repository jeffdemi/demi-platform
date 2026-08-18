import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { createClient } from "@/lib/supabase/server";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Add job" };

export default async function NewJobPage({ searchParams }: { searchParams: Promise<{ customerId?: string }> }) {
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect("/jobs");
  const customers = await listActiveCustomerOptions(await createClient(), business.id);
  const requestedCustomerId = Number((await searchParams).customerId);
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader description="Record work scope, scheduling, pricing, and completion details." title="Add job" /><JobForm customers={customers} defaultCustomerId={Number.isInteger(requestedCustomerId) ? requestedCustomerId : undefined} defaultJobDate={dateInTimeZone(business.timezone)} /></div>;
}
