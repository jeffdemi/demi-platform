import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { cashOutflowImpact, operatingExpenseImpact } from "@/lib/domain/finance";
import { actualCashReceipts } from "@/lib/domain/revenue";

type Client = SupabaseClient<Database>;

export type DashboardDateRange = { start: string | null; end: string | null };

function inRange(date: string | null | undefined, range: DashboardDateRange) {
  if (!range.start && !range.end) return true;
  return Boolean(date && (!range.start || date >= range.start) && (!range.end || date <= range.end));
}

export async function getOperationalDashboard(client: Client, businessId: number, today: string, range: DashboardDateRange) {
  const [jobsResult, invoicesResult, expensesResult, maintenanceResult, paymentsResult, bankReviewResult] = await Promise.all([
    client.from("jobs").select("id, status, job_date, completed_date, paid_date, scheduled_date, scheduled_start_time, work_description, amount_paid, amount_quoted, travel_minutes, grinding_minutes, cleanup_minutes, machine_hours, referral_source, customers(first_name, last_name, company_name, customer_type)").eq("business_id", businessId).limit(5000),
    client.from("invoices").select("id, job_id, invoice_number, status, amount, invoice_date, due_date, customer_id, customers(first_name, last_name, company_name, customer_type)").eq("business_id", businessId).limit(5000),
    client.from("expenses").select("id, amount, expense_date, transaction_type, voided_at").eq("business_id", businessId).limit(5000),
    client.from("maintenance").select("id, equipment_id, next_due_date, next_due_hours, service_type, equipment(name, hour_meter)").eq("business_id", businessId).not("next_due_date", "is", null).order("next_due_date").limit(8),
    client.from("payments").select("id, amount, payment_date, job_id, invoice_id, voided_at").eq("business_id", businessId).limit(5000),
    client.from("bank_transactions").select("id, transaction_date").eq("business_id", businessId).eq("status", "unreviewed").limit(5000),
  ]);
  for (const result of [jobsResult, invoicesResult, expensesResult, maintenanceResult, paymentsResult, bankReviewResult]) if (result.error) throw new Error(`Unable to load dashboard: ${result.error.message}`);
  const jobs = jobsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const expenses = (expensesResult.data ?? []).filter((expense) => !expense.voided_at);
  const receipts = actualCashReceipts({ payments: paymentsResult.data ?? [], jobs, invoices });
  const rangeJobs = jobs.filter((job) => inRange(job.job_date ?? job.completed_date ?? job.scheduled_date, range));
  const rangeInvoices = invoices.filter((invoice) => inRange(invoice.invoice_date, range));
  const rangeExpenses = expenses.filter((expense) => inRange(expense.expense_date, range));
  const rangeReceipts = receipts.filter((receipt) => inRange(receipt.payment_date, range));
  const referral = new Map<string, number>();
  rangeJobs.filter((job) => (job.amount_paid ?? 0) > 0).forEach((job) => referral.set(job.referral_source || "Not recorded", (referral.get(job.referral_source || "Not recorded") ?? 0) + (job.amount_paid ?? 0)));
  return {
    metrics: {
      revenue: rangeReceipts.reduce((sum, receipt) => sum + receipt.amount, 0),
      outstandingInvoices: rangeInvoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.amount, 0),
      averagePaidJob: rangeReceipts.length ? rangeReceipts.reduce((sum, receipt) => sum + receipt.amount, 0) / rangeReceipts.length : 0,
      expenses: rangeExpenses.reduce((sum, expense) => sum + operatingExpenseImpact(expense), 0),
      capitalPurchases: rangeExpenses.filter((expense) => expense.transaction_type === "asset").reduce((sum, expense) => sum + expense.amount, 0),
      refunds: rangeExpenses.filter((expense) => expense.transaction_type === "refund").reduce((sum, expense) => sum + expense.amount, 0),
      cashOutflow: rangeExpenses.reduce((sum, expense) => sum + cashOutflowImpact(expense), 0),
      machineHours: rangeJobs.reduce((sum, job) => sum + (job.machine_hours ?? 0), 0),
      totalJobs: rangeJobs.length,
      totalHoursWorked: rangeJobs.reduce((sum, job) => sum + (job.travel_minutes ?? 0) + (job.grinding_minutes ?? 0) + (job.cleanup_minutes ?? 0), 0) / 60,
      totalGrindingHours: rangeJobs.reduce((sum, job) => sum + (job.grinding_minutes ?? 0), 0) / 60,
      unreviewedBankTransactions: (bankReviewResult.data ?? []).filter((item) => inRange(item.transaction_date, range)).length,
    },
    todayJobs: jobs.filter((job) => job.scheduled_date === today || job.job_date === today).sort((a, b) => (a.scheduled_start_time || "").localeCompare(b.scheduled_start_time || "")).slice(0, 8),
    upcomingJobs: jobs.filter((job) => job.scheduled_date && job.scheduled_date > today && !["paid", "cancelled"].includes(job.status)).sort((a, b) => (a.scheduled_date || "").localeCompare(b.scheduled_date || "")).slice(0, 8),
    unscheduledJobs: jobs.filter((job) => !job.scheduled_date && !["completed", "invoiced", "paid", "cancelled"].includes(job.status)).slice(0, 8),
    completedAwaitingInvoice: jobs.filter((job) => job.status === "completed").slice(0, 8),
    unpaidInvoices: invoices.filter((invoice) => invoice.status === "unpaid").sort((a, b) => (a.due_date || a.invoice_date).localeCompare(b.due_date || b.invoice_date)).slice(0, 8),
    upcomingMaintenance: maintenanceResult.data ?? [],
    referralRevenue: [...referral.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8),
  };
}

