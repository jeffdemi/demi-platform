"use client";

import { Check, LoaderCircle, Send, Sparkles } from "lucide-react";
import { useActionState } from "react";
import { FormFeedback } from "@/components/form-feedback";
import { jsonStringList } from "@/lib/domain/quote-ai";
import { formatCurrency } from "@/lib/format";
import type { QuoteAiMessage, QuoteAiRecommendationRow } from "@/lib/repositories/quote-ai-repository";
import { analyzeDraftQuote, applyDraftQuoteRecommendation, sendQuoteAiMessage, type QuoteWorkbenchState } from "./quote-workbench-actions";

function List({ items }: { items: string[] }) {
  if (!items.length) return null;
  return <ul className="mt-2 space-y-1 text-sm leading-6 text-muted-strong">{items.map((item, index) => <li className="flex gap-2" key={`${index}-${item}`}><span aria-hidden="true" className="text-accent">-</span><span>{item}</span></li>)}</ul>;
}

function PriceSummary({ recommendation }: { recommendation: QuoteAiRecommendationRow }) {
  const range = recommendation.suggested_price_low !== null || recommendation.suggested_price_high !== null
    ? `${formatCurrency(recommendation.suggested_price_low)} to ${formatCurrency(recommendation.suggested_price_high)}`
    : "More information needed";
  return <div className="grid gap-3 sm:grid-cols-2">
    <div><p className="text-xs font-semibold uppercase text-muted">Recommended price</p><p className="mt-1 text-2xl font-bold">{formatCurrency(recommendation.recommended_price)}</p></div>
    <div><p className="text-xs font-semibold uppercase text-muted">Suggested range</p><p className="mt-1 font-semibold">{range}</p></div>
  </div>;
}

