import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { QuoteKnowledgeForm } from "../quote-knowledge-form";

export const metadata: Metadata = { title: "Add knowledge entry" };

export default async function NewQuoteKnowledgePage() {
  const { role } = await requireBusinessContext();
  if (role === "intern") redirect("/quotes/knowledge");
  return <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
    <PageHeader description="Applied to every AI quote estimate for this business." title="Add knowledge entry" />
    <QuoteKnowledgeForm />
  </div>;
}
