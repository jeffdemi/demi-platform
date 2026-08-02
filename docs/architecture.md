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

## Migration

The existing Python and SQLite application remains unchanged as the behavioral reference and rollback source. Legacy rows will be copied through a repeatable migration utility, preserving source IDs in each table's `legacy_id` column and validating counts, relationships, statuses, and financial totals before cutover.
