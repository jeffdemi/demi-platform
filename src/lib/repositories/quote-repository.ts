import type { SupabaseClient } from "@supabase/supabase-js";
import { quoteMatchesSearch, type QuoteWithCustomer } from "@/lib/domain/quotes";
import type { JobQuotePrefill } from "@/lib/job-quote-prefill";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type JobLink = Pick<Database["public"]["Tables"]["jobs"]["Row"], "id" | "status">;
export type QuoteDetail = QuoteWithCustomer & { jobs: JobLink | null };
const QUOTE_DETAIL_SELECT = "*, customers!inner(company_name, customer_type, email, first_name, last_name, phone), jobs!quotes_business_job_fkey(id, status)";

function dataOrThrow<T>(data: T | null, error: { message: string } | null, label: string): T {
  if (error || data === null) throw new Error(`${label}${error ? `: ${error.message}` : "."}`);
  return data;
}

export async function listQuotes(client: Client, businessId: number, filters: { customerId?: number; search?: string; status?: string; view?: string; includeArchived?: boolean }) {
  let query = client.from("quotes")
    .select("*, customers!inner(company_name, customer_type, email, first_name, last_name, phone)")
    .eq("business_id", businessId).order("quote_date", { ascending: false }).order("id", { ascending: false }).limit(500);
  if (!filters.includeArchived) query = query.is("archived_at", null);
  if (filters.customerId) query = query.eq("customer_id", filters.customerId);
  const result = await query;
  return dataOrThrow(result.data as QuoteWithCustomer[] | null, result.error, "Unable to load quotes").filter((quote) => {
    if (filters.status && quote.status !== filters.status) return false;
    if (filters.search && !quoteMatchesSearch(quote, filters.search)) return false;
    if (filters.view === "awaiting_response" && !["sent", "no_response"].includes(quote.status)) return false;
    if (filters.view === "accepted_unconverted" && (quote.status !== "accepted" || quote.job_id !== null)) return false;
    if (filters.view === "outstanding" && !["draft", "sent", "accepted"].includes(quote.status)) return false;
    return true;
  });
}

export async function getQuote(client: Client, businessId: number, quoteId: number) {
  const result = await client.from("quotes")
    .select(QUOTE_DETAIL_SELECT)
    .eq("business_id", businessId).eq("id", quoteId).maybeSingle();
  if (result.error) throw new Error(`Unable to load quote: ${result.error.message}`);
  return result.data as QuoteDetail | null;
}

export async function getQuoteForEdit(client: Client, businessId: number, quoteId: number) {
  const result = await client.from("quotes").select("*").eq("business_id", businessId).eq("id", quoteId).maybeSingle();
  if (result.error) throw new Error(`Unable to load quote: ${result.error.message}`);
  return result.data;
}

async function nextQuoteNumber(client: Client, businessId: number, quoteDate: string) {
  const year = quoteDate.slice(0, 4);
  const prefix = `Q-${year}-`;
  const result = await client.from("quotes").select("quote_number").eq("business_id", businessId)
    .like("quote_number", `${prefix}%`).order("quote_number", { ascending: false }).limit(1).maybeSingle();
  if (result.error) throw new Error(`Unable to generate quote number: ${result.error.message}`);
  const current = result.data?.quote_number.match(/(\d+)$/)?.[1];
  return `${prefix}${String((current ? Number(current) : 0) + 1).padStart(4, "0")}`;
}

export async function createQuote(client: Client, values: Omit<Database["public"]["Tables"]["quotes"]["Insert"], "quote_number">) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const quoteNumber = await nextQuoteNumber(client, values.business_id, values.quote_date ?? new Date().toISOString().slice(0, 10));
    const result = await client.from("quotes").insert({ ...values, quote_number: quoteNumber }).select("id").single();
    if (!result.error && result.data) return result.data;
    if (result.error?.code !== "23505") throw new Error(`Unable to create quote: ${result.error?.message}`);
  }
  throw new Error("Unable to generate a unique quote number.");
}

