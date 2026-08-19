import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { getBankTransactionReview } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { ExcludeTransactionForm } from "../../finance-forms";
import { AllocationForm, ExistingExpenseMatchForm, FuzzyExpenseMatchList, ReverseAllocationForm, TransferForm } from "../../bookkeeping-forms";

export const metadata: Metadata = { title: "Review Bank Transaction" };

export default async function TransactionReviewPage({ params }: { params: Promise<{ transactionId: string }> }) {
  const context = await requireBusinessContext();
  if ((context.role === "employee" || context.role === "intern")) redirect("/finance");
  const transactionId = Number((await params).transactionId);
  if (!Number.isInteger(transactionId)) notFound();
  const review = await getBankTransactionReview(await createClient(), context.business.id, transactionId);
  if (!review.transaction) notFound();
  const transaction = review.transaction;
  const allocated = review.allocations.reduce((sum, allocation) => sum + allocation.amount, 0);
  const remaining = Math.max(0, Math.round((Math.abs(transaction.amount) - allocated) * 100) / 100);
  const transferCandidates = review.transferCandidates.filter((candidate) => candidate.account_id !== transaction.account_id && Math.sign(candidate.amount) !== Math.sign(transaction.amount) && Math.abs(Math.abs(candidate.amount) - Math.abs(transaction.amount)) <= 0.005);
  const canReview = ["unreviewed", "partially_matched"].includes(transaction.status);
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href={transaction.statement_period_id ? `/finance/reconciliations/${transaction.statement_period_id}` : "/finance"}><ArrowLeft size={17} />Back</Link>} description={`${formatDate(transaction.transaction_date)} · ${transaction.bank_accounts?.name ?? "Bank account"}`} title={transaction.description} />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">{[["Amount", `${transaction.amount > 0 ? "+" : "-"}${formatCurrency(Math.abs(transaction.amount))}`], ["Status", transaction.status.replaceAll("_", " ")], ["Allocated", formatCurrency(allocated)], ["Remaining", formatCurrency(remaining)]].map(([label, value]) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={label}><p className="text-xl font-bold tabular-nums">{value}</p><p className="mt-1 text-xs text-muted">{label}</p></div>)}</section>
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="flex items-center justify-between gap-3"><h2 className="font-bold">Split or classify transaction</h2><StatusBadge label={transaction.status.replaceAll("_", " ")} status={transaction.status} /></div><p className="mt-1 mb-5 text-sm leading-6 text-muted">Choose the other side of the bookkeeping entry. Add multiple allocations when one bank transaction covers more than one purpose.</p>{canReview ? <AllocationForm accounts={review.ledgerAccounts} description={transaction.description} remaining={remaining} transactionId={transaction.id} /> : <p className="text-sm text-muted">This transaction is fully reviewed. Reverse an allocation before replacing it.</p>}</section>
        <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm"><div className="border-b border-line px-5 py-4"><h2 className="font-bold">Posted allocations</h2></div><div className="divide-y divide-line">{review.allocations.map((allocation) => <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between" key={allocation.id}><div><p className="font-semibold">{allocation.ledger_accounts?.code} · {allocation.ledger_accounts?.name}</p><p className="text-sm text-muted">{allocation.memo}{allocation.tax_category ? ` · ${allocation.tax_category}` : ""}</p><p className="mt-1 font-bold">{formatCurrency(allocation.amount)}</p></div><ReverseAllocationForm allocationId={allocation.id} transactionId={transaction.id} /></div>)}{!review.allocations.length ? <p className="px-5 py-8 text-sm text-muted">No split allocations have been posted.</p> : null}</div></section>
      </div>
      <aside className="space-y-5">
        {transaction.status === "unreviewed" && transaction.amount < 0 ? <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Match recorded expense</h2><p className="mt-1 mb-4 text-sm text-muted">Exact-amount expenses recorded within ten days are suggested here. Matching links the existing record without creating a duplicate expense.</p>{review.suggestedExpenses.length ? <ExistingExpenseMatchForm candidates={review.suggestedExpenses} transactionId={transaction.id} /> : <p className="text-sm text-muted">No exact recorded-expense matches found.</p>}</section> : null}
        {transaction.status === "unreviewed" && transaction.amount < 0 && review.fuzzyExpenseCandidates.length ? <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Possible match (amounts differ)</h2><p className="mt-1 mb-4 text-sm text-muted">These recorded expenses are close in amount and date but do not match exactly, based on your configured tolerance. Approving corrects the expense&apos;s recorded amount to the bank withdrawal and logs the correction.</p><FuzzyExpenseMatchList candidates={review.fuzzyExpenseCandidates} transactionId={transaction.id} /></section> : null}
        {transaction.status === "unreviewed" ? <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Operational record</h2><p className="mt-1 mb-4 text-sm text-muted">Use the normal record form when this is one customer payment or one expense.</p><div className="grid gap-2">{transaction.amount < 0 ? <Link className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/expenses/new?bankTransaction=${transaction.id}`}><ArrowUpFromLine size={16} />Create expense</Link> : <Link className="flex h-10 items-center justify-center gap-2 rounded-md bg-brand px-3 font-semibold text-on-brand" href={`/finance/payments/new?bankTransaction=${transaction.id}`}><ArrowDownToLine size={16} />Record payment</Link>}</div></section> : null}
        {transaction.status === "unreviewed" ? <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Account transfer</h2><p className="mt-1 mb-4 text-sm text-muted">Match both sides so moving money between business accounts does not create income or expense.</p><TransferForm candidates={transferCandidates} transactionId={transaction.id} /></section> : null}
        {transaction.status === "unreviewed" ? <section className="rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Exclude duplicate only</h2><p className="mt-1 mb-4 text-sm text-muted">Real personal spending should be allocated to Owner distributions. Exclude only duplicate or invalid imported rows.</p><ExcludeTransactionForm transactionId={transaction.id} /></section> : null}
      </aside>
    </div>
  </div>;
}
