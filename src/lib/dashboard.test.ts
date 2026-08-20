import { describe, expect, it } from "vitest";
import { resolveDashboardRange } from "./domain/dashboard";

describe("dashboard date ranges", () => {
  it("defaults to the current month through today", () => {
    expect(resolveDashboardRange("2026-08-20")).toMatchObject({
      selected: "this_month",
      start: "2026-08-01",
      end: "2026-08-20",
    });
  });

  it("supports an unbounded all-time range", () => {
    expect(resolveDashboardRange("2026-08-20", "all_time")).toMatchObject({
      start: null,
      end: null,
    });
  });

  it("normalizes a reversed custom range", () => {
    expect(resolveDashboardRange("2026-08-20", "custom", "2026-08-15", "2026-08-01")).toMatchObject({
      start: "2026-08-01",
      end: "2026-08-15",
    });
  });
});
