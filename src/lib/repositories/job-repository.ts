import type { SupabaseClient } from "@supabase/supabase-js";
import {
  jobMatchesOperationalView,
  jobMatchesSearch,
  type Job,
  type JobWithCustomer,
} from "@/lib/domain/jobs";
import type { Customer } from "@/lib/domain/customers";
import type { Database } from "@/types/database";
import type { ComparableJob } from "@/lib/domain/quote-ai";

type Client = SupabaseClient<Database>;
type CustomerFields = Pick<Customer, "company_name" | "customer_type" | "email" | "first_name" | "last_name" | "phone">;
type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type JobDetail = JobWithCustomer & { invoices: Invoice[] };

function requireData<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error || data === null) throw new Error(`${message}${error ? `: ${error.message}` : "."}`);
  return data;
}

export async function listJobs(
  client: Client,
  businessId: number,
  filters: { customerId?: number; search?: string; status?: string; view?: string; today: string },
) {
  const result = await client
    .from("jobs")
    .select("*, customers!inner(company_name, customer_type, email, first_name, last_name, phone)")
    .eq("business_id", businessId)
    .order("scheduled_date", { ascending: true, nullsFirst: false })
    .order("scheduled_start_time", { ascending: true, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(500);
  const jobs = requireData(result.data as JobWithCustomer[] | null, result.error, "Unable to load jobs");

  return jobs.filter((job) => {
    if (filters.customerId && job.customer_id !== filters.customerId) return false;
    if (filters.status && job.status !== filters.status) return false;
    if (filters.search && !jobMatchesSearch(job, filters.search)) return false;
    if (filters.view && !jobMatchesOperationalView(job, filters.view, filters.today)) return false;
    return true;
  });
}

export async function getJobDetail(client: Client, businessId: number, jobId: number) {
  const result = await client
    .from("jobs")
    .select("*, customers!inner(company_name, customer_type, email, first_name, last_name, phone), invoices(*)")
    .eq("business_id", businessId)
    .eq("id", jobId)
    .maybeSingle();
  if (result.error) throw new Error(`Unable to load job: ${result.error.message}`);
  if (!result.data) return null;

  const job = result.data as Job & { customers: CustomerFields; invoices: Invoice[] };
  job.invoices.sort((left, right) => right.invoice_date.localeCompare(left.invoice_date));
  return job satisfies JobDetail;
}

export async function getJobForEdit(client: Client, businessId: number, jobId: number) {
  const result = await client
    .from("jobs")
    .select("*")
    .eq("business_id", businessId)
    .eq("id", jobId)
    .maybeSingle();
  if (result.error) throw new Error(`Unable to load job: ${result.error.message}`);
  return result.data;
}

export async function createJob(
  client: Client,
  values: Database["public"]["Tables"]["jobs"]["Insert"],
) {
  const result = await client.from("jobs").insert(values).select("id").single();
  return requireData(result.data, result.error, "Unable to create job");
}

export async function updateJob(
  client: Client,
  businessId: number,
  jobId: number,
  values: Database["public"]["Tables"]["jobs"]["Update"],
) {
  const result = await client
    .from("jobs")
    .update(values)
    .eq("business_id", businessId)
    .eq("id", jobId)
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(`Unable to update job: ${result.error.message}`);
  return result.data;
}

export async function listJobOptions(client: Client, businessId: number, customerId?: number) {
  let query = client.from("jobs").select("id, customer_id, source_job_number, work_description, service_address, amount_quoted")
    .eq("business_id", businessId).not("status", "eq", "cancelled").order("id", { ascending: false }).limit(500);
  if (customerId) query = query.eq("customer_id", customerId);
  const result = await query;
  const jobs = requireData(result.data, result.error, "Unable to load job options");
  return jobs.map((job) => ({ ...job, label: job.source_job_number ? `${job.source_job_number} - ${job.work_description || job.service_address || "Job"}` : `#${job.id} - ${job.work_description || job.service_address || "Job"}` }));
}

export async function listCompletedJobsForQuoteComparison(client: Client, businessId: number) {
  const result = await client.from("jobs")
    .select("id, status, completed_date, municipality, property_location, work_description, amount_quoted, amount_paid, travel_minutes, grinding_minutes, cleanup_minutes, machine_hours, pro_bono, pa811_required")
    .eq("business_id", businessId)
    .in("status", ["completed", "invoiced", "paid"])
    .not("amount_quoted", "is", null)
    .order("completed_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false })
    .limit(100);
  return requireData(result.data as ComparableJob[] | null, result.error, "Unable to load comparable jobs");
}
