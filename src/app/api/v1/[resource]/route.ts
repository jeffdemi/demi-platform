import { apiBusinessContext, csvResponse } from "@/lib/api-auth";

const resources = {
  customers: "id, customer_type, company_name, first_name, last_name, phone, email, active, created_at, updated_at",
  jobs: "id, customer_id, quote_id, source_job_number, status, job_date, scheduled_date, scheduled_start_time, service_address, work_description, amount_quoted, amount_paid, paid_date, created_at, updated_at",
  quotes: "id, customer_id, job_id, quote_number, status, quote_date, expiration_date, service_address, customer_scope, quoted_price, pro_bono, sent_date, response_date, created_at, updated_at",
  invoices: "id, customer_id, job_id, invoice_number, amount, invoice_date, due_date, payment_terms, status, paid_date, created_at, updated_at",
  expenses: "id, job_id, equipment_id, bank_transaction_id, expense_date, transaction_type, category, tax_category, deductible_percent, vendor, description, amount, payment_method, receipt_review_status, voided_at, created_at, updated_at",
  payments: "id, customer_id, invoice_id, job_id, bank_transaction_id, payment_date, amount, method, reference, source, voided_at, created_at, updated_at",
  bank_transactions: "id, account_id, transaction_date, posted_date, description, amount, status, external_id, created_at, updated_at",
} as const;

export async function GET(request: Request, { params }: { params: Promise<{ resource: string }> }) {
  const context = await apiBusinessContext(request);
  if (!context) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const resource = (await params).resource as keyof typeof resources;
  if (!(resource in resources)) return Response.json({ error: "Not found" }, { status: 404 });
  const result = await context.client.from(resource).select(resources[resource] as "*").eq("business_id", context.businessId).limit(5000);
  if (result.error) return Response.json({ error: "Unable to load records" }, { status: 500 });
  const rows = result.data as unknown as Record<string, unknown>[];
  if (new URL(request.url).searchParams.get("format") === "csv") return csvResponse(rows, `${resource}.csv`);
  return Response.json({ data: rows, count: rows.length });
}
