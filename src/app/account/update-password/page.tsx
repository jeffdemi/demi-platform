import type { Metadata } from "next";
import { AccountCard } from "@/components/account-card";
import { requireUser } from "@/lib/auth";
import { UpdatePasswordForm } from "./update-password-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function UpdatePasswordPage() {
  await requireUser();

  return (
    <AccountCard
      description="Choose a strong password for your Demi Platform account."
      title="Choose a new password"
    >
      <UpdatePasswordForm />
    </AccountCard>
  );
}
