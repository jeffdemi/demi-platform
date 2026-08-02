import { describe, expect, it } from "vitest";
import {
  acceptInvitationSchema,
  initialSetupSchema,
  invitationSchema,
  loginSchema,
  passwordResetRequestSchema,
  updatePasswordSchema,
} from "./auth";
import { businessSchema } from "./business";
import { isInitialOwnerEmail } from "../auth-config";

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

describe("account validation", () => {
  it("normalizes recovery email addresses", () => {
    expect(passwordResetRequestSchema.parse({ email: " JEFFDEMI@GMAIL.COM " })).toEqual({
      email: "jeffdemi@gmail.com",
    });
  });

  it("requires matching passwords with at least 12 characters", () => {
    expect(updatePasswordSchema.safeParse({
      password: "short",
      passwordConfirmation: "short",
    }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({
      password: "long-secure-password",
      passwordConfirmation: "different-password",
    }).success).toBe(false);
    expect(updatePasswordSchema.safeParse({
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
    }).success).toBe(true);
  });

  it("normalizes invitations and rejects elevated roles", () => {
    expect(invitationSchema.parse({ email: " TEAM@EXAMPLE.COM ", role: "employee" })).toEqual({
      email: "team@example.com",
      role: "employee",
    });
    expect(invitationSchema.safeParse({ email: "team@example.com", role: "owner" }).success).toBe(false);
  });

  it("requires a valid invitation id and team member name", () => {
    expect(acceptInvitationSchema.safeParse({
      invitationId: "not-a-uuid",
      fullName: "J",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
    }).success).toBe(false);
  });

  it("accepts a complete initial owner registration", () => {
    expect(initialSetupSchema.safeParse({
      email: "jeffdemi@gmail.com",
      fullName: "Jeff Demi",
      businessName: "Demi Stump Grinding",
      password: "long-secure-password",
      passwordConfirmation: "long-secure-password",
    }).success).toBe(true);
  });

  it("allows only the configured email to bootstrap the platform", () => {
    expect(isInitialOwnerEmail(" JEFFDEMI@GMAIL.COM ")).toBe(true);
    expect(isInitialOwnerEmail("someone@example.com")).toBe(false);
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