export function QuoteAiWorkbench({ configured, draft, messages, photoCount, quoteId, recommendation, readOnly }: {
  configured: boolean;
  draft: boolean;
  messages: QuoteAiMessage[];
  photoCount: number;
  quoteId: number;
  recommendation: QuoteAiRecommendationRow | null;
  readOnly?: boolean;
}) {
  const [analysisState, analyze, analysisPending] = useActionState(analyzeDraftQuote.bind(null, quoteId), {} as QuoteWorkbenchState);
  const [chatState, sendMessage, chatPending] = useActionState(sendQuoteAiMessage.bind(null, quoteId), {} as QuoteWorkbenchState);
  const [applyState, apply, applyPending] = useActionState(
    applyDraftQuoteRecommendation.bind(null, quoteId, recommendation?.id ?? -1),
    {} as QuoteWorkbenchState,
  );
  const canEdit = draft && !readOnly;
  const observations = jsonStringList(recommendation?.observations);
  const questions = jsonStringList(recommendation?.questions);
  const assumptions = jsonStringList(recommendation?.assumptions);
  const risks = jsonStringList(recommendation?.risk_flags);

  return <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 className="flex items-center gap-2 font-bold"><Sparkles className="text-accent" size={18} />AI quote preparation</h2><p className="mt-1 text-sm text-muted">Draft recommendation based on the quote, site photos, and anonymized completed-job results.</p></div>
      {recommendation ? <span className="rounded-md border border-line px-2 py-1 text-xs font-semibold uppercase text-muted">{recommendation.confidence} confidence</span> : null}
    </div>

    {!configured ? <div className="mt-4 rounded-md border border-accent-line bg-accent-soft p-4 text-sm text-warning-ink">AI estimating is ready in the application but needs a server-side <code>OPENAI_API_KEY</code> before analysis can run.</div> : null}
    {!draft ? <p className="mt-4 rounded-md border border-line bg-page p-4 text-sm text-muted">This AI preparation thread is read-only because the quote is no longer a draft.</p> : null}
    {draft && readOnly ? <p className="mt-4 rounded-md border border-line bg-page p-4 text-sm text-muted">Interns have read-only access and cannot run AI preparation.</p> : null}

    {canEdit && configured ? <form action={analyze} className="mt-4 space-y-3">
      <label className="flex items-start gap-3 text-sm leading-5"><input className="mt-1 size-4 accent-brand" name="aiConsent" required type="checkbox" value="yes" /><span>Send this draft&apos;s scope, general location, anonymized job results, and {photoCount} prepared photo{photoCount === 1 ? "" : "s"} to OpenAI for analysis. Customer identity, exact address, internal notes, and hazard notes stay in Demi Platform.</span></label>
      <button className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={analysisPending} type="submit">{analysisPending ? <LoaderCircle className="animate-spin" size={17} /> : <Sparkles size={17} />}{analysisPending ? "Analyzing..." : recommendation ? "Analyze again" : "Analyze draft"}</button>
      <FormFeedback message={analysisState.message} tone={analysisState.tone} />
    </form> : null}

    {recommendation ? <div className="mt-5 space-y-5 border-t border-line pt-5">
      <div className={`rounded-md border p-4 ${recommendation.readiness === "ready" ? "border-brand-border bg-brand-soft" : "border-accent-line bg-accent-soft"}`}>
        <p className="text-xs font-semibold uppercase text-muted">AI assessment</p>
        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{messages.filter((message) => message.role === "assistant").at(-1)?.content || "Recommendation prepared."}</p>
      </div>
      <PriceSummary recommendation={recommendation} />
      {recommendation.suggested_scope ? <div><p className="text-xs font-semibold uppercase text-muted">Suggested customer scope</p><p className="mt-2 whitespace-pre-wrap text-sm leading-6">{recommendation.suggested_scope}</p></div> : null}
      {observations.length ? <div><h3 className="text-sm font-bold">Photo and quote observations</h3><List items={observations} /></div> : null}
      {questions.length ? <div><h3 className="text-sm font-bold">Questions to resolve</h3><List items={questions} /></div> : null}
      {assumptions.length ? <div><h3 className="text-sm font-bold">Pricing assumptions</h3><List items={assumptions} /></div> : null}
      {risks.length ? <div><h3 className="text-sm font-bold">Internal risk flags</h3><List items={risks} /></div> : null}
      {recommendation.customer_message_draft ? <div><label className="text-xs font-semibold uppercase text-muted" htmlFor="ai-customer-wording">Suggested customer wording</label><textarea className="mt-2 min-h-36 w-full rounded-md border border-line-strong bg-surface p-3 text-sm leading-6" defaultValue={recommendation.customer_message_draft} id="ai-customer-wording" /></div> : null}
      {canEdit ? <form action={apply} className="space-y-3"><button className="inline-flex h-11 items-center gap-2 rounded-md border border-brand-border px-4 font-semibold text-brand disabled:opacity-60" disabled={applyPending || Boolean(recommendation.applied_at)} type="submit"><Check size={17} />{recommendation.applied_at ? "Applied to draft" : applyPending ? "Applying..." : "Apply scope and price"}</button><FormFeedback message={applyState.message} tone={applyState.tone} /></form> : null}
    </div> : null}

    {messages.length ? <div className="mt-5 border-t border-line pt-5"><h3 className="text-sm font-bold">Quote conversation</h3><div className="mt-3 max-h-[26rem] space-y-3 overflow-y-auto pr-1">{messages.slice(-16).map((message) => <div className={`rounded-md border px-3 py-2 text-sm leading-6 ${message.role === "user" ? "ml-6 border-line bg-page" : "mr-6 border-brand-border bg-brand-soft"}`} key={message.id}><p className="text-xs font-bold uppercase text-muted">{message.role === "user" ? "You" : "AI"}</p><p className="mt-1 whitespace-pre-wrap">{message.content}</p></div>)}</div></div> : null}

    {canEdit && configured && recommendation ? <form action={sendMessage} className="mt-5 space-y-3 border-t border-line pt-5"><label className="block text-sm font-bold" htmlFor="quote-ai-message">Add information or ask a follow-up</label><textarea className="min-h-28 w-full rounded-md border border-line-strong bg-surface p-3" id="quote-ai-message" maxLength={2000} name="message" placeholder="For example: The gate is 48 inches wide and the customer wants the grindings left on site." required /><p className="text-xs text-muted">The assistant rechecks the draft and photos with each message. Nothing is applied or sent automatically.</p><button className="inline-flex h-11 items-center gap-2 rounded-md bg-brand px-4 font-semibold text-on-brand disabled:opacity-60" disabled={chatPending} type="submit">{chatPending ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />}{chatPending ? "Updating..." : "Send to estimator"}</button><FormFeedback message={chatState.message} tone={chatState.tone} /></form> : null}
  </section>;
}
