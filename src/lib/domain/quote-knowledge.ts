import type { Database } from "@/types/database";

export type QuoteKnowledge = Database["public"]["Tables"]["quote_knowledge"]["Row"];

export function deriveKnowledgeTitle(body: string) {
  const firstLine = body.split("\n").map((line) => line.trim()).find(Boolean) ?? "";
  if (!firstLine) return "Quote note";
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine;
}

export function parseKnowledgeTags(value: string | null | undefined) {
  return (value ?? "").split(",").map((tag) => tag.trim()).filter(Boolean);
}

export function knowledgePromptBlock(entries: Pick<QuoteKnowledge, "title" | "body" | "tags">[]) {
  if (!entries.length) return [];
  return entries.map((entry) => ({ title: entry.title, body: entry.body, tags: entry.tags }));
}
