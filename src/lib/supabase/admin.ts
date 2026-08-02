import { createClient } from "@supabase/supabase-js";
import { getSupabaseSecretKey, publicEnvironment } from "@/lib/env";
import type { Database } from "@/types/database";

export function createAdminClient() {
  return createClient<Database>(
    publicEnvironment.NEXT_PUBLIC_SUPABASE_URL,
    getSupabaseSecretKey(),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
