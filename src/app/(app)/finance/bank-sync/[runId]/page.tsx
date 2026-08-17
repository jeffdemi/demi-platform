import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireBusinessContext } from "@/lib/auth";
import type { BankSyncPreview, BankSyncSummary } from "@/lib/domain/bank-sync";
import { formatCurrency, formatDate } from "@/lib/format";
import { getBankSyncRun } from "@/lib/repositories/bank-sync-repository";
import { createClient } from "@/lib/supabase/server";
import { ConfirmSyncForm } from "../confirm-sync-form";

export const metadata: Metadata = { title: "Review bank activity" };

const explanations = {
  existing: "Already present from a CSV or earlier sync. Confirmation attaches the SimpleFIN ID; it does not make a duplicate.",
  new: "New posted activity. Confirmation adds one unreviewed Finance row.",
  ambiguous: "A possible existing row was found, but the match is not certain. It will not be imported.",
  pending: "Still pending at the bank. It will not be imported until a later sync shows it as posted.",
} as const;

export default async function BankSyncPreviewPage({ params }: { params: Promise<{ runId: string }> }) {
  const context = await requireBusinessContext();
  if (context.role === "employee") redirect("/finance");
  const runId = (await params).runId;
  const run = await getBankSyncRun(await createClient(), context.business.id, runId);
  if (!run) notFound();
  const preview = run.preview as unknown as BankSyncPreview;
  const summary = run.summary as unknown as BankSyncSummary;
  const result = run.result as { linked?: number; imported?: number; skipped?: number } | null;
  return <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/finance/bank-sync"><ArrowLeft size={17} />Bank sync</Link>} description={`Generated ${new Date(preview.generatedAt).toLocaleString("en-US")}. No rows are changed until confirmation.`} title="Review bank activity" />
    <section className="grid grid-cols-2 gap-3 py-6 sm:grid-cols-4">{(["new", "existing", "ambiguous", "pending"] as const).map((outcome) => <div className="rounded-lg border border-line bg-surface p-4 shadow-sm" key={outcome}><p className="text-xl font-bold">{summary[outcome] ?? 0}</p><p className="mt-1 text-xs capitalize text-muted">{outcome === "existing" ? "already present" : outcome}</p></div>)}</section>
    <section className="mb-5 grid gap-3 md:grid-cols-2">{(["new", "existing", "ambiguous", "pending"] as const).map((outcome) => <div className="rounded-md border border-line bg-surface-muted p-3 text-sm" key={outcome}><strong className="capitalize">{outcome === "existing" ? "Already present" : outcome}</strong><p className="mt-1 text-muted">{explanations[outcome]}</p></div>)}</section>
    <div className="space-y-5">{preview.accounts.map((account) => <section className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm" key={account.connectionAccountId}><div className="border-b border-line px-5 py-4"><h2 className="font-bold">{account.institutionName} · {account.accountName}</h2><p className="mt-1 text-sm text-muted">Compared {formatDate(account.startDate)} through {formatDate(account.endDate)}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-left text-sm"><colgroup><col className="w-[125px]" /><col /><col className="w-[145px]" /><col className="w-[130px]" /><col className="w-[180px]" /></colgroup><thead className="bg-surface-muted text-xs uppercase text-muted"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Description</th><th className="px-4 py-3">Result</th><th className="px-4 py-3 text-right">Amount</th><th className="px-4 py-3">Existing row</th></tr></thead><tbody className="divide-y divide-line">{account.rows.map((row) => <tr key={row.providerTransactionId}><td className="px-4 py-3">{formatDate(row.transactionDate)}</td><td className="truncate px-4 py-3 font-semibold" title={row.description}>{row.description}</td><td className="px-4 py-3"><StatusBadge label={row.outcome === "existing" ? "already present" : row.outcome} status={row.outcome === "new" ? "unreviewed" : row.outcome === "existing" ? "matched" : "pending"} /></td><td className="px-4 py-3 text-right font-bold tabular-nums">{row.amount > 0 ? "+" : "-"}{formatCurrency(Math.abs(row.amount))}</td><td className="px-4 py-3">{row.existingTransactionId ? <Link className="font-semibold text-brand" href={`/finance/transactions/${row.existingTransactionId}`}>Transaction #{row.existingTransactionId}</Link> : row.candidateTransactionIds.length ? `${row.candidateTransactionIds.length} possible matches` : "—"}</td></tr>)}</tbody></table></div></section>)}</div>
    <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-sm"><h2 className="font-bold">Confirm import</h2><p className="my-3 text-sm leading-6 text-muted">Confirmation links the {summary.existing ?? 0} already-present rows and imports the {summary.new ?? 0} new posted rows. The {summary.ambiguous ?? 0} ambiguous and {summary.pending ?? 0} pending rows stay out.</p>{run.status === "confirmed" ? <div className="rounded-md border border-brand-border bg-brand-soft p-4 text-sm text-brand-strong"><strong>Import complete.</strong> Linked {result?.linked ?? 0}; imported {result?.imported ?? 0}; skipped {result?.skipped ?? 0}.</div> : <ConfirmSyncForm disabled={run.status !== "previewed"} runId={run.id} />}</section>
  </div>;
}
