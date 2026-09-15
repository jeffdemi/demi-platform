import "server-only";

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  defaultQuoteAiModel,
  parseQuoteAiResponse,
  quoteAiPromptVersion,
  quoteAiResponseJsonSchema,
  quoteAssistantContext,
  quoteAssistantInstructions,
  rankComparableJobs,
} from "@/lib/domain/quote-ai";
import { listCompletedJobsForQuoteComparison } from "@/lib/repositories/job-repository";
import {
  createQuoteAiMessage,
  createQuoteAiRecommendation,
  createQuoteAiThread,
  getLatestQuoteAiRecommendation,
  getQuoteAiRecommendation,
  getQuoteAiThread,
  listQuoteAiMessages,
  markQuoteAiRecommendationApplied,
  touchQuoteAiThread,
} from "@/lib/repositories/quote-ai-repository";
import { listQuoteKnowledge } from "@/lib/repositories/quote-knowledge-repository";
import { getQuote, getQuoteForEdit, updateQuote } from "@/lib/repositories/quote-repository";
import { getQuotePhotosWithUrls } from "@/lib/services/quote-photos";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type ResponseInput = {
  role: "user" | "assistant";
  content: string | Array<{ type: "input_text"; text: string } | { type: "input_image"; image_url: string; detail: "high" }>;
};

function quoteAiConfig() {
  return {
    apiKey: process.env.OPENAI_API_KEY?.trim() || null,
    model: process.env.OPENAI_QUOTE_MODEL?.trim() || defaultQuoteAiModel,
  };
}

export function isQuoteAiConfigured() {
  return Boolean(quoteAiConfig().apiKey);
}

