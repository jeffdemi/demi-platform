import { describe, expect, it } from "vitest";
import { safeNextPath } from "./redirects";

describe("safeNextPath", () => {
  it("keeps internal application paths", () => {
    expect(safeNextPath("/account/team?status=pending")).toBe("/account/team?status=pending");
  });

  it.each([
    "https://attacker.example",
    "//attacker.example/path",
    "/\\attacker.example",
    "dashboard",
    "",
  ])("rejects an unsafe redirect: %s", (value) => {
    expect(safeNextPath(value)).toBe("/dashboard");
  });
});
