import type { SupabaseClient } from "@supabase/supabase-js";
import { customerDisplayName, customerMatchesSearch, type Customer } from "@/lib/domain/customers";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type JobSummary = Pick<Database["public"]["Tables"]["jobs"]["Row"], "id" | "amount_paid">;
type CustomerListRow = Customer & { jobs: JobSummary[] };
type CustomerJob = Database["public"]["Tables"]["jobs"]["Row"];
type CustomerInvoice = Database["public"]["Tables"]["invoices"]["Row"];

export type CustomerSummary = Customer & {
  displayName: string;
  jobCount: number;
  paidRevenue: number;
};

export type CustomerSortField = "name" | "contact" | "jobs" | "revenue" | "date";
export type CustomerSortDirection = "asc" | "desc";

export type CustomerDetail = Customer & {
  displayName: string;
  jobs: CustomerJob[];
  invoices: CustomerInvoice[];
  paidRevenue: number;
};

function requireData<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error || data === null) throw new Error(`${message}${error ? `: ${error.message}` : "."}`);
  return data;
}

export async function listCustomerSummaries(
  client: Client,
  businessId: number,
  search = "",
  sort: { field: CustomerSortField; direction: CustomerSortDirection } = { field: "name", direction: "asc" },
) {
  const result = await client
    .from("customers")
    .select("*, jobs(id, amount_paid)")
    .eq("business_id", businessId)
    .order("last_name", { ascending: true, nullsFirst: false })
    .order("first_name", { ascending: true, nullsFirst: false })
    .limit(500);
  const rows = requireData(result.data as CustomerListRow[] | null, result.error, "Unable to load customers");

  const summaries = rows
    .filter((customer) => customerMatchesSearch(customer, search))
    .map((customer): CustomerSummary => ({
      ...customer,
      displayName: customerDisplayName(customer),
      jobCount: customer.jobs.length,
      paidRevenue: customer.jobs.reduce((total, job) => total + (job.amount_paid ?? 0), 0),
    }));

  const direction = sort.direction === "desc" ? -1 : 1;
  return summaries.sort((left, right) => {
    switch (sort.field) {
      case "contact":
        return direction * (left.email || left.phone || "").localeCompare(right.email || right.phone || "");
      case "jobs":
        return direction * (left.jobCount - right.jobCount);
      case "revenue":
        return direction * (left.paidRevenue - right.paidRevenue);
      case "date":
        return direction * left.created_at.localeCompare(right.created_at);
      case "name":
      default:
        return direction * left.displayName.localeCompare(right.displayName);
    }
  });
}

export async function getCustomerDetail(client: Client, businessId: number, customerId: number) {
  const result = await client
    .from("customers")
    .select("*, jobs(*), invoices(*)")
    .eq("business_id", businessId)
    .eq("id", customerId)
    .maybeSingle();
  if (result.error) throw new Error(`Unable to load customer: ${result.error.message}`);
  if (!result.data) return null;

  const customer = result.data as Customer & { jobs: CustomerJob[]; invoices: CustomerInvoice[] };
  customer.jobs.sort((left, right) =>
    (right.scheduled_date ?? right.job_date ?? "").localeCompare(left.scheduled_date ?? left.job_date ?? ""),
  );
  customer.invoices.sort((left, right) => right.invoice_date.localeCompare(left.invoice_date));
  return {
    ...customer,
    displayName: customerDisplayName(customer),
    paidRevenue: customer.jobs.reduce((total, job) => total + (job.amount_paid ?? 0), 0),
  } satisfies CustomerDetail;
}

export async function listActiveCustomerOptions(client: Client, businessId: number, includeCustomerId?: number) {
  let query = client
    .from("customers")
    .select("id, customer_type, company_name, first_name, last_name")
    .eq("business_id", businessId)
    .limit(500);
  query = includeCustomerId
    ? query.or(`active.eq.true,id.eq.${includeCustomerId}`)
    : query.eq("active", true);
  const result = await query;
  const customers = requireData(result.data, result.error, "Unable to load customer options");
  return customers
    .map((customer) => ({ id: customer.id, label: customerDisplayName(customer) }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export async function createCustomer(
  client: Client,
  values: Database["public"]["Tables"]["customers"]["Insert"],
) {
  const result = await client.from("customers").insert(values).select("id").single();
  return requireData(result.data, result.error, "Unable to create customer");
}

export async function updateCustomer(
  client: Client,
  businessId: number,
  customerId: number,
  values: Database["public"]["Tables"]["customers"]["Update"],
) {
  const result = await client
    .from("customers")
    .update(values)
    .eq("business_id", businessId)
    .eq("id", customerId)
    .select("id")
    .maybeSingle();
  if (result.error) throw new Error(`Unable to update customer: ${result.error.message}`);
  return result.data;
}
