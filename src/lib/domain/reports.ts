export type ReportData = {
  jobs: { status: string; job_date: string | null; amount_paid: number | null; amount_quoted: number | null; machine_hours: number | null; referral_source: string | null }[];
  invoices: { status: string; amount: number; invoice_date: string }[];
  expenses: { amount: number; expense_date: string; category: string }[];
  quotes: { status: string; quoted_price: number; quote_date: string }[];
};
export function buildReportSummary(data: ReportData) {
  const paidRevenue = data.jobs.reduce((sum, job) => sum + (job.amount_paid ?? 0), 0);
  const expenses = data.expenses.reduce((sum, expense) => sum + expense.amount, 0);
  const decisions = data.quotes.filter((quote) => ["accepted", "converted", "declined", "no_response", "expired"].includes(quote.status));
  const accepted = decisions.filter((quote) => ["accepted", "converted"].includes(quote.status));
  const months = new Map<string, { revenue: number; expenses: number }>();
  data.jobs.forEach((job) => { if (!job.job_date) return; const key = job.job_date.slice(0, 7); const value = months.get(key) ?? { revenue: 0, expenses: 0 }; value.revenue += job.amount_paid ?? 0; months.set(key, value); });
  data.expenses.forEach((expense) => { const key = expense.expense_date.slice(0, 7); const value = months.get(key) ?? { revenue: 0, expenses: 0 }; value.expenses += expense.amount; months.set(key, value); });
  return {
    paidRevenue, expenses, net: paidRevenue - expenses,
    outstandingInvoices: data.invoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.amount, 0),
    quotedPipeline: data.quotes.filter((quote) => ["draft", "sent", "accepted"].includes(quote.status)).reduce((sum, quote) => sum + quote.quoted_price, 0),
    acceptanceRate: decisions.length ? Math.round((accepted.length / decisions.length) * 1000) / 10 : 0,
    machineHours: data.jobs.reduce((sum, job) => sum + (job.machine_hours ?? 0), 0),
    jobStatuses: Object.entries(data.jobs.reduce<Record<string, number>>((counts, job) => ({ ...counts, [job.status]: (counts[job.status] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]),
    months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 18).map(([month, values]) => ({ month, ...values, net: values.revenue - values.expenses })),
  };
}
