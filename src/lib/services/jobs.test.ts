import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createJobFromForm } from "./jobs";
import { createJob } from "@/lib/repositories/job-repository";
import { convertQuote, getQuoteForEdit } from "@/lib/repositories/quote-repository";

vi.mock("@/lib/repositories/job-repository", () => ({ createJob: vi.fn() }));
vi.mock("@/lib/repositories/quote-repository", () => ({ convertQuote: vi.fn(), getQuoteForEdit: vi.fn() }));
const client = {} as SupabaseClient<Database>;
const values = { business_id: 1, customer_id: 2, status: "scheduled", amount_quoted: 250, notes: "Edited", scheduled_date: "2026-10-01" };
function quote(status: string, jobId: number | null = null) {
  vi.mocked(getQuoteForEdit).mockResolvedValue({ status, job_id: jobId, customer_id: 2, archived_at: null } as NonNullable<Awaited<ReturnType<typeof getQuoteForEdit>>>);
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(createJob).mockResolvedValue({ id: 10 }); vi.mocked(convertQuote).mockResolvedValue(11); });
describe("job creation workflow", () => {
  it("creates an independent job without a quote", async () => {
    expect(await createJobFromForm(client, values, null)).toEqual({ id: 10 });
    expect(getQuoteForEdit).not.toHaveBeenCalled();
    expect(createJob).toHaveBeenCalledWith(client, values);
  });
  it.each(["draft", "sent", "no_response"])("preserves %s prefill behavior", async status => {
    quote(status);
    await createJobFromForm(client, values, 3);
    expect(createJob).toHaveBeenCalledWith(client, values);
    expect(convertQuote).not.toHaveBeenCalled();
  });
  it("sends final values through one conversion RPC", async () => {
    quote("accepted");
    expect(await createJobFromForm(client, values, 3)).toEqual({ id: 11 });
    expect(getQuoteForEdit).toHaveBeenCalledWith(client, 1, 3);
    expect(convertQuote).toHaveBeenCalledWith(client, 1, 3, { customer_id: 2, status: "scheduled", amount_quoted: 250, notes: "Edited", scheduled_date: "2026-10-01" });
    expect(createJob).not.toHaveBeenCalled();
  });
  it.each(["declined", "expired"])("rejects an inactive %s quote", async status => {
    quote(status);
    await expect(createJobFromForm(client, values, 3)).rejects.toThrow("active quote");
    expect(createJob).not.toHaveBeenCalled();
    expect(convertQuote).not.toHaveBeenCalled();
  });
  it.each(["draft", "accepted"])("rejects a different customer for %s quotes", async status => {
    quote(status);
    await expect(createJobFromForm(client, { ...values, customer_id: 99 }, 3)).rejects.toThrow("different customer");
    expect(createJob).not.toHaveBeenCalled();
    expect(convertQuote).not.toHaveBeenCalled();
  });
  it("excludes the quote link from the transactional values", async () => {
    quote("accepted");
    await createJobFromForm(client, { ...values, quote_id: null }, 3);
    expect(convertQuote).toHaveBeenCalledWith(client, 1, 3, expect.not.objectContaining({ quote_id: expect.anything() }));
    expect(vi.mocked(convertQuote).mock.calls[0][3]).not.toHaveProperty("quote_id");
  });
  it("rejects a missing or inaccessible quote", async () => {
    vi.mocked(getQuoteForEdit).mockResolvedValue(null);
    await expect(createJobFromForm(client, values, 3)).rejects.toThrow("no longer exists");
    expect(createJob).not.toHaveBeenCalled();
  });
  it("rejects an already linked quote", async () => {
    quote("converted", 11);
    await expect(createJobFromForm(client, values, 3)).rejects.toThrow("already been converted");
    expect(createJob).not.toHaveBeenCalled();
  });
  it("propagates a transactional rejection without falling back to a separate insert", async () => {
    quote("accepted");
    vi.mocked(convertQuote).mockRejectedValue(new Error("Quote changed concurrently"));
    await expect(createJobFromForm(client, values, 3)).rejects.toThrow("changed concurrently");
    expect(createJob).not.toHaveBeenCalled();
  });
});
