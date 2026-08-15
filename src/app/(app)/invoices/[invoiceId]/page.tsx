import type { Metadata } from "next";
import Link from "next/link";
import { Download, Plus } from "lucide-react";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { RecordLifecycleControl } from "@/components/record-lifecycle-control";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { invoiceStatusLabel } from "@/lib/domain/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { listPayments } from "@/lib/repositories/accounting-repository";
import { getInvoice } from "@/lib/repositories/invoice-repository";
import { createClient } from "@/lib/supabase/server";
import { InvoiceStatusForm } from "../status-form";

export const metadata: Metadata = { title: "Invoice details" };

export default async function InvoicePage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const id = Number((await params).invoiceId);
  if (!Number.isInteger(id)) notFound();
  const context = await requireBusinessContext();
  const { business } = context;
  const client = await createClient();
  const [invoice, payments] = await Promise.all([getInvoice(client, business.id, id), listPayments(client, business.id, id)]);
  if (!invoice) notFound();
  const paid = payments.reduce((sum, payment) => sum + payment.amount, 0);
  const balance = Math.max(0, invoice.amount - paid);
  const actions = <div className="flex flex-wrap gap-2">{!invoice.archived_at ? <Link className="flex h-10 items-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/finance/payments/new?invoice=${id}`}><Plus size={16} />Record payment</Link> : null}<a className="flex h-10 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold" href={`/invoices/${id}/pdf`}><Download size={16} />PDF</a></div>;
  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader actions={actions} description={formatDate(invoice.invoice_date)} title={invoice.invoice_number} />{context.role !== "employee" ? <section className="mt-5 rounded-lg border border-line bg-surface p-4 shadow-sm"><RecordLifecycleControl archived={Boolean(invoice.archived_at)} id={invoice.id} label="invoice" type="invoice" /></section> : null}<div className="grid gap-5 py-6 md:grid-cols-[1fr_0.75fr]"><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex justify-between"><h2 className="font-bold">Invoice</h2><StatusBadge label={invoiceStatusLabel(invoice.status)} status={invoice.status} /></div><dl className="mt-5 grid gap-5 sm:grid-cols-2"><div><dt className="text-xs uppercase text-muted">Customer</dt><dd className="mt-1"><Link className="font-semibold text-brand" href={`/customers/${invoice.customer_id}`}>{customerDisplayName(invoice.customers)}</Link></dd></div><div><dt className="text-xs uppercase text-muted">Invoice amount</dt><dd className="mt-1 text-xl font-bold">{formatCurrency(invoice.amount)}</dd></div><div><dt className="text-xs uppercase text-muted">Paid</dt><dd className="mt-1 text-xl font-bold">{formatCurrency(paid)}</dd></div><div><dt className="text-xs uppercase text-muted">Balance</dt><dd className="mt-1 text-xl font-bold">{formatCurrency(balance)}</dd></div><div><dt className="text-xs uppercase text-muted">Due date</dt><dd className="mt-1 font-semibold">{formatDate(invoice.due_date)}</dd></div><div><dt className="text-xs uppercase text-muted">Paid date</dt><dd className="mt-1 font-semibold">{formatDate(invoice.paid_date)}</dd></div><div className="sm:col-span-2"><dt className="text-xs uppercase text-muted">Payment terms</dt><dd className="mt-1">{invoice.payment_terms || "Not recorded"}</dd></div>{invoice.jobs ? <div className="sm:col-span-2"><dt className="text-xs uppercase text-muted">Linked job</dt><dd className="mt-1"><Link className="font-semibold text-brand" href={`/jobs/${invoice.jobs.id}`}>{invoice.jobs.work_description || `Job #${invoice.jobs.id}`}</Link></dd></div> : null}</dl>{invoice.notes ? <div className="mt-5 border-t border-line pt-5"><h3 className="font-semibold">Internal notes</h3><p className="mt-2 whitespace-pre-wrap text-sm text-muted">{invoice.notes}</p></div> : null}<div className="mt-5 border-t border-line pt-5"><h3 className="font-semibold">Payment history</h3><div className="mt-3 space-y-2">{payments.map((payment) => <div className="flex justify-between gap-3 text-sm" key={payment.id}><span>{formatDate(payment.payment_date)} · {payment.method || payment.source.replaceAll("_", " ")}</span><strong>{formatCurrency(payment.amount)}</strong></div>)}{!payments.length ? <p className="text-sm text-muted">No payments recorded.</p> : null}</div></div></section><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Update status</h2><p className="mt-2 text-sm text-muted">Use Record payment for partial or reconciled payments. Status changes remain available for correcting historical records.</p><div className="mt-4"><InvoiceStatusForm invoiceId={id} status={invoice.status} /></div></section></div></div>;
}
