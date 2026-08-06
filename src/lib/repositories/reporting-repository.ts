import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { cashOutflowImpact, operatingExpenseImpact } from "@/lib/domain/finance";

type Client = SupabaseClient<Database>;

function nextMonth(date: string) {
  const value = new Date(`${date}T12:00:00Z`);
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

export async function getOperationalDashboard(client: Client, businessId: number, today: string) {
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearStart = `${today.slice(0, 4)}-01-01`;
  const followingMonth = nextMonth(monthStart);
  const [jobsResult, invoicesResult, expensesResult, maintenanceResult, paymentsResult, bankReviewResult] = await Promise.all([
    client.from("jobs").select("id, status, job_date, scheduled_date, scheduled_start_time, work_description, amount_paid, amount_quoted, machine_hours, referral_source, customers(first_name, last_name, company_name, customer_type)").eq("business_id", businessId).limit(5000),
    client.from("invoices").select("id, invoice_number, status, amount, invoice_date, due_date, customer_id, customers(first_name, last_name, company_name, customer_type)").eq("business_id", businessId).limit(5000),
    client.from("expenses").select("id, amount, expense_date, transaction_type, voided_at").eq("business_id", businessId).limit(5000),
    client.from("maintenance").select("id, equipment_id, next_due_date, next_due_hours, service_type, equipment(name, hour_meter)").eq("business_id", businessId).not("next_due_date", "is", null).order("next_due_date").limit(8),
    client.from("payments").select("id, amount, payment_date, voided_at").eq("business_id", businessId).is("voided_at", null).limit(5000),
    client.from("bank_transactions").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "unreviewed"),
  ]);
  for (const result of [jobsResult, invoicesResult, expensesResult, maintenanceResult, paymentsResult, bankReviewResult]) if (result.error) throw new Error(`Unable to load dashboard: ${result.error.message}`);
  const jobs = jobsResult.data ?? [];
  const invoices = invoicesResult.data ?? [];
  const expenses = (expensesResult.data ?? []).filter((expense) => !expense.voided_at);
  const paidJobs = jobs.filter((job) => (job.amount_paid ?? 0) > 0);
  const payments = paymentsResult.data ?? [];
  const revenue = (start: string, end?: string) => payments.filter((payment) => payment.payment_date >= start && (!end || payment.payment_date < end)).reduce((sum, payment) => sum + payment.amount, 0);
  const referral = new Map<string, number>();
  paidJobs.forEach((job) => referral.set(job.referral_source || "Not recorded", (referral.get(job.referral_source || "Not recorded") ?? 0) + (job.amount_paid ?? 0)));
  return {
    metrics: {
      revenueToday: revenue(today, new Date(new Date(`${today}T12:00:00Z`).valueOf() + 86400000).toISOString().slice(0, 10)),
      revenueMonth: revenue(monthStart, followingMonth), revenueYear: revenue(yearStart),
      outstandingInvoices: invoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.amount, 0),
      averagePaidJob: payments.length ? payments.reduce((sum, payment) => sum + payment.amount, 0) / payments.length : 0,
      expensesMonth: expenses.filter((expense) => expense.expense_date >= monthStart && expense.expense_date < followingMonth).reduce((sum, expense) => sum + operatingExpenseImpact(expense), 0),
      capitalPurchasesMonth: expenses.filter((expense) => expense.expense_date >= monthStart && expense.expense_date < followingMonth && expense.transaction_type === "asset").reduce((sum, expense) => sum + expense.amount, 0),
      refundsMonth: expenses.filter((expense) => expense.expense_date >= monthStart && expense.expense_date < followingMonth && expense.transaction_type === "refund").reduce((sum, expense) => sum + expense.amount, 0),
      cashOutflowMonth: expenses.filter((expense) => expense.expense_date >= monthStart && expense.expense_date < followingMonth).reduce((sum, expense) => sum + cashOutflowImpact(expense), 0),
      machineHours: jobs.reduce((sum, job) => sum + (job.machine_hours ?? 0), 0),
      unreviewedBankTransactions: bankReviewResult.count ?? 0,
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

export async function getEntityCounts(client: Client, businessId: number) {
  const [customers, jobs, quotes, invoices] = await Promise.all([
    client.from("customers").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("active", true),
    client.from("jobs").select("id", { count: "exact", head: true }).eq("business_id", businessId).not("status", "in", "(paid,cancelled)"),
    client.from("quotes").select("id", { count: "exact", head: true }).eq("business_id", businessId).in("status", ["draft", "sent", "accepted", "no_response"]),
    client.from("invoices").select("id", { count: "exact", head: true }).eq("business_id", businessId).eq("status", "unpaid"),
  ]);
  return { customers: customers.count ?? 0, jobs: jobs.count ?? 0, quotes: quotes.count ?? 0, invoices: invoices.count ?? 0 };
}

export async function getReportData(client: Client, businessId: number) {
  const [jobs, invoices, expenses, quotes, payments] = await Promise.all([
    client.from("jobs").select("id, status, job_date, amount_quoted, amount_paid, machine_hours, referral_source").eq("business_id", businessId).limit(10000),
    client.from("invoices").select("id, status, amount, invoice_date").eq("business_id", businessId).limit(10000),
    client.from("expenses").select("id, amount, expense_date, category, transaction_type, voided_at").eq("business_id", businessId).limit(10000),
    client.from("quotes").select("id, status, quoted_price, quote_date").eq("business_id", businessId).limit(10000),
    client.from("payments").select("id, amount, payment_date, voided_at").eq("business_id", businessId).limit(10000),
  ]);
  for (const result of [jobs, invoices, expenses, quotes, payments]) if (result.error) throw new Error(`Unable to load reports: ${result.error.message}`);
  return { jobs: jobs.data ?? [], invoices: invoices.data ?? [], expenses: expenses.data ?? [], quotes: quotes.data ?? [], payments: payments.data ?? [] };
}
