type SupabasePostgrestError = { message: string; code?: string } | null;

/**
 * PostgREST returns PGRST202/204/205 (or any "schema cache" message) when the app queries a
 * function/column/table it doesn't know about yet — almost always because a Supabase migration
 * that adds it hasn't been applied to this environment. That underlying message is otherwise
 * cryptic, so turn it into an actionable instruction instead of forwarding it as-is.
 */
export function describeDbError(error: SupabasePostgrestError, action: string): string {
  if (!error) return `Unable to ${action}.`;
  if (error.code === "PGRST202" || error.code === "PGRST204" || error.code === "PGRST205" || /schema cache/i.test(error.message)) {
    return `Unable to ${action}: the database schema is out of date (${error.message}). An administrator needs to apply pending Supabase migrations (supabase db push) before this will work.`;
  }
  return `Unable to ${action}: ${error.message}`;
}
