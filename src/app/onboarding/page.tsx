import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Create workspace" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("business_members")
    .select("id")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f4f6f3] px-5 py-12">
      <section className="w-full max-w-lg rounded-lg border border-[#d6ddd8] bg-white p-7 shadow-sm sm:p-10">
        <span className="grid size-12 place-items-center rounded-md bg-[#e8efeb] text-[#16372c]">
          <Building2 aria-hidden="true" size={24} />
        </span>
        <h1 className="mt-6 text-2xl font-bold">Create your workspace</h1>
        <p className="mt-2 leading-7 text-[#66716b]">Signed in as {user.email}</p>
        <OnboardingForm />
      </section>
    </main>
  );
}
