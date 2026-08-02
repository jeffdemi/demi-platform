# Architecture

```text
Browser
  -> Next.js App Router on Vercel
    -> Server Components and Server Actions
      -> Supabase Auth and Data API
        -> PostgreSQL with Row Level Security
```

## Boundaries

- Routes and pages own navigation, rendering, and request concerns.
- Server Actions validate untrusted form input and re-check authorization.
- Data access uses request-scoped Supabase server clients.
- PostgreSQL constraints preserve relationships and business invariants.
- RLS enforces business isolation independently of application filters.

## Tenancy

Every operational row belongs to a business. Membership connects a Supabase Auth user to a business with an `owner`, `admin`, or `employee` role. RLS membership helpers live in the unexposed `private` schema.

Account provisioning is invite-only after a one-time owner bootstrap. Team invitation acceptance is checked transactionally against the authenticated user's email. Server-only admin credentials are isolated in `src/lib/supabase/admin.ts` and are never used for normal application data access.

## Migration

The existing Python and SQLite application remains unchanged as the behavioral reference and rollback source. Legacy rows are copied through a repeatable migration utility that preserves source IDs in each table's `legacy_id` column. A service-role-only PostgreSQL function performs the relationship remap in one transaction and records the source fingerprint and row counts for idempotency.
