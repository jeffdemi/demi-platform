import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpDown, ArrowUpFromLine, RefreshCw, Sparkles, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { listBankTransactions } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<{ status?: string; sort?: string; direction?: string }> }) {
  const { status, sort: requestedSort, direction: requestedDirection } = await searchParams;
  const sort = requestedSort === "description" ? "description" : "date";
  const direction = requestedDirection === "asc" ? "asc" : "desc";
  const context = await requireBusinessContext();
  const client = await createClient();
  const transactions = await listBankTransactions(client, context.business.id, status, sort, direction);
  const allTransactions = status ? await listBankTransactions(client, context.business.id) : transactions;
  const unreviewedCount = allTransactions.filter((transaction) => transaction.status === "unreviewed").length;
  const deposits = allTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const withdrawals = allTransactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const sortHref = (column: "date" | "description") => {
    const nextDirection = sort === column ? (direction === "asc" ? "desc" : "asc") : (column === "date" ? "desc" : "asc");
    const params = new URLSearchParams({ sort: column, direction: nextDirection });
    if (status) params.set("status", status);
    return `/transactions?${params}`;
  };
  const filterHref = (value: string) => {
    const params = new URLSearchParams({ sort, direction });
    if (value) params.set("status", value);
    return `/transactions?${params}`;
  };
  const canManage = context.role !== "employee" && context.role !== "intern";
  const actions = <div className="flex flex-wrap gap-2">
    {canManage ? <><Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/transactions/bank-sync"><RefreshCw size={17} />Bank sync</Link><Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/transactions/matching"><Sparkles size={17} />Review automatic matches</Link><Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance/suggestions"><Sparkles size={17} />Approve learned classifications</Link></> : null}
    {context.role !== "intern" ? <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/transactions/import"><Upload size={17} />CSV import</Link> : null}
  </div>;
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={actions} description="Download, review, and categorize your bank transactions." title="Transactions" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">
      {[["Unreviewed items", String(unreviewedCount)], ["Imported deposits", formatCurrency(deposits)], ["Imported withdrawals", formatCurrency(withdrawals)], ["Net imported cash", formatCurrency(deposits - withdrawals)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}
    </section>
    <section className="min-w-0 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 className="font-bold">Bank transactions</h2><div className="flex flex-wrap gap-2 text-sm">{["", "unreviewed", "partially_matched", "matched", "excluded"].map((value) => <Link className={`rounded-md px-2 py-1 font-semibold ${status === value || (!status && !value) ? "bg-brand text-on-brand" : "border border-line-strong"}`} href={filterHref(value)} key={value}>{value ? value.replaceAll("_", " ") : "All"}</Link>)}</div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] table-fixed text-left text-sm"><colgroup><col className="w-[130px]" /><col className="w-[190px]" /><col /><col className="w-[145px]" /><col className="w-[120px]" /><col className="w-[190px]" /></colgroup><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3"><Link className="inline-flex items-center gap-1 hover:text-foreground" href={sortHref("date")}>Date<ArrowUpDown size={13} /></Link></th><th className="px-4 py-3">Account</th><th className="px-4 py-3"><Link className="inline-flex items-center gap-1 hover:text-foreground" href={sortHref("description")}>Description<ArrowUpDown size={13} /></Link></th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-line">{transactions.map((transaction) => <tr key={transaction.id}><td className="whitespace-nowrap px-4 py-3">{formatDate(transaction.transaction_date)}</td><td className="break-words px-4 py-3">{transaction.bank_accounts?.name ?? `Account #${transaction.account_id}`}</td><td className="truncate px-4 py-3 font-semibold" title={transaction.description}>{transaction.description}</td><td className="px-4 py-3"><StatusBadge label={transaction.status.replaceAll("_", " ")} status={transaction.status} /></td><td className={`whitespace-nowrap px-4 py-3 text-right font-bold tabular-nums ${transaction.amount > 0 ? "text-success" : ""}`}>{transaction.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount))}</td><td className="px-4 py-3">{["unreviewed", "partially_matched"].includes(transaction.status) ? <div className="flex items-center gap-2"><Link className="inline-flex h-9 whitespace-nowrap rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/transactions/${transaction.id}`}>Review / match</Link>{transaction.status === "unreviewed" && context.role !== "intern" ? <>{transaction.amount < 0 ? <Link aria-label="Create expense" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong" href={`/expenses/new?bankTransaction=${transaction.id}`}><ArrowUpFromLine size={15} /></Link> : <Link aria-label="Record payment" className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong" href={`/finance/payments/new?bankTransaction=${transaction.id}`}><ArrowDownToLine size={15} /></Link>}</> : null}</div> : transaction.status === "matched" ? "Matched" : transaction.excluded_reason || "Excluded"}</td></tr>)}{!transactions.length && <tr><td className="px-5 py-14 text-center text-muted" colSpan={6}>No imported bank transactions.</td></tr>}</tbody></table></div>
    </section>
  </div>;
}
