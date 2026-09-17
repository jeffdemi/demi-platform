import { describe, expect, it } from "vitest";
import { describeDbError } from "./supabase-errors";

describe("describeDbError", () => {
  it("turns a missing-column schema cache error into an actionable message", () => {
    const message = describeDbError(
      { code: "PGRST204", message: "Could not find the 'special_instructions' column of 'quotes' in the schema cache" },
      "create quote",
    );
    expect(message).toContain("Unable to create quote");
    expect(message).toContain("schema is out of date");
    expect(message).toContain("supabase db push");
    expect(message).toContain("special_instructions");
  });

  it("turns a missing-table schema cache error into an actionable message", () => {
    const message = describeDbError(
      { code: "PGRST205", message: "Could not find the table 'public.quote_knowledge' in the schema cache" },
      "load the knowledge base",
    );
    expect(message).toContain("schema is out of date");
    expect(message).toContain("supabase db push");
  });

  it("passes through an unrelated database error unchanged", () => {
    const message = describeDbError({ code: "23505", message: "duplicate key value violates unique constraint" }, "create quote");
    expect(message).toBe("Unable to create quote: duplicate key value violates unique constraint");
    expect(message).not.toContain("schema is out of date");
  });

  it("handles a missing error", () => {
    expect(describeDbError(null, "create quote")).toBe("Unable to create quote.");
  });
});
