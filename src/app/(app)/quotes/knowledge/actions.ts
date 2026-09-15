"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { parseKnowledgeTags } from "@/lib/domain/quote-knowledge";
import {
  createQuoteKnowledge,
  deleteQuoteKnowledge,
  getQuoteKnowledgeForEdit,
  updateQuoteKnowledge,
} from "@/lib/repositories/quote-knowledge-repository";
import { createClient } from "@/lib/supabase/server";
import { quoteKnowledgeFormSchema } from "@/lib/validation/business-records";

export type QuoteKnowledgeFormState = { message?: string; errors?: Record<string, string[]> };

export async function saveQuoteKnowledge(knowledgeId: number | null, _: QuoteKnowledgeFormState, formData: FormData): Promise<QuoteKnowledgeFormState> {
  const parsed = quoteKnowledgeFormSchema.safeParse({ title: formData.get("title"), body: formData.get("body"), tags: formData.get("tags") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const { business, user, role } = await requireBusinessContext();
  if (role === "intern") return { message: "Interns have read-only access." };
  const client = await createClient();
  const values = {
    business_id: business.id, title: parsed.data.title, body: parsed.data.body,
    tags: parseKnowledgeTags(parsed.data.tags), updated_by: user.id,
  };
  try {
    if (knowledgeId === null) {
      await createQuoteKnowledge(client, { ...values, created_by: user.id });
    } else {
      if (!(await getQuoteKnowledgeForEdit(client, business.id, knowledgeId))) return { message: "That entry no longer exists." };
      await updateQuoteKnowledge(client, business.id, knowledgeId, values);
    }
    revalidatePath("/quotes/knowledge");
    redirect("/quotes/knowledge");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The entry could not be saved." };
  }
}

export async function deleteQuoteKnowledgeEntry(knowledgeId: number, _state: QuoteKnowledgeFormState): Promise<QuoteKnowledgeFormState> {
  void _state;
  const { business, role } = await requireBusinessContext();
  if (role === "intern") return { message: "Interns have read-only access." };
  try {
    const removed = await deleteQuoteKnowledge(await createClient(), business.id, knowledgeId);
    if (!removed) return { message: "That entry no longer exists." };
    revalidatePath("/quotes/knowledge");
    return { message: "Entry deleted." };
  } catch (error) {
    return { message: error instanceof Error ? error.message : "The entry could not be deleted." };
  }
}
