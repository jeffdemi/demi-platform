"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_BUSINESS_COOKIE, requireBusinessContext } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(ACTIVE_BUSINESS_COOKIE);
  redirect("/login");
}

export async function switchBusiness(formData: FormData) {
  const requestedId = Number(formData.get("businessId"));
  const { memberships } = await requireBusinessContext();
  const target = memberships.find((membership) => membership.id === requestedId);

  if (target) {
    (await cookies()).set(ACTIVE_BUSINESS_COOKIE, String(target.id), {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  redirect("/dashboard");
}
