import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountCard } from "@/components/account-card";
import { initialOwnerEmail } from "@/lib/auth-config";
import { createClient } from "@/lib/supabase/server";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Initial setup" };
export const dynamic = "force-dynamic";

export default async function SetupPage() {
  const supabase = await createClient();
  const { data: available } = await supabase.rpc("platform_setup_available");

  if (!available) {
    redirect("/login");
  }

  return (
    <AccountCard
      description="Create the first owner and business workspace. This page closes permanently after setup."
      title="Secure initial setup"
    >
      <SetupForm ownerEmail={initialOwnerEmail} />
    </AccountCard>
  );
}
