import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatCurrency } from "@/lib/format";
import { getBankTransaction } from "@/lib/repositories/accounting-repository";
import { listInvoices } from "@/lib/repositories/invoice-repository";
import { listJobOptions } from "@/lib/repositories/job-repository";
import { createClient } from "@/lib/supabase/server";
import { PaymentForm } from "./payment-form";

export const metadata: Metadata = { title: "Record payment" };

export default async function NewPaymentPage({ searchParams }: { searchParams: Promise<{ bankTransaction?: string; invoice?: string; job?: string }> }) {
  const query = await searchParams;
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect("/finance");
  const client = await createClient();
  const bankTransactionId = Number(query.bankTransaction);
  const [bankTransaction, invoices, jobs] = await Promise.all([
    Number.isInteger(bankTransactionId) ? getBankTransaction(client, business.id, bankTransactionId) : null,
    listInvoices(client, business.id),
    listJobOptions(client, business.id),
  ]);
  if (bankTransaction && (bankTransaction.amount <= 0 || bankTransaction.status !== "unreviewed")) notFound();
  const invoiceId = Number(query.invoice);
  const selectedInvoice = invoices.find((invoice) => invoice.id === invoiceId);
  // Resolved against this business's own jobs rather than trusted from the query,
  // so a foreign or stale id simply prefills nothing.
  const requestedJobId = Number(query.job);
  const selectedJob = jobs.find((job) => job.id === requestedJobId);
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description={bankTransaction ? `Reconcile deposit ${formatCurrency(bankTransaction.amount)} from ${bankTransaction.description}.` : "Record cash received and keep invoice, job, and ledger totals synchronized."} title="Record payment" /><PaymentForm defaults={{ invoiceId: selectedInvoice?.id, jobId: selectedInvoice?.job_id ?? selectedJob?.id, bankTransactionId: bankTransaction?.id, paymentDate: bankTransaction?.transaction_date ?? dateInTimeZone(business.timezone), amount: bankTransaction?.amount, reference: bankTransaction?.description }} invoices={invoices.map((invoice) => ({ id: invoice.id, label: `${invoice.invoice_number} · ${customerDisplayName(invoice.customers)} · ${formatCurrency(invoice.amount)}` }))} jobs={jobs} /></div>;
}
