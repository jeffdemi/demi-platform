"use server";

import { revalidatePath } from "next/cache";
import { requireBusinessContext } from "@/lib/auth";
import { applyQuoteAiRecommendation, runQuoteAssistant } from "@/lib/services/quote-ai";
import { registerQuotePhoto, removeQuotePhoto, type QuotePhotoUpload } from "@/lib/services/quote-photos";
import { createClient } from "@/lib/supabase/server";

export type QuoteWorkbenchState = { message?: string; tone?: "success" | "danger" };
export type QuotePhotoActionResult = QuoteWorkbenchState & { ok: boolean };

function refreshQuote(quoteId: number) {
  revalidatePath(`/quotes/${quoteId}`);
  revalidatePath("/quotes");
  revalidatePath("/dashboard");
}

export async function registerUploadedQuotePhoto(quoteId: number, upload: QuotePhotoUpload): Promise<QuotePhotoActionResult> {
  const { business, user } = await requireBusinessContext();
  try {
    await registerQuotePhoto(await createClient(), business.id, quoteId, user.id, upload);
    refreshQuote(quoteId);
    return { ok: true, tone: "success", message: "Photo added." };
  } catch (error) {
    return { ok: false, tone: "danger", message: error instanceof Error ? error.message : "The photo could not be added." };
  }
}

export async function removeUploadedQuotePhoto(quoteId: number, photoId: number): Promise<QuotePhotoActionResult> {
  const { business } = await requireBusinessContext();
  try {
    const removed = await removeQuotePhoto(await createClient(), business.id, quoteId, photoId);
    if (!removed) return { ok: false, tone: "danger", message: "That photo no longer exists." };
    refreshQuote(quoteId);
    return { ok: true, tone: "success", message: "Photo removed." };
  } catch (error) {
    return { ok: false, tone: "danger", message: error instanceof Error ? error.message : "The photo could not be removed." };
  }
}

export async function analyzeDraftQuote(quoteId: number, _state: QuoteWorkbenchState, formData: FormData): Promise<QuoteWorkbenchState> {
  void _state;
  if (formData.get("aiConsent") !== "yes") {
    return { tone: "danger", message: "Confirm that the selected photos may be sent to OpenAI for analysis." };
  }
  const { business, user } = await requireBusinessContext();
  try {
    await runQuoteAssistant(await createClient(), business.id, quoteId, user.id);
    refreshQuote(quoteId);
    return { tone: "success", message: "Analysis ready. Review the recommendation before applying it." };
  } catch (error) {
    return { tone: "danger", message: error instanceof Error ? error.message : "The quote could not be analyzed." };
  }
}

export async function sendQuoteAiMessage(quoteId: number, _state: QuoteWorkbenchState, formData: FormData): Promise<QuoteWorkbenchState> {
  void _state;
  const message = String(formData.get("message") || "").trim();
  if (!message) return { tone: "danger", message: "Enter a question or additional detail." };
  const { business, user } = await requireBusinessContext();
  try {
    await runQuoteAssistant(await createClient(), business.id, quoteId, user.id, message);
    refreshQuote(quoteId);
    return { tone: "success", message: "Recommendation updated with your new information." };
  } catch (error) {
    return { tone: "danger", message: error instanceof Error ? error.message : "The AI conversation could not be continued." };
  }
}

export async function applyDraftQuoteRecommendation(quoteId: number, recommendationId: number, _state: QuoteWorkbenchState): Promise<QuoteWorkbenchState> {
  void _state;
  const { business, user } = await requireBusinessContext();
  try {
    await applyQuoteAiRecommendation(await createClient(), business.id, quoteId, recommendationId, user.id);
    refreshQuote(quoteId);
    return { tone: "success", message: "Recommended scope and price applied. The quote is still a draft." };
  } catch (error) {
    return { tone: "danger", message: error instanceof Error ? error.message : "The recommendation could not be applied." };
  }
}
