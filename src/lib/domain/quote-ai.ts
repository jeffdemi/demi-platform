import { z } from "zod";
import { quoteHasFinalPrice, type QuoteWithCustomer } from "./quotes";

export const quoteAiPromptVersion = "quote-estimator-v1";
export const defaultQuoteAiModel = "gpt-5.6-terra";

export const quoteAiRecommendationSchema = z.object({
  assistantMessage: z.string().min(1),
  readiness: z.enum(["ready", "needs_information"]),
  observations: z.array(z.string()),
  questions: z.array(z.string()),
  assumptions: z.array(z.string()),
  riskFlags: z.array(z.string()),
  suggestedScope: z.string().nullable(),
  suggestedPriceLow: z.number().nonnegative().nullable(),
  suggestedPriceHigh: z.number().nonnegative().nullable(),
  recommendedPrice: z.number().nonnegative().nullable(),
  confidence: z.enum(["low", "medium", "high"]),
  customerMessageDraft: z.string().nullable(),
}).superRefine((value, context) => {
  if (value.suggestedPriceLow !== null && value.suggestedPriceHigh !== null && value.suggestedPriceLow > value.suggestedPriceHigh) {
    context.addIssue({ code: "custom", message: "The suggested price range is reversed.", path: ["suggestedPriceLow"] });
  }
});

export type QuoteAiRecommendation = z.infer<typeof quoteAiRecommendationSchema>;

export const quoteAiResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "assistantMessage", "readiness", "observations", "questions", "assumptions", "riskFlags",
    "suggestedScope", "suggestedPriceLow", "suggestedPriceHigh", "recommendedPrice", "confidence",
    "customerMessageDraft",
  ],
  properties: {
    assistantMessage: { type: "string" },
    readiness: { type: "string", enum: ["ready", "needs_information"] },
    observations: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    riskFlags: { type: "array", items: { type: "string" } },
    suggestedScope: { type: ["string", "null"] },
    suggestedPriceLow: { type: ["number", "null"], minimum: 0 },
    suggestedPriceHigh: { type: ["number", "null"], minimum: 0 },
    recommendedPrice: { type: ["number", "null"], minimum: 0 },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    customerMessageDraft: { type: ["string", "null"] },
  },
} as const;

export type ComparableJob = {
  id: number;
  status: string;
  completed_date: string | null;
  property_location: string | null;
  work_description: string | null;
  amount_quoted: number | null;
  amount_paid: number | null;
  travel_minutes: number | null;
  grinding_minutes: number | null;
  cleanup_minutes: number | null;
  machine_hours: number | null;
  pro_bono: boolean;
  pa811_required: boolean;
};

function normalizedWords(value: string | null | undefined) {
  return new Set((value || "").toLowerCase().match(/[a-z0-9]+/g)?.filter((word) => word.length > 2) || []);
}

function overlapScore(left: Set<string>, right: Set<string>) {
  let score = 0;
  left.forEach((word) => { if (right.has(word)) score += 1; });
  return score;
}

export function rankComparableJobs(quote: Pick<QuoteWithCustomer, "customer_scope" | "property_location">, jobs: ComparableJob[], limit = 8) {
  const quoteWords = normalizedWords(quote.customer_scope);
  return jobs
    .filter((job) => job.amount_quoted !== null && !job.pro_bono)
    .map((job) => {
      let score = overlapScore(quoteWords, normalizedWords(job.work_description));
      if (quote.property_location && job.property_location?.toLowerCase() === quote.property_location.toLowerCase()) score += 2;
      return { ...job, similarity_score: score };
    })
    .sort((left, right) => right.similarity_score - left.similarity_score
      || (right.completed_date || "").localeCompare(left.completed_date || "")
      || right.id - left.id)
    .slice(0, limit);
}

export function quoteAssistantInstructions(hasKnowledgeBase: boolean) {
  return `You are an estimating copilot for Jeff at Demi Stump Grinding. Help Jeff prepare a draft stump-grinding quote from the recorded quote, site photos, his follow-up answers, and comparable completed jobs.

The quote is not delivered until Jeff explicitly marks it sent. Never claim that it has been sent, accepted, scheduled, or completed. Treat every price and scope as a recommendation that Jeff must approve.

Photo limits: do not infer exact stump diameter, gate width, underground utilities, depth, or clearance when the image does not establish them. Ask concise follow-up questions when stump count, dimensions, access, slope, rocks, structures, utility risk, root work, cleanup, or grindings removal materially affect price or scope. Do not create false precision.

Pricing: use comparable jobs as evidence, not a guarantee. Explain important assumptions. If the evidence is insufficient, set readiness to needs_information and recommendedPrice to null. For a pro bono quote, do not display an awkward zero-dollar price.${hasKnowledgeBase ? " The context includes a knowledgeBase array of Jeff's own standing pricing notes and rules of thumb; apply them the way Jeff would, and mention when one changed your price or scope." : ""}

Customer-facing text must be friendly and direct. Never expose internal notes, private comparable-job details, or hazard notes in the customer message. Hazard information may appear only in internal riskFlags. Return only the requested structured result.`;
}

export function quoteAssistantContext(
  quote: QuoteWithCustomer,
  comparableJobs: ReturnType<typeof rankComparableJobs>,
  photoCount: number,
  knowledgeBase: { title: string; body: string; tags: string[] }[],
) {
  return JSON.stringify({
    task: "Review this draft quote and recommend the next best questions, scope, and price.",
    knowledgeBase,
    quote: {
      propertyLocation: quote.property_location,
      customerScope: quote.customer_scope,
      specialInstructions: quote.special_instructions,
      currentNormalPrice: quote.normal_price,
      currentQuotedPrice: quoteHasFinalPrice(quote) ? quote.quoted_price : null,
      proBono: quote.pro_bono,
      pa811Required: quote.pa811_required,
      expirationDate: quote.expiration_date,
      photoCount,
    },
    comparableCompletedJobs: comparableJobs.map((job) => ({
      similarityScore: job.similarity_score,
      completedDate: job.completed_date,
      samePropertyLocation: Boolean(quote.property_location && job.property_location?.toLowerCase() === quote.property_location.toLowerCase()),
      amountQuoted: job.amount_quoted,
      amountPaid: job.amount_paid,
      travelMinutes: job.travel_minutes,
      grindingMinutes: job.grinding_minutes,
      cleanupMinutes: job.cleanup_minutes,
      machineHours: job.machine_hours,
      pa811Required: job.pa811_required,
    })),
  });
}

export function parseQuoteAiResponse(value: string) {
  let json: unknown;
  try {
    json = JSON.parse(value);
  } catch {
    throw new Error("The AI response was not valid structured data.");
  }
  return quoteAiRecommendationSchema.parse(json);
}

export function jsonStringList(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
