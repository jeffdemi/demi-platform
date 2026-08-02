import type { Metadata } from "next";
import { AccountCard } from "@/components/account-card";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <AccountCard
      backHref="/login"
      backLabel="Back to sign in"
      description="Enter your account email and we will send a secure reset link."
      title="Reset your password"
    >
      <ForgotPasswordForm />
    </AccountCard>
  );
}
