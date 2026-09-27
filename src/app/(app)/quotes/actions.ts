"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { deriveKnowledgeTitle } from "@/lib/domain/quote-knowledge";
import { quoteHasFinalPrice, quoteStatusUpdate } from "@/lib/domain/quotes";
import { createQuoteKnowledge } from "@/lib/repositories/quote-knowledge-repository";
import { createQuote, getQuoteForEdit, updateQuote } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";
import { formValues, quoteFinalPriceSchema, quoteFormSchema, quoteStatusSchema } from "@/lib/validation/business-records";

export type QuoteFormState = { message?: string; errors?: Record<string, string[]>; values?: Record<string, string>; attemptId?: string };
const names = ["customerId", "status", "quoteDate", "expirationDate", "sentDate", "responseDate", "contactMethod", "referralSource", "serviceAddress", "propertyLocation", "locationDescription", "hazardNotes", "customerScope", "specialInstructions", "internalNotes", "normalPrice", "quotedPrice", "discountReason", "acceptedMethod", "acceptanceNotes"];
const echoedNames = [...names, "proBono", "pa811Required", "saveToKnowledgeBase"];

// Echoed back to the client on failure so the form can restore exactly what the operator typed,
// instead of silently reverting to the last-saved values (or nothing, for a brand-new quote).
function submittedValues(formData: FormData) {
  const values: Record<string, string> = {};
  for (const name of echoedNames) {
    const value = formData.get(name);
    if (typeof value === "string") values[name] = value;
  }
  return values;
}

