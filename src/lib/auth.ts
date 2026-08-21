import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { resolveActiveBusiness, type BusinessMembership } from "@/lib/domain/business-membership";
import { createClient } from "@/lib/supabase/server";

export const ACTIVE_BUSINESS_COOKIE = "demi_active_business";

export const requireUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return {
    id: data.claims.sub,
    email: typeof data.claims.email === "string" ? data.claims.email : "",
    invitationId:
      typeof data.claims.user_metadata === "object" &&
      data.claims.user_metadata !== null &&
      "invitation_id" in data.claims.user_metadata &&
      typeof data.claims.user_metadata.invitation_id === "string"
        ? data.claims.user_metadata.invitation_id
        : null,
    initialBusinessName:
      typeof data.claims.user_metadata === "object" &&
      data.claims.user_metadata !== null &&
      "initial_business_name" in data.claims.user_metadata &&
      typeof data.claims.user_metadata.initial_business_name === "string"
        ? data.claims.user_metadata.initial_business_name
        : null,
  };
});

export const requireBusinessContext = cache(async () => {
  const user = await requireUser();
  const supabase = await createClient();
  const { data: rows, error: membershipError } = await supabase
    .from("business_members")
    .select("role, businesses(id, name, timezone)")
    .eq("user_id", user.id)
    .eq("active", true)
    .order("created_at", { ascending: true });

  if (membershipError) {
    throw new Error("Unable to load business membership.");
  }

  const memberships: BusinessMembership[] = (rows ?? [])
    .filter((row) => row.businesses !== null)
    .map((row) => ({
      id: row.businesses!.id,
      name: row.businesses!.name,
      timezone: row.businesses!.timezone,
      role: row.role as BusinessMembership["role"],
    }));

  if (!memberships.length) {
    if (user.invitationId) {
      redirect("/account/accept-invite");
    }
    redirect("/onboarding");
  }

  const cookieStore = await cookies();
  const requestedBusinessId = Number(cookieStore.get(ACTIVE_BUSINESS_COOKIE)?.value);
  const active = resolveActiveBusiness(memberships, Number.isInteger(requestedBusinessId) ? requestedBusinessId : null);

  return {
    user,
    business: { id: active.id, name: active.name, timezone: active.timezone },
    role: active.role,
    memberships,
  };
});
