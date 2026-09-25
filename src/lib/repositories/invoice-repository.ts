import type { SupabaseClient } from "@supabase/supabase-js";
import { describeDbError } from "@/lib/supabase-errors";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type Customer = Pick<Database["public"]["Tables"]["customers"]["Row"], "company_name" | "customer_type" | "first_name" | "last_name" | "phone" | "email"> & { updated_at?: string };
type Job = Pick<Database["public"]["Tables"]["jobs"]["Row"], "id" | "work_description" | "service_address">;
type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"];
export type InvoiceWithRelations = Omit<InvoiceRow, "archive_reason" | "archived_at" | "archived_by" | "pdf_description" | "pdf_service_address" | "pdf_message" | "pdf_notes"> & Partial<Pick<InvoiceRow, "archive_reason" | "archived_at" | "archived_by" | "pdf_description" | "pdf_service_address" | "pdf_message" | "pdf_notes">> & { customers: Customer; jobs: Job | null };

export async function listInvoices(client: Client, businessId: number, status?: string, includeArchived = false) {
  let query = client.from("invoices").select("*, customers!inner(company_name, customer_type, first_name, last_name, phone, email, updated_at), jobs(id, work_description, service_address)")
    .eq("business_id", businessId).order("invoice_date", { ascending: false }).order("id", { ascending: false }).limit(500);
  if (status) query = query.eq("status", status);
  if (!includeArchived) query = query.is("archived_at", null);
  const result = await query;
  if (result.error) throw new Error(`Unable to load invoices: ${result.error.message}`);
  return result.data as InvoiceWithRelations[];
}

export async function getInvoice(client: Client, businessId: number, invoiceId: number) {
  const result = await client.from("invoices").select("*, customers!inner(company_name, customer_type, first_name, last_name, phone, email, updated_at), jobs(id, work_description, service_address)")
    .eq("business_id", businessId).eq("id", invoiceId).maybeSingle();
  if (result.error) throw new Error(`Unable to load invoice: ${result.error.message}`);
  return result.data as InvoiceWithRelations | null;
}

// Invoice numbers already raised against each job, so the form can warn before a second
// one is created. Archived invoices are left out; a voided one is shown, flagged, because
// voiding then re-issuing is a normal correction and the user should judge it themselves.
export async function listInvoiceLabelsByJob(client: Client, businessId: number) {
  const result = await client.from("invoices").select("job_id, invoice_number, status")
    .eq("business_id", businessId).not("job_id", "is", null).is("archived_at", null);
  if (result.error) throw new Error(describeDbError(result.error, "load existing invoices"));
  const byJob: Record<number, string[]> = {};
  for (const row of result.data ?? []) {
    if (row.job_id === null) continue;
    (byJob[row.job_id] ??= []).push(row.status === "void" ? `${row.invoice_number} (void)` : row.invoice_number);
  }
  return byJob;
}

export async function createInvoiceRecord(client: Client, values: {
  businessId: number; customerId: number; jobId: number; amount: number; invoiceDate: string;
  dueDate?: string; paymentTerms?: string; status: string; paidDate?: string; notes?: string;
}) {
  // supabase-js drops object keys whose value is `undefined` before sending the RPC body, and
  // none of this function's Postgres parameters have defaults — an omitted optional field (no
  // job, no due date, etc.) silently strips that parameter and PostgREST reports the whole
  // function as "not found" rather than "missing argument". Coalesce every optional field to
  // `null` explicitly so the call always carries all ten parameters.
  const result = await client.rpc("create_invoice_record", {
    target_business_id: values.businessId, target_customer_id: values.customerId, target_job_id: values.jobId ?? null,
    invoice_amount: values.amount, invoice_on: values.invoiceDate, due_on: values.dueDate ?? null,
    terms: values.paymentTerms ?? null, invoice_status: values.status, paid_on: values.paidDate ?? null, invoice_notes: values.notes ?? null,
  });
  if (result.error) throw new Error(describeDbError(result.error, "create the invoice"));
  return result.data;
}

export async function updateInvoiceStatus(client: Client, businessId: number, invoiceId: number, status: string, paidDate: string | null) {
  const existing = await client.from("invoices").select("id").eq("business_id", businessId).eq("id", invoiceId).maybeSingle();
  if (existing.error) throw new Error(describeDbError(existing.error, "update invoice"));
  if (!existing.data) return null;
  const result = await client.rpc("set_invoice_status", { target_invoice_id: invoiceId, invoice_status: status, paid_on: paidDate });
  if (result.error) throw new Error(describeDbError(result.error, "update invoice"));
  return { id: result.data };
}
