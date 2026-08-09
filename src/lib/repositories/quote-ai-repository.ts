import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
export type QuotePhoto = Database["public"]["Tables"]["quote_photos"]["Row"];
export type QuoteAiThread = Database["public"]["Tables"]["quote_ai_threads"]["Row"];
export type QuoteAiMessage = Database["public"]["Tables"]["quote_ai_messages"]["Row"];
export type QuoteAiRecommendationRow = Database["public"]["Tables"]["quote_ai_recommendations"]["Row"];

function requireData<T>(data: T | null, error: { message: string } | null, message: string): T {
  if (error || data === null) throw new Error(`${message}${error ? `: ${error.message}` : "."}`);
  return data;
}

export async function listQuotePhotos(client: Client, businessId: number, quoteId: number) {
  const result = await client.from("quote_photos").select("*")
    .eq("business_id", businessId).eq("quote_id", quoteId)
    .order("created_at", { ascending: true }).order("id", { ascending: true });
  return requireData(result.data, result.error, "Unable to load quote photos");
}

export async function getQuotePhoto(client: Client, businessId: number, quoteId: number, photoId: number) {
  const result = await client.from("quote_photos").select("*")
    .eq("business_id", businessId).eq("quote_id", quoteId).eq("id", photoId).maybeSingle();
  if (result.error) throw new Error(`Unable to load quote photo: ${result.error.message}`);
  return result.data;
}

export async function createQuotePhoto(client: Client, values: Database["public"]["Tables"]["quote_photos"]["Insert"]) {
  const result = await client.from("quote_photos").insert(values).select("*").single();
  return requireData(result.data, result.error, "Unable to register quote photo");
}

export async function deleteQuotePhoto(client: Client, businessId: number, quoteId: number, photoId: number) {
  const result = await client.from("quote_photos").delete()
    .eq("business_id", businessId).eq("quote_id", quoteId).eq("id", photoId).select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to remove quote photo: ${result.error.message}`);
  return result.data;
}

export async function getQuoteAiThread(client: Client, businessId: number, quoteId: number) {
  const result = await client.from("quote_ai_threads").select("*")
    .eq("business_id", businessId).eq("quote_id", quoteId).maybeSingle();
  if (result.error) throw new Error(`Unable to load quote AI thread: ${result.error.message}`);
  return result.data;
}

export async function createQuoteAiThread(client: Client, values: Database["public"]["Tables"]["quote_ai_threads"]["Insert"]) {
  const result = await client.from("quote_ai_threads").insert(values).select("*").single();
  return requireData(result.data, result.error, "Unable to create quote AI thread");
}

export async function touchQuoteAiThread(client: Client, businessId: number, threadId: number, model: string, promptVersion: string) {
  const result = await client.from("quote_ai_threads").update({ model, prompt_version: promptVersion })
    .eq("business_id", businessId).eq("id", threadId).select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to update quote AI thread: ${result.error.message}`);
  return result.data;
}

export async function listQuoteAiMessages(client: Client, businessId: number, quoteId: number) {
  const result = await client.from("quote_ai_messages").select("*")
    .eq("business_id", businessId).eq("quote_id", quoteId)
    .order("created_at", { ascending: true }).order("id", { ascending: true }).limit(80);
  return requireData(result.data, result.error, "Unable to load quote AI messages");
}

export async function createQuoteAiMessage(client: Client, values: Database["public"]["Tables"]["quote_ai_messages"]["Insert"]) {
  const result = await client.from("quote_ai_messages").insert(values).select("*").single();
  return requireData(result.data, result.error, "Unable to save quote AI message");
}

export async function createQuoteAiRecommendation(client: Client, values: Database["public"]["Tables"]["quote_ai_recommendations"]["Insert"]) {
  const result = await client.from("quote_ai_recommendations").insert(values).select("*").single();
  return requireData(result.data, result.error, "Unable to save quote AI recommendation");
}

export async function getLatestQuoteAiRecommendation(client: Client, businessId: number, quoteId: number) {
  const result = await client.from("quote_ai_recommendations").select("*")
    .eq("business_id", businessId).eq("quote_id", quoteId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error(`Unable to load quote AI recommendation: ${result.error.message}`);
  return result.data;
}

export async function getQuoteAiRecommendation(client: Client, businessId: number, quoteId: number, recommendationId: number) {
  const result = await client.from("quote_ai_recommendations").select("*")
    .eq("business_id", businessId).eq("quote_id", quoteId).eq("id", recommendationId).maybeSingle();
  if (result.error) throw new Error(`Unable to load quote AI recommendation: ${result.error.message}`);
  return result.data;
}

export async function markQuoteAiRecommendationApplied(client: Client, businessId: number, quoteId: number, recommendationId: number, userId: string) {
  const result = await client.from("quote_ai_recommendations")
    .update({ applied_at: new Date().toISOString(), applied_by: userId })
    .eq("business_id", businessId).eq("quote_id", quoteId).eq("id", recommendationId)
    .select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to mark quote AI recommendation applied: ${result.error.message}`);
  return result.data;
}
