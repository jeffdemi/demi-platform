import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Pencil, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { listQuoteKnowledge } from "@/lib/repositories/quote-knowledge-repository";
import { createClient } from "@/lib/supabase/server";
import { DeleteKnowledgeButton } from "./delete-knowledge-button";

export const metadata: Metadata = { title: "Quote knowledge base" };

export default async function QuoteKnowledgePage() {
  const context = await requireBusinessContext();
  const entries = await listQuoteKnowledge(await createClient(), context.business.id);

  return <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader
      actions={context.role !== "intern" ? <Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand" href="/quotes/knowledge/new"><Plus size={18} />Add entry</Link> : null}
      description="Standing pricing notes and rules of thumb applied to every AI quote estimate."
      title="Quote knowledge base"
    />
    <div className="mt-6 overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      {entries.length ? <div className="divide-y divide-line">{entries.map((entry) => <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-4" key={entry.id}>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{entry.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{entry.body}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted">
            {entry.tags.map((tag) => <span className="rounded-full border border-line px-2 py-0.5" key={tag}>{tag}</span>)}
            <span>Updated {formatDate(entry.updated_at)}</span>
            {entry.source_quote_id ? <Link className="text-brand hover:underline" href={`/quotes/${entry.source_quote_id}`}>From quote #{entry.source_quote_id}</Link> : null}
          </div>
        </div>
        {context.role !== "intern" ? <div className="flex shrink-0 gap-2">
          <Link className="flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-semibold" href={`/quotes/knowledge/${entry.id}/edit`}><Pencil size={15} />Edit</Link>
          <DeleteKnowledgeButton id={entry.id} />
        </div> : null}
      </div>)}</div> : <div className="px-5 py-14 text-center"><BookOpen className="mx-auto text-muted" /><p className="mt-3 font-semibold">No knowledge base entries yet</p><p className="mt-1 text-sm text-muted">Add pricing rules and standing notes for the AI estimator to apply to every quote.</p></div>}
    </div>
  </div>;
}
