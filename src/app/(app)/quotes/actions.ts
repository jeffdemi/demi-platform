"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/lib/auth";
import { dateInTimeZone } from "@/lib/domain/jobs";
import { quoteHasFinalPrice, quoteStatusUpdate } from "@/lib/domain/quotes";
import { convertQuote, createQuote, getQuoteForEdit, updateQuote } from "@/lib/repositories/quote-repository";
import { createClient } from "@/lib/supabase/server";
import { formValues, quoteFormSchema, quoteStatusSchema } from "@/lib/validation/business-records";

export type QuoteFormState = { message?: string; errors?: Record<string, string[]> };
const names = ["customerId", "status", "quoteDate", "expirationDate", "sentDate", "responseDate", "contactMethod", "referralSource", "serviceAddress", "municipality", "propertyLocation", "locationDescription", "hazardNotes", "customerScope", "internalNotes", "normalPrice", "quotedPrice", "discountReason", "acceptedMethod", "acceptanceNotes"];

export async function saveQuote(quoteId: number | null, _: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const parsed = quoteFormSchema.safeParse({ ...formValues(formData, names), proBono: formData.get("proBono") === "on", pa811Required: formData.get("pa811Required") === "on" });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors };
  if (!parsed.data.customerId || !parsed.data.quoteDate) return { message: "Customer and quote date are required." };
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  const { business } = context;
  const client = await createClient();
  if (quoteId !== null && !(await getQuoteForEdit(client, business.id, quoteId))) return { message: "That quote no longer exists." };
  const data = parsed.data;
  const values = {
    business_id: business.id, customer_id: data.customerId as number, status: quoteId === null ? "draft" : data.status,
    quote_date: data.quoteDate as string, expiration_date: data.expirationDate ?? null, sent_date: data.sentDate ?? null,
    response_date: data.responseDate ?? null, contact_method: data.contactMethod ?? null,
    referral_source: data.referralSource ?? null, service_address: data.serviceAddress ?? null,
    municipality: data.municipality ?? null, property_location: data.propertyLocation ?? null,
    location_description: data.locationDescription ?? null, hazard_notes: data.hazardNotes ?? null,
    customer_scope: data.customerScope ?? null, internal_notes: data.internalNotes ?? null,
    normal_price: data.normalPrice ?? null, quoted_price: data.proBono ? 0 : data.quotedPrice ?? 0,
    discount_reason: data.discountReason ?? null, pro_bono: data.proBono,
    accepted_method: data.acceptedMethod ?? null, acceptance_notes: data.acceptanceNotes ?? null,
    pa811_required: data.pa811Required,
  };
  try {
    const id = quoteId === null ? (await createQuote(client, values)).id : quoteId;
    if (quoteId !== null && !(await updateQuote(client, business.id, quoteId, values))) return { message: "That quote no longer exists." };
    revalidatePath("/quotes"); revalidatePath("/dashboard"); redirect(`/quotes/${id}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: "The quote could not be saved. Check the values and try again." };
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
  } catch { return { message: "The quote status could not be updated." }; }
}

export async function convertQuoteToJob(quoteId: number, _state: QuoteFormState): Promise<QuoteFormState> {
  void _state;
  const context = await requireBusinessContext();
  if (context.role === "intern") return { message: "Interns have read-only access." };
  try {
    const jobId = await convertQuote(await createClient(), quoteId);
    revalidatePath("/quotes"); revalidatePath(`/quotes/${quoteId}`); revalidatePath("/jobs"); revalidatePath("/dashboard");
    redirect(`/jobs/${jobId}`);
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error;
    return { message: error instanceof Error ? error.message : "The quote could not be converted." };
  }
}
