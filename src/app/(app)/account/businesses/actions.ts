"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE, requireBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { businessSchema } from "@/lib/validation/business";

export type CreateBusinessState = { message?: string; errors?: { name?: string[] } };

export async function createAdditionalBusiness(
  _: CreateBusinessState,
  formData: FormData,
): Promise<CreateBusinessState> {
  const context = await requireBusinessContext();
  if (context.role !== "owner") {
    return { message: "Only business owners can add another business." };
  }

  const validated = businessSchema.safeParse({ name: formData.get("name") });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { data: newBusinessId, error } = await supabase.rpc("create_business", {
    business_name: validated.data.name,
  });

  if (error || !newBusinessId) {
    return { message: "The business workspace could not be created." };
  }

  (await cookies()).set(ACTIVE_BUSINESS_COOKIE, String(newBusinessId), {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  redirect("/dashboard");
}
