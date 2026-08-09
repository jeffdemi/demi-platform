import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import type { QuoteWithCustomer } from "./domain/quotes";
import {
  parseQuoteAiResponse,
  quoteAssistantContext,
  quoteAssistantInstructions,
  rankComparableJobs,
  type ComparableJob,
} from "./domain/quote-ai";

const quote = {
  id: 2, business_id: 1, customer_id: 8, job_id: null, legacy_id: null,
  quote_number: "Q-2026-0002", status: "draft", quote_date: "2026-08-08",
  expiration_date: null, sent_date: null, response_date: null, contact_method: "text",
  referral_source: null, service_address: "123 Private Lane", municipality: "West Chester",
  property_location: "back_yard", location_description: "behind the blue shed",
  hazard_notes: "Unmarked utility near fence", customer_scope: "Grind two maple stumps below grade",
  internal_notes: "Never share this note", normal_price: 450, quoted_price: 400,
  discount_reason: null, pro_bono: false, accepted_method: null, acceptance_notes: null,
  pa811_required: true, created_at: "2026-08-08T00:00:00Z", updated_at: "2026-08-08T00:00:00Z",
  customers: { customer_type: "individual", company_name: null, first_name: "Erin", last_name: "Private", phone: "610-555-0199", email: "erin@example.com" },
} satisfies QuoteWithCustomer;

const jobs: ComparableJob[] = [
  { id: 10, status: "paid", completed_date: "2026-08-01", municipality: "West Chester", property_location: "back_yard", work_description: "Grind two maple stumps", amount_quoted: 425, amount_paid: 425, travel_minutes: 20, grinding_minutes: 70, cleanup_minutes: 20, machine_hours: 1.5, pro_bono: false, pa811_required: true },
  { id: 11, status: "paid", completed_date: "2026-08-07", municipality: "Exton", property_location: "front_yard", work_description: "Single pine stump", amount_quoted: 250, amount_paid: 250, travel_minutes: 10, grinding_minutes: 35, cleanup_minutes: 10, machine_hours: 0.8, pro_bono: false, pa811_required: false },
];

const validRecommendation = {
  assistantMessage: "I need the stump diameters before setting a final price.",
  readiness: "needs_information",
  observations: ["Two stumps are described."],
  questions: ["What is the diameter of each stump at ground level?"],
  assumptions: ["Grindings remain on site."],
  riskFlags: ["Confirm utility clearance."],
  suggestedScope: "Grind two maple stumps below grade and leave grindings neatly on site.",
  suggestedPriceLow: 375,
  suggestedPriceHigh: 475,
  recommendedPrice: null,
  confidence: "medium",
  customerMessageDraft: null,
};

describe("quote AI preparation", () => {
  it("ranks locally similar completed jobs first", () => {
    const ranked = rankComparableJobs(quote, jobs);
    expect(ranked.map((job) => job.id)).toEqual([10, 11]);
    expect(ranked[0].similarity_score).toBeGreaterThan(ranked[1].similarity_score);
  });

  it("excludes customer identity, exact address, private notes, hazards, and raw comparable descriptions from AI context", () => {
    const context = quoteAssistantContext(quote, rankComparableJobs(quote, jobs), 3);
    expect(context).toContain("Grind two maple stumps below grade");
    expect(context).toContain('"photoCount":3');
    ["Erin", "Private", "123 Private Lane", "erin@example.com", "610-555-0199", "Never share this note", "Unmarked utility", "Single pine stump", '"jobId"'].forEach((privateValue) => {
      expect(context).not.toContain(privateValue);
    });
  });

  it("does not anchor the estimator to the internal pending-price sentinel", () => {
    const context = quoteAssistantContext({ ...quote, quoted_price: 0 }, rankComparableJobs(quote, jobs), 0);
    expect(context).toContain('"currentQuotedPrice":null');
  });

  it("tells the estimator to ask questions and leave final control with the operator", () => {
    const instructions = quoteAssistantInstructions();
    expect(instructions).toContain("Jeff must approve");
    expect(instructions).toContain("do not infer exact stump diameter");
    expect(instructions).toContain("recommendedPrice to null");
    expect(instructions).toContain("Never expose internal notes");
  });

  it("accepts structured recommendations and rejects reversed price ranges", () => {
    expect(parseQuoteAiResponse(JSON.stringify(validRecommendation))).toEqual(validRecommendation);
    expect(() => parseQuoteAiResponse(JSON.stringify({ ...validRecommendation, suggestedPriceLow: 500, suggestedPriceHigh: 400 }))).toThrow("reversed");
  });

  it("defines private storage, business RLS, explicit grants, and draft-only uploads", async () => {
    const migration = await readFile(new URL("../../supabase/migrations/20260808120000_quote_ai_workbench.sql", import.meta.url), "utf8");
    expect(migration).toContain("create table public.quote_photos");
    expect(migration).toContain("create table public.quote_ai_messages");
    expect(migration).toContain("'quote-photos'");
    expect(migration).toContain("false,");
    expect(migration).toContain("private.is_business_member");
    expect(migration).toContain("quote_record.status = 'draft'");
    expect(migration).toContain("grant select, insert, delete on public.quote_photos to authenticated");
  });

  it("keeps OpenAI calls server-only, ephemeral, and free of secret client variables", async () => {
    const service = await readFile(new URL("./services/quote-ai.ts", import.meta.url), "utf8");
    expect(service).toContain('import "server-only"');
    expect(service).toContain("store: false");
    expect(service).toContain("process.env.OPENAI_API_KEY");
    expect(service).not.toContain("NEXT_PUBLIC_OPENAI");
  });

  it("loads a CSP-safe HEIC decoder only as a native-decoding fallback", async () => {
    const manager = await readFile(new URL("../app/(app)/quotes/quote-photo-manager.tsx", import.meta.url), "utf8");
    expect(manager).toContain('await import("heic-to/csp")');
    expect(manager).toContain("return await decodeInBrowser(file)");
    expect(manager).toContain("stripped of embedded metadata");
  });
});
