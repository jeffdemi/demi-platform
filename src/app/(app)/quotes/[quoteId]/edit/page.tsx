import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { listActiveCustomerOptions } from "@/lib/repositories/customer-repository";
import { getQuoteForEdit } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";
import { QuoteForm } from "../../quote-form";
export const metadata: Metadata = { title: "Edit quote" };
export default async function EditQuotePage({ params }: { params: Promise<{ quoteId: string }> }) { const id = Number((await params).quoteId); if (!Number.isInteger(id)) notFound(); const { business } = await requireBusinessContext(); const client = await createClient(); const quote = await getQuoteForEdit(client, business.id, id); if (!quote || quote.status === "converted") notFound(); const customers = await listActiveCustomerOptions(client, business.id, quote.customer_id); return <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8"><PageHeader description={quote.quote_number} title="Edit quote" /><QuoteForm customers={customers} quote={quote} today={dateInTimeZone(business.timezone)} /></div>; }
