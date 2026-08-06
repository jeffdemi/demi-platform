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
- Repository modules own reusable Supabase queries and mutations for business records.
- Domain modules own display names, status labels, search matching, and operational filters.
- Data access uses request-scoped Supabase server clients.
- PostgreSQL constraints preserve relationships and business invariants.
- RLS enforces business isolation independently of application filters.
- Dedicated PDF services build quote and invoice documents; route handlers only authorize and return responses.
- The expense service validates refund sources and owns private receipt upload/replacement cleanup.
- Authenticated API route handlers reuse the same request-scoped client and RLS policies as the web application.

## Tenancy

Every operational row belongs to a business. Membership connects a Supabase Auth user to a business with an `owner`, `admin`, or `employee` role. RLS membership helpers live in the unexposed `private` schema.

Account provisioning is invite-only after a one-time owner bootstrap. Team invitation acceptance is checked transactionally against the authenticated user's email. Server-only admin credentials are isolated in `src/lib/supabase/admin.ts` and are never used for normal application data access.

## Migration

The existing Python and SQLite application remains unchanged as the behavioral reference and rollback source. Legacy rows are copied through a repeatable migration utility that preserves source IDs in each table's `legacy_id` column. A service-role-only PostgreSQL function performs the relationship remap in one transaction and records the source fingerprint and row counts for idempotency.

Normal job spreadsheet imports use the signed-in user's session instead of the
service role. The browser first receives a server-generated preview. Confirmation
calls one PostgreSQL function that matches or creates customers, skips job
fingerprints already present, creates jobs, and writes an audit row atomically.

Quote conversion, invoice creation with job-state synchronization, and
maintenance hour-meter updates are also PostgreSQL transactions. Their functions
run as the caller and remain subject to RLS; none bypass tenant authorization.

Financial records use additive classification and reversible archiving. Refunds
retain positive source amounts and reference the original record; domain helpers
apply the negative reporting impact consistently. Receipt objects are private and
their storage policies reuse business-membership authorization.
