"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessSchema } from "@/lib/validation/business";

export type OnboardingState = { message?: string; errors?: { name?: string[] } };

export async function createBusiness(
  _: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  await requireUser();
  const validated = businessSchema.safeParse({ name: formData.get("name") });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_business", {
    business_name: validated.data.name,
  });

  if (error) {
    return { message: "The business workspace could not be created." };
  }

  redirect("/dashboard");
}
