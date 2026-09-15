import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import type { QuoteDetail } from "@/lib/repositories/quote-repository";
import type { QuoteAiMessage, QuoteAiRecommendationRow } from "@/lib/repositories/quote-ai-repository";
import { isQuoteAiConfigured } from "@/lib/services/quote-ai";
import { QuoteAiWorkbench } from "../quote-ai-workbench";
import { QuoteForm } from "../quote-form";
import { QuotePhotoManager } from "../quote-photo-manager";

export function QuoteDraftStep1({ quote, customers, today, photos, messages, recommendation, readOnly }: {
  quote: QuoteDetail;
  customers: { id: number; label: string }[];
  today: string;
  photos: { id: number; original_name: string; size_bytes: number; signedUrl: string }[];
  messages: QuoteAiMessage[];
  recommendation: QuoteAiRecommendationRow | null;
  readOnly?: boolean;
}) {
  return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader description={`Step 1 of 2 · ${quote.quote_number} · Intake`} title="Prepare the quote" />
    <QuoteForm customers={customers} quote={quote} today={today} />
    <div className="mt-8 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
      <QuotePhotoManager businessId={quote.business_id} draft photos={photos} quoteId={quote.id} readOnly={readOnly} />
      <QuoteAiWorkbench configured={isQuoteAiConfigured()} draft messages={messages} photoCount={photos.length} quoteId={quote.id} readOnly={readOnly} recommendation={recommendation} />
    </div>
    <div className="mt-8 flex justify-end border-t border-line pt-6">
      <Link className="flex h-11 items-center gap-2 rounded-md bg-brand px-5 font-semibold text-on-brand" href={`/quotes/${quote.id}?step=2`}>Continue to quote<ArrowRight size={17} /></Link>
    </div>
  </div>;
}