export async function getEntityCounts(client: Client, businessId: number, range: DashboardDateRange) {
  const [customers, jobs, quotes, invoices] = await Promise.all([
    client.from("customers").select("id, created_at").eq("business_id", businessId).eq("active", true).limit(5000),
    client.from("jobs").select("id, status, job_date, completed_date, scheduled_date").eq("business_id", businessId).not("status", "in", "(paid,cancelled)").limit(5000),
    client.from("quotes").select("id, quote_date").eq("business_id", businessId).in("status", ["draft", "sent", "accepted", "no_response"]).limit(5000),
    client.from("invoices").select("id, invoice_date").eq("business_id", businessId).eq("status", "unpaid").limit(5000),
  ]);
  for (const result of [customers, jobs, quotes, invoices]) if (result.error) throw new Error(`Unable to load dashboard counts: ${result.error.message}`);
  return {
    customers: (customers.data ?? []).filter((item) => inRange(item.created_at.slice(0, 10), range)).length,
    jobs: (jobs.data ?? []).filter((item) => inRange(item.job_date ?? item.completed_date ?? item.scheduled_date, range)).length,
    quotes: (quotes.data ?? []).filter((item) => inRange(item.quote_date, range)).length,
    invoices: (invoices.data ?? []).filter((item) => inRange(item.invoice_date, range)).length,
  };
}

export async function getReportData(client: Client, businessId: number) {
  const [jobs, invoices, expenses, quotes, payments] = await Promise.all([
    client.from("jobs").select("id, status, job_date, paid_date, amount_quoted, amount_paid, machine_hours, referral_source").eq("business_id", businessId).limit(10000),
    client.from("invoices").select("id, job_id, status, amount, invoice_date").eq("business_id", businessId).limit(10000),
    client.from("expenses").select("id, amount, expense_date, category, transaction_type, voided_at").eq("business_id", businessId).limit(10000),
    client.from("quotes").select("id, status, quoted_price, quote_date").eq("business_id", businessId).limit(10000),
    client.from("payments").select("id, amount, payment_date, job_id, invoice_id, voided_at").eq("business_id", businessId).limit(10000),
  ]);
  for (const result of [jobs, invoices, expenses, quotes, payments]) if (result.error) throw new Error(`Unable to load reports: ${result.error.message}`);
  return {
    jobs: jobs.data ?? [],
    invoices: invoices.data ?? [],
    expenses: expenses.data ?? [],
    quotes: quotes.data ?? [],
    payments: actualCashReceipts({ payments: payments.data ?? [], jobs: jobs.data ?? [], invoices: invoices.data ?? [] }),
  };
}
