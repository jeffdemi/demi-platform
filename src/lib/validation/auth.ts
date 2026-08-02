import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(1, "Enter your password."),
});

export const passwordResetRequestSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
});

const strongPassword = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(72, "Use no more than 72 characters.");

export const updatePasswordSchema = z
  .object({
    password: strongPassword,
    passwordConfirmation: z.string(),
  })
  .refine((values) => values.password === values.passwordConfirmation, {
    message: "Passwords do not match.",
    path: ["passwordConfirmation"],
  });

export const invitationSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  role: z.enum(["admin", "employee"]),
});

export const acceptInvitationSchema = updatePasswordSchema.and(
  z.object({
    invitationId: z.uuid("Invitation is invalid."),
    fullName: z.string().trim().min(2, "Enter the team member's name.").max(120),
  }),
);

export const initialSetupSchema = updatePasswordSchema.and(
  z.object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .pipe(z.email("Enter a valid email address.")),
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    businessName: z.string().trim().min(2, "Enter the business name.").max(120),
  }),
);
