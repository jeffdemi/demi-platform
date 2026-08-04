import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export async function getBusinessDocumentDetails(client: SupabaseClient<Database>, businessId: number) {
  const result = await client.from("businesses").select("name, legal_name, phone, email, address_line_1, address_line_2, city, region, postal_code")
    .eq("id", businessId).single();
  if (result.error) throw new Error(`Unable to load business details: ${result.error.message}`);
  return result.data;
}
