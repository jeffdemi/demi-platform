import type { SupabaseClient } from "@supabase/supabase-js";
import type { JobImportRow } from "@/lib/domain/imports";
import type { Database, Json } from "@/types/database";

export async function importJobRows(
  client: SupabaseClient<Database>,
  businessId: number,
  fileName: string,
  sourceSha256: string,
  rows: JobImportRow[],
) {
  const result = await client.rpc("import_job_spreadsheet", {
    target_business_id: businessId,
    import_file_name: fileName,
    import_source_sha256: sourceSha256,
    import_rows: rows as unknown as Json,
  });
  if (result.error) throw new Error(`Unable to import jobs: ${result.error.message}`);
  return result.data as { already_imported: boolean; customers_created: number; customers_updated: number; jobs_created: number; duplicates_skipped: number };
}

export async function listJobImports(client: SupabaseClient<Database>, businessId: number) {
  const result = await client.from("job_imports").select("*").eq("business_id", businessId).order("created_at", { ascending: false }).limit(20);
  if (result.error) throw new Error(`Unable to load import history: ${result.error.message}`);
  return result.data;
}
