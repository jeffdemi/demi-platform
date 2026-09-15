import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { getQuoteKnowledgeForEdit } from "@/lib/repositories/quote-knowledge-repository";
import { createClient } from "@/lib/supabase/server";
import { QuoteKnowledgeForm } from "../../quote-knowledge-form";

export const metadata: Metadata = { title: "Edit knowledge entry" };

export default async function EditQuoteKnowledgePage({ params }: { params: Promise<{ knowledgeId: string }> }) {
  const id = Number((await params).knowledgeId);
  if (!Number.isInteger(id)) notFound();
  const { business, role } = await requireBusinessContext();
  if (role === "intern") redirect("/quotes/knowledge");
  const entry = await getQuoteKnowledgeForEdit(await createClient(), business.id, id);
  if (!entry) notFound();
  return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader description={entry.title} title="Edit knowledge entry" />
    <QuoteKnowledgeForm entry={entry} />
  </div>;
}