export async function updateQuote(client: Client, businessId: number, quoteId: number, values: Database["public"]["Tables"]["quotes"]["Update"]) {
  const result = await client.from("quotes").update(values).eq("business_id", businessId).eq("id", quoteId).select("id").maybeSingle();
  if (result.error) throw new Error(`Unable to update quote: ${result.error.message}`);
  return result.data;
}

export type CustomerQuoteSummary = Pick<
  Database["public"]["Tables"]["quotes"]["Row"],
  "id" | "quote_number" | "status" | "quote_date" | "quoted_price" | "pro_bono" | "job_id" |
  "service_address" | "property_location" | "location_description" |
  "referral_source" | "customer_scope" | "hazard_notes" | "pa811_required" | "acceptance_notes"
>;

export async function listQuotesForCustomer(client: Client, businessId: number, customerId: number) {
  const result = await client.from("quotes")
    .select("id, quote_number, status, quote_date, quoted_price, pro_bono, job_id, service_address, property_location, location_description, referral_source, customer_scope, hazard_notes, pa811_required, acceptance_notes")
    .eq("business_id", businessId).eq("customer_id", customerId)
    .order("quote_date", { ascending: false }).order("id", { ascending: false }).limit(50);
  if (result.error) throw new Error(`Unable to load quotes: ${result.error.message}`);
  return (result.data ?? []) as CustomerQuoteSummary[];
}

export async function listJobQuotePrefills(client: Client, businessId: number) {
  const result = await client.from("quotes")
    .select("id, customer_id, quote_number, status, service_address, property_location, location_description, referral_source, customer_scope, hazard_notes, quoted_price, pro_bono, pa811_required, acceptance_notes, internal_notes")
    .eq("business_id", businessId)
    .in("status", ["draft", "sent", "accepted", "no_response"])
    .is("job_id", null)
    .is("archived_at", null)
    .order("quote_date", { ascending: false })
    .order("id", { ascending: false })
    .limit(200);
  if (result.error) throw new Error(`Unable to load available quotes: ${result.error.message}`);
  return (result.data ?? []) as JobQuotePrefill[];
}

export async function convertQuote(client: Client, businessId: number, quoteId: number,
  values: Partial<Omit<Database["public"]["Tables"]["jobs"]["Insert"], "business_id">>) {
  const result = await client.rpc("convert_quote_to_job_with_values", {
    target_business_id: businessId, target_quote_id: quoteId, job_values: values,
  });
  if (result.error) throw new Error(result.error.message);
  return result.data;
}

export async function quoteDashboardSummary(client: Client, businessId: number, start: string | null, end: string | null) {
  const result = await client.from("quotes").select("status, quoted_price, job_id, quote_date").eq("business_id", businessId);
  const quotes = dataOrThrow(result.data, result.error, "Unable to load quote summary");
  const inRange = (date: string) => (!start || date >= start) && (!end || date <= end);
  const rangeQuotes = quotes.filter((q) => inRange(q.quote_date));
  const decided = rangeQuotes.filter((q) => ["accepted", "converted", "declined", "no_response", "expired"].includes(q.status));
  const accepted = decided.filter((q) => ["accepted", "converted"].includes(q.status));
  return {
    draftCount: rangeQuotes.filter((q) => q.status === "draft").length,
    awaitingResponseCount: rangeQuotes.filter((q) => ["sent", "no_response"].includes(q.status)).length,
    acceptedUnconvertedCount: rangeQuotes.filter((q) => q.status === "accepted" && !q.job_id).length,
    outstandingValue: rangeQuotes.filter((q) => ["draft", "sent", "accepted"].includes(q.status)).reduce((sum, q) => sum + q.quoted_price, 0),
    acceptanceRate: decided.length ? Math.round((accepted.length / decided.length) * 1000) / 10 : 0,
  };
}
