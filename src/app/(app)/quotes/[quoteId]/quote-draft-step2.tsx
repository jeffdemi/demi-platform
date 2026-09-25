import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { customerDisplayName } from "@/lib/domain/customers";
import { jsonStringList } from "@/lib/domain/quote-ai";
import { customerQuoteMessage, optionLabel, quoteHasFinalPrice, quoteStatusLabel } from "@/lib/domain/quotes";
import { formatCurrency } from "@/lib/format";
import type { QuoteAiRecommendationRow } from "@/lib/repositories/quote-ai-repository";
import type { QuoteDetail } from "@/lib/repositories/quote-repository";
import { MessageEditor } from "../message-editor";
import { QuoteFinalPriceForm } from "../quote-final-price-form";
import { QuoteStatusActions } from "../status-actions";

const Detail = ({ label, value }: { label: string; value: React.ReactNode }) => <div>
  <dt className="text-xs font-semibold uppercase text-muted">{label}</dt>
  <dd className="mt-1 whitespace-pre-wrap text-sm font-medium">{value || "Not recorded"}</dd>
</div>;

export function QuoteDraftStep2({ quote, photoCount, recommendation, readOnly }: {
  quote: QuoteDetail;
  photoCount: number;
  recommendation: QuoteAiRecommendationRow | null;
  readOnly?: boolean;
}) {
  const observations = jsonStringList(recommendation?.observations);
  const assumptions = jsonStringList(recommendation?.assumptions);

  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader actions={<Link className="flex h-10 items-center gap-2 rounded-md border border-line-strong px-3 font-semibold" href={`/quotes/${quote.id}?step=1`}><ArrowLeft size={16} />Back to step 1</Link>} description={`Step 2 of 2 · ${quote.quote_number} · Quote`} title={customerDisplayName(quote.customers)} />

    <div className="mt-5"><Link className="inline-flex rounded-md bg-brand px-4 py-3 font-semibold text-on-brand" href={`/quotes/${quote.id}/pdf/review`}>Review &amp; create PDF</Link></div>

    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-bold">Collected details</h2>
        <dl className="mt-4 grid gap-4">
          <Detail label="Service address" value={quote.service_address} />
          <Detail label="Property location" value={optionLabel(quote.property_location)} />
          <Detail label="Customer scope" value={quote.customer_scope} />
          <Detail label="Special instructions" value={quote.special_instructions} />
          <Detail label="Hazard notes" value={quote.hazard_notes} />
          <Detail label="Photos attached" value={String(photoCount)} />
          <Detail label="PA 811 required" value={quote.pa811_required ? "Yes" : "No"} />
        </dl>
      </section>

      <div className="space-y-5">
        <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
          <h2 className="flex items-center gap-2 font-bold"><Sparkles className="text-accent" size={18} />AI estimate</h2>
          {recommendation ? <>
            <p className="mt-1 text-xs font-semibold uppercase text-muted">{recommendation.confidence} confidence</p>
            <p className="mt-3 text-2xl font-bold">{formatCurrency(recommendation.recommended_price)}</p>
            {(recommendation.suggested_price_low !== null || recommendation.suggested_price_high !== null) && <p className="mt-1 text-sm text-muted">Range {formatCurrency(recommendation.suggested_price_low)} to {formatCurrency(recommendation.suggested_price_high)}</p>}
            {observations.length ? <ul className="mt-4 space-y-1 text-sm leading-6 text-muted-strong">{observations.map((item, index) => <li className="flex gap-2" key={`${index}-${item}`}><span aria-hidden="true" className="text-accent">-</span><span>{item}</span></li>)}</ul> : null}
            {assumptions.length ? <div className="mt-3"><p className="text-xs font-semibold uppercase text-muted">Assumptions</p><ul className="mt-1 space-y-1 text-sm leading-6 text-muted-strong">{assumptions.map((item, index) => <li className="flex gap-2" key={`${index}-${item}`}><span aria-hidden="true" className="text-accent">-</span><span>{item}</span></li>)}</ul></div> : null}
          </> : <p className="mt-3 text-sm text-muted">No AI estimate yet. <Link className="font-semibold text-brand hover:underline" href={`/quotes/${quote.id}?step=1`}>Go back to step 1</Link> to run one, or set a final price manually below.</p>}
        </section>
        <QuoteFinalPriceForm quote={quote} readOnly={readOnly} suggestedPrice={recommendation?.recommended_price ?? null} />
      </div>
    </div>

    <div className="mt-6 grid gap-5 lg:grid-cols-2">
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <div className="flex justify-between gap-3"><h2 className="font-bold">Status</h2><StatusBadge label={quoteStatusLabel(quote.status)} status={quote.status} /></div>
        <div className="mt-4"><QuoteStatusActions accepted={quote.status === "accepted"} converted={false} priceReady={quoteHasFinalPrice(quote)} quoteId={quote.id} readOnly={readOnly} /></div>
      </section>
      <section className="rounded-lg border border-line bg-surface p-5 shadow-sm">
        <h2 className="font-bold">Customer message</h2>
        <p className="mt-1 text-sm text-muted">Edit this text before copying it into a text or email.</p>
        <div className="mt-4"><MessageEditor message={customerQuoteMessage(quote)} /></div>
      </section>
    </div>
  </div>;
}
