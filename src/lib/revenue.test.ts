import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { actualCashReceipts } from "./domain/revenue";

const jobs = [
  { id: 16, amount_paid: 350, amount_quoted: 400, paid_date: "2026-08-13", job_date: "2026-08-13" },
  { id: 17, amount_paid: 400, amount_quoted: 500, paid_date: "2026-08-13", job_date: "2026-08-13" },
];

describe("actual cash receipts", () => {
  it("uses recorded paid totals when a job has no payment-ledger row", () => {
    const receipts = actualCashReceipts({ payments: [], jobs });

    expect(receipts.map((receipt) => receipt.amount)).toEqual([350, 400]);
    expect(receipts.every((receipt) => receipt.source === "job_paid_fallback")).toBe(true);
    expect(receipts.reduce((sum, receipt) => sum + receipt.amount, 0)).toBe(750);
  });

  it("uses payment records without also counting the job paid total", () => {
    const receipts = actualCashReceipts({
      payments: [{ amount: 325, payment_date: "2026-08-13", job_id: 16 }],
      jobs: [jobs[0]],
    });

    expect(receipts).toEqual([{
      amount: 325,
      payment_date: "2026-08-13",
      job_id: 16,
      source: "payment",
    }]);
  });

  it("recognizes invoice-linked payments and never restores a voided payment", () => {
    const receipts = actualCashReceipts({
      payments: [{ amount: 350, payment_date: "2026-08-13", invoice_id: 9, voided_at: "2026-08-14T12:00:00Z" }],
      invoices: [{ id: 9, job_id: 16 }],
      jobs: [jobs[0]],
    });

    expect(receipts).toEqual([]);
  });

  it("renders the Jobs list from amount paid rather than amount quoted", async () => {
    const source = await readFile(new URL("../app/(app)/jobs/page.tsx", import.meta.url), "utf8");

    expect(source).toContain("formatCurrency(job.amount_paid)");
    expect(source).not.toContain("formatCurrency(job.amount_quoted)");
    expect(source).toContain("Amount paid");
  });

  it("backfills missing payment rows without rewriting source jobs", async () => {
    const migration = await readFile(
      new URL("../../supabase/migrations/20260814134601_backfill_unlinked_job_payments.sql", import.meta.url),
      "utf8",
    );

    expect(migration).toContain("insert into public.payments");
    expect(migration).toContain("j.amount_paid");
    expect(migration).toContain("'legacy'");
    expect(migration).not.toMatch(/delete\s+from\s+public\.jobs/i);
    expect(migration).not.toMatch(/update\s+public\.jobs/i);
  });
});