export async function saveQuote(quoteId: number | null, _: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const restore = { values: submittedValues(formData), attemptId: randomUUID() };
  const parsed = quoteFormSchema.safeParse({ ...formValues(formData, names), proBono: formData.get("proBono") === "on", pa811Required: formData.get("pa811Required") === "on" });
  if (!parsed.success) return { ...restore, errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.customerId || !parsed.data.quoteDate) return { ...restore, message: "Customer and quote date are required." };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { ...restore, message: "Interns have read-only access." };
  const { business } = context;
  const client = await createClient();
  if (quoteId !== null && !(await getQuoteForEdit(client, business.id, quoteId))) return { ...restore, message: "That quote no longer exists." };
  const data = parsed.data;
  const values = {
    business_id: business.id, customer_id: data.customerId as number, status: quoteId === null ? "draft" : data.status,
    quote_date: data.quoteDate as string, expiration_date: data.expirationDate ?? null, sent_date: data.sentDate ?? null,
    response_date: data.responseDate ?? null, contact_method: data.contactMethod ?? null,
    referral_source: data.referralSource ?? null, service_address: data.serviceAddress ?? null,
    property_location: data.propertyLocation ?? null,
    location_description: data.locationDescription ?? null, hazard_notes: data.hazardNotes ?? null,
    customer_scope: data.customerScope ?? null, special_instructions: data.specialInstructions ?? null,
    internal_notes: data.internalNotes ?? null,
    normal_price: data.normalPrice ?? null, quoted_price: data.proBono ? 0 : data.quotedPrice ?? data.normalPrice ?? 0,
    discount_reason: data.discountReason ?? null, pro_bono: data.proBono,
    accepted_method: data.acceptedMethod ?? null, acceptance_notes: data.acceptanceNotes ?? null,
    pa811_required: data.pa811Required,
  };
  try {
    const id = quoteId === null ? (await createQuote(client, values)).id : quoteId;
    if (quoteId !== null && !(await updateQuote(client, business.id, quoteId, values))) return { ...restore, message: "That quote no longer exists." };
    if (formData.get("saveToKnowledgeBase") === "yes" && data.specialInstructions) {
      await createQuoteKnowledge(client, {
        business_id: business.id, title: deriveKnowledgeTitle(data.specialInstructions),
        body: data.specialInstructions, source_quote_id: id, created_by: context.user.id, updated_by: context.user.id,
      });
    }
    revalidatePath("/quotes"); revalidatePath("/dashboard"); revalidatePath("/quotes/knowledge");
    redirect(`/quotes/${id}${values.status === "draft" ? "?step=1" : ""}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("saveQuote failed", { quoteId, businessId: business.id, error });
    return { ...restore, message: error instanceof Error ? error.message : "The quote could not be saved. Check the values and try again." };
  }
}

export async function setQuoteFinalPrice(quoteId: number, _state: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const restore = {
    values: {
      normalPrice: String(formData.get("normalPrice") ?? ""), quotedPrice: String(formData.get("quotedPrice") ?? ""),
      proBono: String(formData.get("proBono") ?? ""), discountReason: String(formData.get("discountReason") ?? ""),
    },
    attemptId: randomUUID(),
  };
  const parsed = quoteFinalPriceSchema.safeParse({
    normalPrice: formData.get("normalPrice"), quotedPrice: formData.get("quotedPrice"),
    proBono: formData.get("proBono") === "on", discountReason: formData.get("discountReason"),
  });
  if (!parsed.success) return { ...restore, errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { ...restore, message: "Interns have read-only access." };
  const { business } = context;
  const client = await createClient();
  const quote = await getQuoteForEdit(client, business.id, quoteId);
  if (!quote) return { ...restore, message: "That quote no longer exists." };
  if (quote.status !== "draft") return { ...restore, message: "Only a draft quote's price can be set here." };
  try {
    await updateQuote(client, business.id, quoteId, {
      normal_price: parsed.data.normalPrice ?? null,
      quoted_price: parsed.data.proBono ? 0 : parsed.data.quotedPrice ?? parsed.data.normalPrice ?? 0,
      pro_bono: parsed.data.proBono,
      discount_reason: parsed.data.discountReason ?? null,
    });
    revalidatePath(`/quotes/${quoteId}`); revalidatePath("/quotes"); revalidatePath("/dashboard");
    return { message: "Final price saved." };
  } catch (error) {
    console.error("setQuoteFinalPrice failed", { quoteId, businessId: business.id, error });
    return { ...restore, message: error instanceof Error ? error.message : "The price could not be saved." };
  }
}

export async function markQuoteStatus(quoteId: number, _state: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  void _state;
  const parsed = quoteStatusSchema.safeParse({ status: formData.get("status"), acceptedMethod: formData.get("acceptedMethod") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business } = context;
  const client = await createClient();
  const quote = await getQuoteForEdit(client, business.id, quoteId);
  if (!quote) return { message: "That quote no longer exists." };
  if (quote.job_id !== null || quote.status === "converted") return { message: "Converted quotes are locked to preserve their job link." };
  if (["sent", "accepted"].includes(parsed.data.status) && !quoteHasFinalPrice(quote)) {
    return { message: "Add a quoted price or mark the quote pro bono before sending or accepting it." };
  }
  const today = dateInTimeZone(business.timezone);
  const values = quoteStatusUpdate(parsed.data.status, today, quote.sent_date, parsed.data.acceptedMethod);
  try {
    await updateQuote(client, business.id, quoteId, values);
    revalidatePath(`/quotes/${quoteId}`); revalidatePath("/quotes"); revalidatePath("/dashboard");
    return { message: "Status updated." };
  } catch (error) {
    console.error("markQuoteStatus failed", { quoteId, businessId: business.id, error });
    return { message: error instanceof Error ? error.message : "The quote status could not be updated." };
  }
}

export async function convertQuoteToJob(quoteId: number, _state: QuoteFormState): Promise<QuoteFormState> {
  void _state;
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  try {
    const quote = await getQuoteForEdit(await createClient(), context.business.id, quoteId);
    if (!quote) return { message: "That quote no longer exists." };
    if (quote.job_id !== null || quote.status === "converted") return { message: "This quote has already been converted." };
    if (quote.status !== "accepted") return { message: "Only accepted quotes may be converted to jobs." };
    // Collect final values before any mutation; saving runs one atomic RPC.
    redirect(`/jobs/new?quoteId=${quoteId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    console.error("convertQuoteToJob failed", { quoteId, error });
    return { message: error instanceof Error ? error.message : "The quote could not be converted." };
  }
}
