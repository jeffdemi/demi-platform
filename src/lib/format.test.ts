import { describe, expect, it } from "vitest";
import { formatDate } from "./format";

describe("formatDate", () => {
  it("formats date-only bookkeeping values without a timezone shift", () => {
    expect(formatDate("2026-04-09")).toBe("Apr 9, 2026");
  });

  it("formats PostgreSQL timestamps used by digital asset transactions", () => {
    expect(formatDate("2026-04-02 15:13:11+00")).toBe("Apr 2, 2026");
    expect(formatDate("2026-04-09T14:22:51.000Z")).toBe("Apr 9, 2026");
  });

  it("does not throw when a stored date is invalid", () => {
    expect(formatDate("not-a-date")).toBe("Invalid date");
  });
});
