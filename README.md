# Demi Platform

The hosted business operations platform for Demi Solutions LLC.

## Stack

- Next.js 16 App Router
- TypeScript
- React 19
- Tailwind CSS
- Supabase PostgreSQL and Auth
- Vercel deployment target
- Vitest
- pdf-lib for server-generated business PDFs
- read-excel-file for validated `.xlsx` job imports

## Requirements

- Node.js 22 or newer
- npm
- A Supabase project

With nvm installed:

```bash
nvm use
npm install
```

## Environment

Copy `.env.example` to `.env.local` and configure:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=
```

Only use a modern Supabase publishable key in browser-visible configuration. `SUPABASE_SECRET_KEY` is server-only and is used solely for owner-initiated team invitations. Never expose it through a `NEXT_PUBLIC_` variable.

## Account Setup

The platform is invite-only. While the database has no business workspace, `/setup` permits only `jeffdemi@gmail.com` to register the first owner. Email confirmation is required. PostgreSQL independently enforces the same email allowlist and permanently closes workspace creation after the first business is created.

After setup, disable public signup in Supabase and use the Team screen for additional accounts. Configure the Supabase Auth URLs, invite template, password policy, SMTP, and Vercel variables described in [Authentication](docs/authentication.md).

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

## Database

Supabase schema changes are versioned in `supabase/migrations`. The initial schema provides:

- Auth-linked profiles
- Businesses and role-based business membership
- Customers, jobs, quotes, invoices, expenses, equipment, and maintenance
- Exact decimal money values and timezone-aware audit timestamps
- Tenant-safe composite foreign keys
- Row Level Security on every public table
- Indexed operational and relationship queries

The feature-parity migration adds an RLS-protected job import audit table and
transactional functions for quote conversion, invoice creation, maintenance
meter updates, and confirmed spreadsheet imports. Apply migrations in filename
order before deploying application code that depends on them.

The financial-accuracy migration classifies expense records as operating
expenses, asset purchases, or refunds; adds reversible archiving and linked
refunds; and provisions a private, business-scoped receipt bucket. Existing
rows remain intact. Explicitly tagged imported assets and the known imported
refund are classified in place without changing their source amounts.

The accounting-operations migration adds statement reconciliation, source-linked
payments, a balanced double-entry journal, tax metadata, and receipt review. It
backfills payment and journal records from existing paid invoices, uninvoiced
paid jobs, and active expenses without deleting or rewriting the source rows.

The browser uses Supabase's publishable key. Authorization is enforced by authenticated sessions and business-membership RLS policies.

## Legacy Data

The migration tool validates the source SQLite database and performs a dry run by default:

```bash
npm run migrate:legacy
```

After the owner workspace exists and `SUPABASE_SECRET_KEY` is available locally, apply the transaction:

```bash
node --env-file=.env.local scripts/migrate-legacy-sqlite.mjs --apply
```

The import preserves source IDs in `legacy_id`, remaps relationships, normalizes decimals, and verifies every table count. See [Legacy Migration](docs/legacy-migration.md).

## Operations

The platform includes secure sign-in, password recovery, invite-only account creation, protected routing, owner workspace onboarding, and transactional legacy import support.

Daily operations currently provides:

- Customer search, summaries, create/edit forms, and detail pages
- Customer job and invoice history with paid-revenue totals
- Job search, supported status filters, and operational views
- Job scheduling, pricing, time, payment, location, and work-detail forms
- Readable imported statuses that remain preserved until deliberately corrected
- Clickable customer, job, and operational dashboard links
- Quote create/edit/search/status workflows, customer-ready messages, PDFs, and one-time quote-to-job conversion
- Invoice creation, job/customer linking, payment status, and PDFs
- Expense create/edit/detail workflows with operating, asset, and refund classification
- Reversible expense archiving, linked refunds, and private receipt uploads
- Equipment records, maintenance history, hour-meter updates, and upcoming service queues
- Financial, sales, referral, maintenance, and daily operating dashboard sections
- Monthly reports, authenticated JSON APIs, and CSV exports
- CSV/XLSX bank-statement imports, duplicate detection, and reconciliation queues
- Partial customer payments linked to invoices, jobs, and bank deposits
- Balanced expense/payment journals and annual tax-preparation exports
- Receipt review with rule-based category suggestions
- Preview-first `.xlsx` or `.csv` job import with duplicate protection and audit history

Primary operational URLs:

```text
/dashboard                 Daily operations and financial summary
/customers                 Customer search and history
/jobs                      Search, status, and operational job views
/quotes                    Sales pipeline and quote workflows
/invoices                  Billing and payment status
/expenses                  Operating costs, assets, refunds, and receipts
/finance                   Bank accounts, imported transactions, and reconciliation
/finance/import            Preview and import a bank statement
/finance/payments/new      Record or reconcile a customer payment
/equipment                 Assets and maintenance history
/imports/jobs              Spreadsheet preview and import
/reports                    Financial and operating reports/exports
/api/v1/{resource}         Authenticated JSON records
/api/v1/{resource}?format=csv
/api/v1/reports/summary    Authenticated reporting summary
/api/v1/reports/tax-summary?year=2026&format=csv
/api/v1/reports/general-ledger?from=2026-01-01&to=2026-12-31&format=csv
```

External SMS/email sending, payment collection, electronic signatures, customer
portal access, PA 811 submission, municipality lookup, and travel-time services
remain intentionally deferred.
