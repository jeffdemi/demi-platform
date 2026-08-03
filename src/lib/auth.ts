import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

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
  const { data: membership, error: membershipError } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    throw new Error("Unable to load business membership.");
  }

  if (!membership) {
    if (user.invitationId) {
      redirect("/account/accept-invite");
    }
    redirect("/onboarding");
  }

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id, name, timezone")
    .eq("id", membership.business_id)
    .single();

  if (businessError || !business) {
    throw new Error("Unable to load business.");
  }

  return {
    user,
    business,
    role: membership.role as "owner" | "admin" | "employee",
  };
});