export function extractOpenAiResponseText(response: unknown) {
  if (!response || typeof response !== "object") return null;
  const direct = "output_text" in response && typeof response.output_text === "string" ? response.output_text : null;
  if (direct) return direct;
  if (!("output" in response) || !Array.isArray(response.output)) return null;
  for (const item of response.output) {
    if (!item || typeof item !== "object" || !("content" in item) || !Array.isArray(item.content)) continue;
    for (const content of item.content) {
      if (content && typeof content === "object" && "type" in content && content.type === "output_text" && "text" in content && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
}

export function buildQuoteAiRequest(model: string, input: ResponseInput[], safetyIdentifier: string, hasKnowledgeBase: boolean) {
  return {
    model,
    instructions: quoteAssistantInstructions(hasKnowledgeBase),
    input,
    reasoning: { effort: "low" },
    text: {
      verbosity: "medium",
      format: {
        type: "json_schema",
        name: "quote_recommendation",
        strict: true,
        schema: quoteAiResponseJsonSchema,
      },
    },
    max_output_tokens: 2400,
    store: false,
    safety_identifier: safetyIdentifier,
  };
}

async function callQuoteAi(input: ResponseInput[], userId: string, businessId: number, hasKnowledgeBase: boolean) {
  const { apiKey, model } = quoteAiConfig();
  if (!apiKey) throw new Error("AI estimating is not configured yet. Add OPENAI_API_KEY locally and in Vercel.");
  const safetyIdentifier = createHash("sha256").update(`${businessId}:${userId}`).digest("hex");
  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(buildQuoteAiRequest(model, input, safetyIdentifier, hasKnowledgeBase)),
    signal: AbortSignal.timeout(90_000),
  });
  const response = await result.json().catch(() => null) as { id?: string; error?: { message?: string } } | null;
  if (!result.ok) {
    console.error("Quote AI request failed", { status: result.status, message: response?.error?.message });
    throw new Error("The AI estimator is temporarily unavailable. Your quote and photos are still saved.");
  }
  const text = extractOpenAiResponseText(response);
  if (!text) throw new Error("The AI estimator returned an empty response. Try again.");
  return { model, responseId: response?.id || null, recommendation: parseQuoteAiResponse(text) };
}

async function quoteThread(client: Client, businessId: number, quoteId: number, userId: string, model: string) {
  const existing = await getQuoteAiThread(client, businessId, quoteId);
  if (existing) return existing;
  try {
    return await createQuoteAiThread(client, {
      business_id: businessId,
      quote_id: quoteId,
      model,
      prompt_version: quoteAiPromptVersion,
      created_by: userId,
    });
  } catch {
    const concurrent = await getQuoteAiThread(client, businessId, quoteId);
    if (concurrent) return concurrent;
    throw new Error("Unable to prepare the quote AI conversation.");
  }
}

export async function getQuoteAiWorkbench(client: Client, businessId: number, quoteId: number) {
  const [photos, messages, recommendation] = await Promise.all([
    getQuotePhotosWithUrls(client, businessId, quoteId),
    listQuoteAiMessages(client, businessId, quoteId),
    getLatestQuoteAiRecommendation(client, businessId, quoteId),
  ]);
  return { photos, messages, recommendation };
}

export async function runQuoteAssistant(
  client: Client,
  businessId: number,
  quoteId: number,
  userId: string,
  userMessage?: string,
) {
  const quote = await getQuote(client, businessId, quoteId);
  if (!quote) throw new Error("That quote no longer exists.");
  if (quote.status !== "draft") throw new Error("AI preparation is available while the quote is a draft.");
  const message = userMessage?.trim();
  if (message && message.length > 2000) throw new Error("Keep each message under 2,000 characters.");

  const [photos, previousMessages, completedJobs, knowledge] = await Promise.all([
    getQuotePhotosWithUrls(client, businessId, quoteId, 600),
    listQuoteAiMessages(client, businessId, quoteId),
    listCompletedJobsForQuoteComparison(client, businessId),
    listQuoteKnowledge(client, businessId),
  ]);
  const comparableJobs = rankComparableJobs(quote, completedJobs);
  const knowledgeBase = knowledge.map((entry) => ({ title: entry.title, body: entry.body, tags: entry.tags }));
  const contextContent: ResponseInput["content"] = [
    { type: "input_text", text: quoteAssistantContext(quote, comparableJobs, photos.length, knowledgeBase) },
    ...photos.map((photo) => ({ type: "input_image" as const, image_url: photo.signedUrl, detail: "high" as const })),
  ];
  const input: ResponseInput[] = [
    { role: "user", content: contextContent },
    ...previousMessages.slice(-24).map((item) => ({ role: item.role as "user" | "assistant", content: item.content })),
  ];
  if (message) input.push({ role: "user", content: message });

  const result = await callQuoteAi(input, userId, businessId, knowledgeBase.length > 0);
  const thread = await quoteThread(client, businessId, quoteId, userId, result.model);
  if (message) {
    await createQuoteAiMessage(client, {
      business_id: businessId, quote_id: quoteId, thread_id: thread.id,
      role: "user", content: message, created_by: userId,
    });
  }
  const recommendation = await createQuoteAiRecommendation(client, {
    business_id: businessId,
    quote_id: quoteId,
    thread_id: thread.id,
    response_id: result.responseId,
    model: result.model,
    prompt_version: quoteAiPromptVersion,
    readiness: result.recommendation.readiness,
    confidence: result.recommendation.confidence,
    observations: result.recommendation.observations,
    questions: result.recommendation.questions,
    assumptions: result.recommendation.assumptions,
    risk_flags: result.recommendation.riskFlags,
    suggested_scope: result.recommendation.suggestedScope,
    suggested_price_low: result.recommendation.suggestedPriceLow,
    suggested_price_high: result.recommendation.suggestedPriceHigh,
    recommended_price: result.recommendation.recommendedPrice,
    customer_message_draft: result.recommendation.customerMessageDraft,
    created_by: userId,
  });
  await createQuoteAiMessage(client, {
    business_id: businessId, quote_id: quoteId, thread_id: thread.id,
    recommendation_id: recommendation.id, role: "assistant",
    content: result.recommendation.assistantMessage, created_by: userId,
  });
  await touchQuoteAiThread(client, businessId, thread.id, result.model, quoteAiPromptVersion);
  return recommendation;
}

export async function applyQuoteAiRecommendation(
  client: Client,
  businessId: number,
  quoteId: number,
  recommendationId: number,
  userId: string,
) {
  const [quote, recommendation] = await Promise.all([
    getQuoteForEdit(client, businessId, quoteId),
    getQuoteAiRecommendation(client, businessId, quoteId, recommendationId),
  ]);
  if (!quote || !recommendation) throw new Error("That quote recommendation is no longer available.");
  if (quote.status !== "draft") throw new Error("Only draft quotes can be changed from an AI recommendation.");
  const values: Database["public"]["Tables"]["quotes"]["Update"] = {};
  if (recommendation.suggested_scope?.trim()) values.customer_scope = recommendation.suggested_scope.trim();
  if (!quote.pro_bono && recommendation.recommended_price !== null) values.quoted_price = recommendation.recommended_price;
  if (!Object.keys(values).length) throw new Error("This recommendation does not contain a scope or final price to apply yet.");
  const updated = await updateQuote(client, businessId, quoteId, values);
  if (!updated) throw new Error("That quote no longer exists.");
  await markQuoteAiRecommendationApplied(client, businessId, quoteId, recommendationId, userId);
  return updated;
}
