import type { Metadata } from "next";
import { AccountCard } from "@/components/account-card";

export const metadata: Metadata = { title: "Link unavailable" };

export default function AuthErrorPage() {
  return (
    <AccountCard
      backHref="/forgot-password"
      backLabel="Request a new reset link"
      description="This sign-in link is invalid, expired, or has already been used."
      title="That link did not work"
    >
      <p className="mt-6 rounded-md border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-strong" role="alert">
        For your security, account links can only be used once.
      </p>
    </AccountCard>
  );
}
