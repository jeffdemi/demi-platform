import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { invoiceStatusLabel, invoiceStatusOptions } from "@/lib/domain/finance";
import { formatCurrency, formatDate } from "@/lib/format";
import { listInvoices } from "@/lib/repositories/invoice-repository";
import { createClient } from "@/lib/supabase/server";
export const metadata: Metadata = { title: "Invoices" };
export default async function InvoicesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) { const { status } = await searchParams; const { business } = await requireBusinessContext(); const invoices = await listInvoices(await createClient(), business.id, status); return <div className="mx-auto w-full max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/invoices/new"><Plus size={18} />Add invoice</Link>} description={`${invoices.length} invoice${invoices.length === 1 ? "" : "s"}`} title="Invoices" /><form className="my-5 flex max-w-sm gap-2"><select className="h-11 flex-1 rounded-md border border-line-strong bg-surface px-3" defaultValue={status ?? ""} name="status"><option value="">All statuses</option>{invoiceStatusOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button className="h-11 rounded-md border border-line-strong px-4 font-semibold">Apply</button></form><div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="divide-y divide-line">{invoices.map((invoice) => <Link className="grid gap-3 px-4 py-4 hover:bg-page sm:grid-cols-[150px_minmax(0,1fr)_140px_130px] sm:items-center" href={`/invoices/${invoice.id}`} key={invoice.id}><div><p className="font-semibold text-brand">{invoice.invoice_number}</p><p className="mt-1 text-sm text-muted">{formatDate(invoice.invoice_date)}</p></div><p className="font-semibold">{customerDisplayName(invoice.customers)}</p><StatusBadge label={invoiceStatusLabel(invoice.status)} status={invoice.status} /><p className="font-semibold tabular-nums sm:text-right">{formatCurrency(invoice.amount)}</p></Link>)}{!invoices.length && <p className="px-5 py-14 text-center text-muted">No invoices found.</p>}</div></div></div>; }
