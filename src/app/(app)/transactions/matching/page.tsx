import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/format";
import { listBulkExpenseMatches } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { BulkMatchForm } from "./bulk-match-form";

export const metadata: Metadata = { title: "Bulk expense matching" };

export default async function BulkExpenseMatchingPage() {
  const context = await requireBusinessContext();
  const matches = await listBulkExpenseMatches(await createClient(), context.business.id);
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/transactions"><ArrowLeft size={17} />Transactions</Link>} description="Review unique exact-amount matches before linking imported card charges to expenses already recorded." title="Bulk Expense Matching" />
    <section className="my-6 rounded-lg border border-line bg-surface p-5 shadow-sm">
      <div className="flex items-start gap-3"><Sparkles className="mt-0.5 shrink-0 text-brand" size={20} /><div><h2 className="font-bold">{matches.length} high-confidence match{matches.length === 1 ? "" : "es"}</h2><p className="mt-1 text-sm leading-6 text-muted">Only unique matches with the exact same amount and dates within ten days are included. Ambiguous and unmatched transactions stay unreviewed.</p></div></div>
      <div className="mt-5 overflow-x-auto rounded-lg border border-line"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Card charge</th><th className="px-4 py-3">Recorded expense</th><th className="px-4 py-3 text-right">Amount</th></tr></thead><tbody className="divide-y divide-line">{matches.map((match) => <tr key={match.transactionId}><td className="px-4 py-4"><p className="font-semibold">{match.transactionDescription}</p><p className="text-muted">{formatDate(match.transactionDate)}</p></td><td className="px-4 py-4"><p className="font-semibold">{match.expenseLabel}</p><p className="text-muted">{formatDate(match.expenseDate)} · Expense #{match.expenseId}</p></td><td className="whitespace-nowrap px-4 py-4 text-right font-bold">{formatCurrency(match.amount)}</td></tr>)}{!matches.length ? <tr><td className="px-4 py-10 text-center text-muted" colSpan={3}>No unique exact-amount matches are ready.</td></tr> : null}</tbody></table></div>
      <div className="mt-5"><BulkMatchForm count={matches.length} /></div>
    </section>
  </div>;
}
