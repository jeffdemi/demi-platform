export type CashPayment = {
  amount: number;
  payment_date: string | null;
  job_id?: number | null;
  invoice_id?: number | null;
  voided_at?: string | null;
};

export type PaidJob = {
  id: number;
  amount_paid: number | null;
  paid_date?: string | null;
  job_date?: string | null;
};

export type JobInvoice = {
  id: number;
  job_id?: number | null;
};

export type ActualCashReceipt = {
  amount: number;
  payment_date: string | null;
  job_id: number | null;
  source: "payment" | "job_paid_fallback";
};

export function actualCashReceipts({
  payments,
  jobs,
  invoices = [],
}: {
  payments: CashPayment[];
  jobs: PaidJob[];
  invoices?: JobInvoice[];
}): ActualCashReceipt[] {
  const invoiceJobs = new Map(invoices.map((invoice) => [invoice.id, invoice.job_id ?? null]));
  const coveredJobIds = new Set<number>();
  const linkedJobId = (payment: CashPayment) => payment.job_id
    ?? (payment.invoice_id ? invoiceJobs.get(payment.invoice_id) : null)
    ?? null;

  payments.forEach((payment) => {
    const jobId = linkedJobId(payment);
    if (jobId !== null) coveredJobIds.add(jobId);
  });

  const recordedReceipts = payments
    .filter((payment) => !payment.voided_at)
    .map((payment): ActualCashReceipt => {
      const jobId = linkedJobId(payment);
      return {
        amount: payment.amount,
        payment_date: payment.payment_date,
        job_id: jobId,
        source: "payment",
      };
    });

  const jobFallbacks = jobs
    .filter((job) => (job.amount_paid ?? 0) > 0 && !coveredJobIds.has(job.id))
    .map((job): ActualCashReceipt => ({
      amount: job.amount_paid ?? 0,
      payment_date: job.paid_date ?? job.job_date ?? null,
      job_id: job.id,
      source: "job_paid_fallback",
    }));

  return [...recordedReceipts, ...jobFallbacks];
}
