import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, CalendarCheck, Landmark, Upload } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { listBankAccounts, listBankTransactions } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { BankAccountForm, ExcludeTransactionForm } from "./finance-forms";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  const context = await requireBusinessContext();
  const { business } = context;
  const client = await createClient();
  const [accounts, transactions] = await Promise.all([
    listBankAccounts(client, business.id),
    listBankTransactions(client, business.id, status),
  ]);
  const allTransactions = status ? await listBankTransactions(client, business.id) : transactions;
  const unreviewed = allTransactions.filter((transaction) => transaction.status === "unreviewed");
  const deposits = allTransactions.filter((transaction) => transaction.amount > 0).reduce((sum, transaction) => sum + transaction.amount, 0);
  const withdrawals = allTransactions.filter((transaction) => transaction.amount < 0).reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);
  const actions = <div className="flex flex-wrap gap-2">{context.role !== "employee" ? <Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance/month-end"><CalendarCheck size={17} />Month-end close</Link> : null}<Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/finance/import"><Upload size={17} />Import statement</Link></div>;
  return <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={actions} description="Reconcile actual cash activity with expenses and customer payments." title="Finance" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">
      {[["Unreviewed", String(unreviewed.length)], ["Imported deposits", formatCurrency(deposits)], ["Imported withdrawals", formatCurrency(withdrawals)], ["Net imported cash", formatCurrency(deposits - withdrawals)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}
    </section>
    <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
      <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3"><h2 className="font-bold">Bank transactions</h2><div className="flex gap-2 text-sm">{["", "unreviewed", "matched", "excluded"].map((value) => <Link className={`rounded-md px-2 py-1 font-semibold ${status === value || (!status && !value) ? "bg-brand text-on-brand" : "border border-line-strong"}`} href={value ? `/finance?status=${value}` : "/finance"} key={value}>{value ? value.replaceAll("_", " ") : "All"}</Link>)}</div></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Account</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Action</th></tr></thead><tbody className="divide-y divide-line">{transactions.map((transaction) => <tr key={transaction.id}><td className="px-4 py-3">{formatDate(transaction.transaction_date)}</td><td className="px-4 py-3">{transaction.bank_accounts?.name ?? `Account #${transaction.account_id}`}</td><td className="px-4 py-3 font-semibold">{transaction.description}</td><td className="px-4 py-3"><StatusBadge label={transaction.status.replaceAll("_", " ")} status={transaction.status} /></td><td className={`px-4 py-3 text-right font-bold tabular-nums ${transaction.amount > 0 ? "text-success" : ""}`}>{transaction.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(transaction.amount))}</td><td className="px-4 py-3">{transaction.status === "unreviewed" ? <div className="flex items-center gap-2">{transaction.amount < 0 ? <Link className="inline-flex h-9 items-center gap-1 rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/expenses/new?bankTransaction=${transaction.id}`}><ArrowUpFromLine size={15} />Expense</Link> : <Link className="inline-flex h-9 items-center gap-1 rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/finance/payments/new?bankTransaction=${transaction.id}`}><ArrowDownToLine size={15} />Payment</Link>}<ExcludeTransactionForm transactionId={transaction.id} /></div> : transaction.excluded_reason || "Reconciled"}</td></tr>)}{!transactions.length && <tr><td className="px-5 py-14 text-center text-muted" colSpan={6}>No imported bank transactions.</td></tr>}</tbody></table></div>
      </section>
      <div className="space-y-5"><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center gap-2"><Landmark className="text-brand" size={18} /><h2 className="font-bold">Accounts</h2></div><div className="mt-4 space-y-2">{accounts.map((account) => <div className="border-b border-line pb-2 text-sm" key={account.id}><p className="font-semibold">{account.name}</p><p className="text-muted">{account.institution || account.account_type.replaceAll("_", " ")}{account.last_four ? ` · ${account.last_four}` : ""}</p></div>)}{!accounts.length && <p className="text-sm text-muted">Add the account used by your statement export.</p>}</div></section><section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Add account</h2><div className="mt-4"><BankAccountForm /></div></section></div>
    </div>
  </div>;
}
