# Demi Platform

The hosted business operations platform for Demi Solutions LLC.

## Stack

- Next.js 16 App Router
- TypeScript
- React 19
- Tailwind CSS
- Supabase PostgreSQL and Auth
- Supabase private Storage for receipts and quote photos
- OpenAI Responses API for draft quote analysis
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
OPENAI_API_KEY=
OPENAI_QUOTE_MODEL=gpt-5.6-terra
```

Only use a modern Supabase publishable key in browser-visible configuration. `SUPABASE_SECRET_KEY` is server-only and is used solely for owner-initiated team invitations. Never expose it through a `NEXT_PUBLIC_` variable.

`OPENAI_API_KEY` is also server-only. It enables the quote preparation assistant.
`OPENAI_QUOTE_MODEL` is optional and defaults to the cost-balanced multimodal
model shown above. Never place either value in a `NEXT_PUBLIC_` variable.

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

The quote AI workbench migration adds business-scoped quote photos, persistent AI
threads and messages, structured recommendation history, and a private
`quote-photos` Storage bucket. Uploads are limited to draft quotes, authenticated
business members, twelve photos per quote, and six MB per prepared image. Apply
the migration before deploying application code that reads these tables.

The management-reporting migration adds owner/admin-only labor entries, owner
compensation periods, reporting targets, and monthly balance snapshots. It also
adds management classifications to expenses and depreciation/loan fields to
equipment. Existing expenses default to operating and remain marked for review;
known asset purchases and linked refunds are backfilled without deleting or
replacing any source record.

The paid-amount integrity migration backfills payment and journal rows for jobs
that already have an actual paid amount but no payment-ledger record. Job lists,
cash reports, and management reports display or calculate from actual receipts;
quoted amounts remain separately labeled for estimating, quoting, job details,
and invoice preparation.

The bookkeeping and month-end-close migration adds bank statement periods,
split transaction allocations, bank-transfer matching, balanced adjustments,
account-level reconciliation, and auditable month close/reopen controls. It also
adds bank-account attribution to journal lines and a standard small-business
chart of accounts. The upgrade is additive: existing source records, imported
transactions, payments, expenses, and journal history remain intact.

The next additive release separates Federal IT Contracting from Demi Stump
Grinding while retaining consolidated books. It adds exchange CSV imports and
FIFO digital-asset reporting, owner-capital activity, business identity settings,
and an off-ledger historical cleanup queue. The included migration is local only
until explicitly approved for production.

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
- Price-pending draft preparation with private site photos, HEIC conversion, structured AI recommendations, follow-up chat, and operator-approved scope/price application
- Invoice creation, job/customer linking, payment status, and PDFs
- Expense create/edit/detail workflows with operating, asset, and refund classification
- Reversible expense archiving, linked refunds, and private receipt uploads
- Equipment records, maintenance history, hour-meter updates, and upcoming service queues
- Financial, sales, referral, maintenance, and daily operating dashboard sections
- Monthly reports, authenticated JSON APIs, and CSV exports
- CSV/XLSX bank-statement imports, duplicate detection, and reconciliation queues
- Statement-period reconciliation against both imported and book activity
- Split transaction classification, bank-transfer matching, and auditable exclusions
- Balanced bookkeeping adjustments with reversal-preserving journal history
- Partial customer payments linked to invoices, jobs, and bank deposits
- Balanced expense/payment journals and annual tax-preparation exports
- Receipt review with rule-based category suggestions
- Direct, management, and sales labor/payroll entry with reversible corrections
- Owner market-compensation normalization separated from owner distributions
- COGS, operating, labor, asset, and owner-distribution classifications
- Monthly balance snapshots, cash reconciliation, and a close checklist
- Month locks that protect closed source periods, with reasoned owner/admin reopening
- Ledger-based profit and loss, balance sheet, cash flow, and trial balance reports
- Equipment straight-line management depreciation and loan-balance tracking
- Configurable LER, profit-to-gross-margin, core-capital, and ROIC targets
- A normalized management P&L and Simple Numbers-style scorecard
- A searchable financial guide with context-aware navigation and inline term definitions
- Preview-first `.xlsx` or `.csv` job import with duplicate protection and audit history

Primary operational URLs:

```text
/dashboard                 Daily operations and financial summary
/customers                 Customer search and history
/jobs                      Search, status, and operational job views
/quotes                    Sales pipeline and quote workflows
/quotes/{quoteId}          Draft photo review and AI quote preparation
/invoices                  Billing and payment status
/expenses                  Operating costs, assets, refunds, and receipts
/finance                   Bank accounts, imported transactions, and reconciliation
/finance/import            Preview and import a bank statement
/finance/payments/new      Record or reconcile a customer payment
/finance/reconciliations/new Start a bank or credit-card statement reconciliation
/finance/reconciliations/{id} Prove statement, imported, and book balances
/finance/transactions/{id} Split, match, transfer, or exclude an imported row
/finance/adjustments/new   Record a balanced correcting or noncash entry
/finance/month-end         Monthly balances, close checklist, lock, and reopen
/finance/digital-assets    Exchange import, units, basis, sales, gains, and reconciliation
/finance/classification    Business-line classification workbench
/finance/capital           Contributions, loans, repayments, draws, and estimated taxes
/finance/business-settings Legal entity, public brand, and fictitious-name status
/finance/cleanup           Historical opening balances and cleanup workflow
/labor                    Labor and payroll entry/history
/equipment                 Assets and maintenance history
/equipment/{id}/financials Depreciation and equipment-loan assumptions
/imports/jobs              Spreadsheet preview and import
/reports                    Financial and operating reports/exports
/reports/books              P&L, balance sheet, cash flow, and trial balance
/reports/settings           Owner compensation and management targets
/help/financial-guide        Workflow, definitions, formulas, and field guidance
/api/v1/{resource}         Authenticated JSON records
/api/v1/{resource}?format=csv
/api/v1/reports/summary    Authenticated reporting summary
/api/v1/reports/tax-summary?year=2026&format=csv
/api/v1/reports/general-ledger?from=2026-01-01&to=2026-12-31&format=csv
/api/v1/reports/bookkeeping?from=2026-01-01&to=2026-12-31
/api/v1/reports/bookkeeping?statement=trial-balance&format=csv
```

External SMS/email sending, payment collection, electronic signatures, customer
portal access, PA 811 submission, municipality lookup, and travel-time services
remain intentionally deferred.

See [Management Reporting](docs/management-reporting.md) for definitions, the
monthly workflow, and the remaining accounting boundaries.
