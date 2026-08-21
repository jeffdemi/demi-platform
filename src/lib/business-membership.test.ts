import { describe, expect, it } from "vitest";
import { resolveActiveBusiness, type BusinessMembership } from "./domain/business-membership";

const memberships: BusinessMembership[] = [
  { id: 1, name: "Demi Stump Grinding", timezone: "America/New_York", role: "owner" },
  { id: 2, name: "Second Business", timezone: "America/New_York", role: "owner" },
];

describe("resolveActiveBusiness", () => {
  it("returns the membership matching the requested business id", () => {
    expect(resolveActiveBusiness(memberships, 2)).toEqual(memberships[1]);
  });

  it("defaults to the first membership when no business id is requested", () => {
    expect(resolveActiveBusiness(memberships, null)).toEqual(memberships[0]);
  });

  it("falls back to the first membership when the requested id isn't one of the user's businesses", () => {
    expect(resolveActiveBusiness(memberships, 999)).toEqual(memberships[0]);
  });

  it("throws when the user has no active memberships", () => {
    expect(() => resolveActiveBusiness([], 1)).toThrow("No business memberships available.");
  });
});
