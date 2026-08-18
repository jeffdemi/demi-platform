import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { customerDisplayName } from "@/lib/domain/customers";
import { quotePriceLabel, quoteStatusLabel, quoteStatusOptions } from "@/lib/domain/quotes";
import { formatDate } from "@/lib/format";
import { listQuotes } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Quotes" };
export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; view?: string; archived?: string }> }) {
  const filters = await searchParams; const context = await requireBusinessContext(); const { business } = context;
  const quotes = await listQuotes(await createClient(), business.id, { search: filters.q, status: filters.status, view: filters.view, includeArchived: filters.archived === "1" });
  return <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8"><PageHeader actions={context.role !== "intern" ? <Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/quotes/new"><Plus size={18} />Add quote</Link> : null} description={`${quotes.length} quote${quotes.length === 1 ? "" : "s"}`} title="Quotes" />
    <form className="my-5 grid gap-2 sm:grid-cols-[minmax(220px,1fr)_190px_210px_auto_auto]" method="get"><label className="relative"><span className="sr-only">Search quotes</span><Search className="absolute left-3 top-3 text-muted" size={18} /><input className="h-11 w-full rounded-md border border-line-strong bg-surface pl-10 pr-3" defaultValue={filters.q} name="q" placeholder="Number, customer, address, or scope" /></label><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue={filters.status ?? ""} name="status"><option value="">All statuses</option>{quoteStatusOptions.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}</select><select className="h-11 rounded-md border border-line-strong bg-surface px-3" defaultValue={filters.view ?? ""} name="view"><option value="">All sales views</option><option value="awaiting_response">Awaiting response</option><option value="accepted_unconverted">Accepted, not converted</option><option value="outstanding">Outstanding value</option></select><label className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-3 text-sm"><input defaultChecked={filters.archived === "1"} name="archived" type="checkbox" value="1" />Include archived</label><button className="h-11 rounded-md border border-line-strong bg-surface px-4 font-semibold">Apply</button></form>
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">{quotes.length ? <div className="divide-y divide-line">{quotes.map((quote) => <Link className={`grid gap-3 px-4 py-4 hover:bg-page sm:grid-cols-[130px_minmax(0,1fr)_160px_130px] sm:items-center ${quote.archived_at ? "opacity-55" : ""}`} href={`/quotes/${quote.id}`} key={quote.id}><div><p className="font-semibold text-brand">{quote.quote_number}</p><p className="mt-1 text-sm text-muted">{formatDate(quote.quote_date)}</p></div><div className="min-w-0"><p className="truncate font-semibold">{customerDisplayName(quote.customers)}</p><p className="mt-1 truncate text-sm text-muted">{quote.customer_scope || quote.service_address || "No scope recorded"}</p></div><StatusBadge label={quote.archived_at ? "Archived" : quoteStatusLabel(quote.status)} status={quote.archived_at ? "void" : quote.status} /><p className="font-semibold tabular-nums sm:text-right">{quotePriceLabel(quote)}</p></Link>)}</div> : <div className="px-5 py-14 text-center"><FileText className="mx-auto text-muted" /><p className="mt-3 font-semibold">No quotes found</p></div>}</div>
  </div>;
}
