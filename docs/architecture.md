# Architecture

```text
Browser
  -> Next.js App Router on Vercel
    -> Server Components and Server Actions
      -> repositories and services
        -> request-scoped Supabase Auth and Data API
          -> PostgreSQL with Row Level Security
```

## Boundaries

- Routes and pages own navigation, rendering, and request concerns.
- Server Actions validate untrusted form input and re-check authorization.
- Repository modules own reusable Supabase queries and mutations for business records.
- Service modules own multi-step workflows, external APIs, PDFs, and private file
  upload/replacement cleanup.
- Domain modules own pure accounting, parsing, reporting, display, and filtering
  rules without network or database I/O.
- Data access uses request-scoped Supabase server clients.
- PostgreSQL constraints, triggers, and transactional RPCs preserve relationships
  and cross-record business invariants.
- RLS enforces business isolation independently of application filters.
- Dedicated PDF services build quote and invoice documents; route handlers only authorize and return responses.
- The expense service validates refund sources and owns private receipt upload/replacement cleanup.
- Authenticated API route handlers reuse the same request-scoped client and RLS policies as the web application.

## Tenancy

Every operational row belongs to a business. Membership connects a Supabase Auth user to a business with an `owner`, `admin`, or `employee` role. RLS membership helpers live in the unexposed `private` schema.

Account provisioning is invite-only after a one-time owner bootstrap. Team invitation acceptance is checked transactionally against the authenticated user's email. Server-only admin credentials are isolated in `src/lib/supabase/admin.ts` and are never used for normal application data access.

## Data model map

The public schema is organized by responsibility:

- identity and tenancy: `profiles`, `businesses`, `business_members`,
  `business_invitations`, `business_identity_settings`, and `business_lines`;
- operations: `customers`, `quotes`, `jobs`, `invoices`, `expenses`,
  `equipment`, and `maintenance`;
- quote preparation: `quote_photos`, `quote_ai_threads`, `quote_ai_messages`,
  and `quote_ai_recommendations`;
- source imports: `legacy_imports`, `job_imports`, `bank_imports`, and
  `digital_asset_imports`;
- banking and bookkeeping: `bank_accounts`, `bank_transactions`,
  `bank_statement_periods`, `bank_transaction_allocations`,
  `bank_transfer_links`, `bank_classification_rules`, `payments`,
  `ledger_accounts`, `journal_entries`, `journal_lines`, and
  `bookkeeping_adjustments`;
- management reporting: `financial_settings`, `owner_compensation_periods`,
  `labor_entries`, and `monthly_financial_snapshots`;
- digital assets: `digital_asset_accounts`, `digital_asset_transactions`,
  `digital_asset_lots`, `digital_asset_disposals`, and
  `digital_asset_reconciliations`;
- owner, cleanup, and audit: `capital_transactions`,
  `bookkeeping_cleanup_items`, and `record_deletion_audit`.

Receipts and quote photos live in separate private Storage buckets. Database rows
store their object paths; signed URLs are created only after membership and
record access are authorized.

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

Bank imports are previewed in the application and committed through one
caller-authorized PostgreSQL function. File hashes and transaction fingerprints
make re-imports idempotent. Reconciliation links a bank row to at most one active
expense or payment.

Payments are the cash-revenue source of truth. Existing invoice/job payment fields
remain for backward compatibility and are synchronized when a new payment is
recorded. Expense and payment triggers post balanced journal revisions; prior
revisions are superseded instead of overwritten. Ledger tables are read-only to
normal clients and are written only by the database posting functions.

Statement periods provide the bookkeeping control layer above bank imports.

## Digital assets and operating segments

Digital-asset imports are isolated from bank imports but use the same two-part
idempotency model: a source-file SHA-256 prevents replay, and a normalized row
fingerprint prevents duplicates across exports. Transactions retain units,
gross USD value, price, fees, and transfer references. FIFO calculations are a
pure domain operation. Lot and disposal tables exist as a future durable audit
model, but the current importer does not populate a complete persisted tax-lot
schedule and digital-asset activity does not post automatically to the general
ledger. Missing acquisition rows can therefore make the current FIFO display
incomplete. Treat it as a reconciliation aid until all-time basis is proven and
the persistence/posting workflow is completed.

`business_lines` is a tenant-owned dimension. Nullable composite foreign keys
attach it to jobs, invoices, expenses, equipment, labor, payments, allocations,
bank accounts, and journal entries without rewriting historical data. Reports
filter posted entries by line or omit the filter for consolidated books.

Owner activity and historical cleanup use separate tables. Capital activity
posts through an authorized RPC; draws and estimated taxes debit owner
distributions. Cleanup items remain off-ledger until an administrator explicitly
posts a balanced opening-balance entry.
Allocations, transfers, exclusions, and adjustments call security-invoker
PostgreSQL functions so authorization, balancing, duplicate prevention, and
period locks apply in one transaction. Journal lines carry optional bank-account
attribution, allowing statement activity to be proven against book activity
without rewriting historical source amounts.

Bookkeeping statements are derived from posted journal entries rather than from
quoted job values or dashboard approximations. The reporting domain builds a
trial balance, period profit and loss, cumulative balance sheet, and categorized
cash flow from the same ledger query. Closing a month requires completed account
reconciliations and blocks source-dated changes until an owner/admin records a
reopen reason.

Privileged owner setup and invitation implementations live in the unexposed
`private` schema. Public RPC names are security-invoker wrappers, preserving the
application contract without exposing elevated functions directly through the API.

## Change discipline

Database changes are additive. Applied migration files are immutable; a
correction gets a new migration. Every newly exposed table needs explicit Data
API grants as well as RLS, and privileged functions need narrow execute grants.
Application schema types in `src/types/database.ts` change with the migration.

Before modifying application code, read the relevant Next.js 16 documentation in
`node_modules/next/dist/docs/`. See [Development](development.md) for the safe
local/staging workflow and the current production migration-history caveat.
