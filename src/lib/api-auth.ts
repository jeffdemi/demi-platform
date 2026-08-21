import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { publicEnvironment } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export async function apiBusinessContext(request?: Request) {
  const authorization = request?.headers.get("authorization");
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  const client = token
    ? createSupabaseClient<Database>(publicEnvironment.NEXT_PUBLIC_SUPABASE_URL, publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } })
    : await createClient();
  const claims = await client.auth.getClaims(token);
  const userId = claims.data?.claims?.sub;
  if (!userId) return null;
  const membership = await client.from("business_members").select("business_id").eq("user_id", userId).eq("active", true).order("created_at", { ascending: true }).limit(1).maybeSingle();
  if (!membership.data) return null;
  return { client, businessId: membership.data.business_id };
}

export function csvResponse(rows: Record<string, unknown>[], filename: string) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [headers.map(escape).join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\r\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
}
