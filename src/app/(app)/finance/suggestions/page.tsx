import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { listClassificationSuggestions } from "@/lib/repositories/accounting-repository";
import { createClient } from "@/lib/supabase/server";
import { SuggestionApprovalForm } from "./approval-form";

export const metadata: Metadata = { title: "Approve learned classifications" };

export default async function ClassificationSuggestionsPage({ searchParams }: { searchParams: Promise<{ rule?: string }> }) {
  const context = await requireBusinessContext();
  const requestedRule = Number((await searchParams).rule);
  const ruleId = Number.isInteger(requestedRule) && requestedRule > 0 ? requestedRule : undefined;
  const suggestions = await listClassificationSuggestions(await createClient(), context.business.id, ruleId);
  return <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader actions={<Link className="flex h-11 items-center gap-2 rounded-md border border-line-strong px-4 font-semibold" href="/transactions"><ArrowLeft size={17} />Transactions</Link>} description="Review classifications learned from your prior decisions. Nothing is posted until you approve it." title="Approve Learned Classifications" /><section className="my-6 rounded-lg border border-line bg-surface p-5 shadow-sm"><div className="mb-5 flex items-start gap-3"><Sparkles className="mt-0.5 text-brand" size={20} /><div><h2 className="font-bold">{suggestions.length} suggestion{suggestions.length === 1 ? "" : "s"} ready</h2><p className="mt-1 text-sm text-muted">Uncheck exceptions, then approve the rest together. Future imports matching saved merchant text will appear here automatically.</p></div></div>{suggestions.length ? <SuggestionApprovalForm key={suggestions.map(({ transaction }) => transaction.id).join("-")} suggestions={suggestions} /> : <p className="py-8 text-center text-muted">No learned classifications are waiting for approval.</p>}</section></div>;
}
