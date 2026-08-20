import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, ArrowDown, ArrowUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { formatCurrency } from "@/lib/format";
import {
  listCustomerSummaries,
  type CustomerSortDirection,
  type CustomerSortField,
} from "@/lib/repositories/customer-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Customers" };

const sortFields: CustomerSortField[] = ["name", "contact", "jobs", "revenue", "date"];

const columns: { field: CustomerSortField; label: string; align?: "right" }[] = [
  { field: "name", label: "Customer" },
  { field: "contact", label: "Contact" },
  { field: "jobs", label: "Jobs", align: "right" },
  { field: "revenue", label: "Paid revenue", align: "right" },
  { field: "date", label: "Date", align: "right" },
];

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; dir?: string }>;
}) {
  const { q = "", sort: sortParameter, dir: dirParameter } = await searchParams;
  const field: CustomerSortField = sortFields.includes(sortParameter as CustomerSortField)
    ? (sortParameter as CustomerSortField)
    : "name";
  const direction: CustomerSortDirection = dirParameter === "desc" ? "desc" : "asc";
  const context = await requireBusinessContext();
  const { business } = context;
  const customers = await listCustomerSummaries(await createClient(), business.id, q, { field, direction });

  const sortHref = (column: CustomerSortField) => {
    const nextDirection: CustomerSortDirection = field === column && direction === "asc" ? "desc" : "asc";
    const parameters = new URLSearchParams();
    if (q) parameters.set("q", q);
    parameters.set("sort", column);
    parameters.set("dir", nextDirection);
    return `?${parameters.toString()}`;
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <PageHeader
        actions={context.role !== "intern" ? <Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand hover:bg-brand-strong" href="/customers/new"><Plus aria-hidden="true" size={18} />Add customer</Link> : null}
        description={`${customers.length} customer${customers.length === 1 ? "" : "s"}`}
        title="Customers"
      />
      <form className="my-5 flex max-w-2xl gap-2" method="get">
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Search customers</span>
          <Search aria-hidden="true" className="absolute left-3 top-3 text-muted" size={18} />
          <input className="h-11 w-full rounded-md border border-line-strong bg-surface pl-10 pr-3 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" defaultValue={q} name="q" placeholder="Name, company, phone, or email" />
        </label>
        <button className="h-11 rounded-md border border-line-strong bg-surface px-4 font-semibold hover:bg-surface-muted">Search</button>
      </form>

      <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        {customers.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="bg-surface-muted text-xs uppercase text-muted">
                <tr>
                  {columns.map((column) => (
                    <th className={`px-4 py-3 ${column.align === "right" ? "text-right" : ""}`} key={column.field}>
                      <Link
                        className={`inline-flex items-center gap-1 hover:text-body ${column.align === "right" ? "flex-row-reverse" : ""}`}
                        href={sortHref(column.field)}
                      >
                        {column.label}
                        {field === column.field ? (
                          direction === "asc" ? <ArrowUp aria-hidden="true" size={12} /> : <ArrowDown aria-hidden="true" size={12} />
                        ) : null}
                      </Link>
                    </th>
                  ))}
                  <th className="w-20 px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => (
                  <tr className="hover:bg-page" key={customer.id}>
                    <td className="px-4 py-4"><Link className="font-semibold text-brand hover:underline" href={`/customers/${customer.id}`}>{customer.displayName}</Link><p className="mt-1 text-xs text-muted">{customer.active ? customer.customer_type === "company" ? "Company" : "Individual" : "Inactive"}</p></td>
                    <td className="px-4 py-4 text-sm"><p>{customer.phone || "No phone"}</p><p className="mt-1 text-muted">{customer.email || "No email"}</p></td>
                    <td className="px-4 py-4 text-right tabular-nums">{customer.jobCount}</td>
                    <td className="px-4 py-4 text-right font-semibold tabular-nums">{formatCurrency(customer.paidRevenue)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{dateInTimeZone(business.timezone, new Date(customer.created_at))}</td>
                    <td className="px-4 py-4 text-right">{context.role !== "intern" ? <Link className="text-sm font-semibold text-brand hover:underline" href={`/customers/${customer.id}/edit`}>Edit</Link> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <div className="px-5 py-14 text-center"><p className="font-semibold">No customers found</p><p className="mt-1 text-sm text-muted">Try a different search or add a customer.</p></div>}
      </div>
    </div>
  );
}
