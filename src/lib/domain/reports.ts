import { cashOutflowImpact, operatingExpenseImpact } from "./finance";

export type ReportData = {
  jobs: { status: string; job_date: string | null; amount_paid: number | null; amount_quoted: number | null; machine_hours: number | null; referral_source: string | null }[];
  invoices: { status: string; amount: number; invoice_date: string }[];
  expenses: { amount: number; expense_date: string; category: string; transaction_type?: string; voided_at?: string | null }[];
  quotes: { status: string; quoted_price: number; quote_date: string }[];
  payments?: { amount: number; payment_date: string | null; voided_at?: string | null }[];
};

export function buildReportSummary(data: ReportData) {
  const activeExpenses = data.expenses.filter((expense) => !expense.voided_at);
  const activePayments = data.payments?.filter((payment) => !payment.voided_at);
  const paidRevenue = activePayments
    ? activePayments.reduce((sum, payment) => sum + payment.amount, 0)
    : data.jobs.reduce((sum, job) => sum + (job.amount_paid ?? 0), 0);
  const operatingExpenses = activeExpenses.reduce((sum, expense) => sum + operatingExpenseImpact(expense), 0);
  const assetPurchases = activeExpenses.filter((expense) => expense.transaction_type === "asset").reduce((sum, expense) => sum + expense.amount, 0);
  const refunds = activeExpenses.filter((expense) => expense.transaction_type === "refund").reduce((sum, expense) => sum + expense.amount, 0);
  const cashOutflow = activeExpenses.reduce((sum, expense) => sum + cashOutflowImpact(expense), 0);
  const decisions = data.quotes.filter((quote) => ["accepted", "converted", "declined", "no_response", "expired"].includes(quote.status));
  const accepted = decisions.filter((quote) => ["accepted", "converted"].includes(quote.status));
  const months = new Map<string, { revenue: number; operatingExpenses: number; assetPurchases: number; refunds: number; cashOutflow: number }>();
  const monthValue = (key: string) => months.get(key) ?? { revenue: 0, operatingExpenses: 0, assetPurchases: 0, refunds: 0, cashOutflow: 0 };
  (activePayments ?? data.jobs.map((job) => ({ payment_date: job.job_date, amount: job.amount_paid ?? 0 }))).forEach((payment) => {
    if (!payment.payment_date) return;
    const key = payment.payment_date.slice(0, 7);
    const value = monthValue(key);
    value.revenue += payment.amount;
    months.set(key, value);
  });
  activeExpenses.forEach((expense) => {
    const key = expense.expense_date.slice(0, 7);
    const value = monthValue(key);
    value.operatingExpenses += operatingExpenseImpact(expense);
    value.cashOutflow += cashOutflowImpact(expense);
    if (expense.transaction_type === "asset") value.assetPurchases += expense.amount;
    if (expense.transaction_type === "refund") value.refunds += expense.amount;
    months.set(key, value);
  });
  const categories = new Map<string, number>();
  activeExpenses.forEach((expense) => {
    if (expense.transaction_type === "asset") return;
    categories.set(expense.category, (categories.get(expense.category) ?? 0) + operatingExpenseImpact(expense));
  });
  return {
    paidRevenue,
    expenses: operatingExpenses,
    operatingExpenses,
    assetPurchases,
    refunds,
    cashOutflow,
    net: paidRevenue - operatingExpenses,
    cashNet: paidRevenue - cashOutflow,
    outstandingInvoices: data.invoices.filter((invoice) => invoice.status === "unpaid").reduce((sum, invoice) => sum + invoice.amount, 0),
    quotedPipeline: data.quotes.filter((quote) => ["draft", "sent", "accepted"].includes(quote.status)).reduce((sum, quote) => sum + quote.quoted_price, 0),
    acceptanceRate: decisions.length ? Math.round((accepted.length / decisions.length) * 1000) / 10 : 0,
    machineHours: data.jobs.reduce((sum, job) => sum + (job.machine_hours ?? 0), 0),
    jobStatuses: Object.entries(data.jobs.reduce<Record<string, number>>((counts, job) => ({ ...counts, [job.status]: (counts[job.status] ?? 0) + 1 }), {})).sort((a, b) => b[1] - a[1]),
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    months: [...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 18).map(([month, values]) => ({ month, ...values, net: values.revenue - values.operatingExpenses, cashNet: values.revenue - values.cashOutflow })),
  };
}
