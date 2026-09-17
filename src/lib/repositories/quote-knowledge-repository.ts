import type { SupabaseClient } from "@supabase/supabase-js";
import { describeDbError } from "@/lib/supabase-errors";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function listQuoteKnowledge(client: Client, businessId: number) {
  const result = await client.from("quote_knowledge").select("*").eq("business_id", businessId)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(500);
  if (result.error) throw new Error(describeDbError(result.error, "load the knowledge base"));
  return result.data ?? [];
}

export async function getQuoteKnowledgeForEdit(client: Client, businessId: number, id: number) {
  const result = await client.from("quote_knowledge").select("*").eq("business_id", businessId).eq("id", id).maybeSingle();
  if (result.error) throw new Error(describeDbError(result.error, "load the knowledge entry"));
  return result.data;
}

export async function createQuoteKnowledge(client: Client, values: Database["public"]["Tables"]["quote_knowledge"]["Insert"]) {
  const result = await client.from("quote_knowledge").insert(values).select("id").single();
  if (result.error) throw new Error(describeDbError(result.error, "save the knowledge entry"));
  return result.data;
}

export async function updateQuoteKnowledge(client: Client, businessId: number, id: number, values: Database["public"]["Tables"]["quote_knowledge"]["Update"]) {
  const result = await client.from("quote_knowledge").update(values).eq("business_id", businessId).eq("id", id).select("id").maybeSingle();
  if (result.error) throw new Error(describeDbError(result.error, "update the knowledge entry"));
  return result.data;
}

export async function deleteQuoteKnowledge(client: Client, businessId: number, id: number) {
  const result = await client.from("quote_knowledge").delete().eq("business_id", businessId).eq("id", id).select("id").maybeSingle();
  if (result.error) throw new Error(describeDbError(result.error, "delete the knowledge entry"));
  return result.data;
}
