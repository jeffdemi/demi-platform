import { describe, expect, it } from "vitest";
import { loginSchema } from "./auth";
import { businessSchema } from "./business";

describe("loginSchema", () => {
  it("normalizes a valid owner login", () => {
    expect(
      loginSchema.parse({ email: "  owner@example.com ", password: "secret" }),
    ).toEqual({ email: "owner@example.com", password: "secret" });
  });

  it("rejects malformed credentials before contacting auth", () => {
    expect(loginSchema.safeParse({ email: "not-an-email", password: "" }).success).toBe(false);
  });
});

describe("businessSchema", () => {
  it("trims a valid business name", () => {
    expect(businessSchema.parse({ name: "  Demi Stump Grinding  " })).toEqual({
      name: "Demi Stump Grinding",
    });
  });

  it("rejects empty business names", () => {
    expect(businessSchema.safeParse({ name: " " }).success).toBe(false);
  });
});
