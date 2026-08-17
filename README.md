# Demi Platform

Demi Platform is the private operating and bookkeeping system for Demi Solutions
LLC. It combines customer and job management, quotes and invoices, expense and
receipt records, equipment maintenance, bank-statement reconciliation,
double-entry bookkeeping, management reporting, and a digital-asset subledger in
one tenant-scoped application.

The application is in active production use. It is intentionally owner-operated:
it helps prepare clean records and exports, but it is not a bank feed, payroll
processor, tax-filing service, or replacement for accountant review.

## Read this first

The repository documentation is the handoff contract:

- [Development guide](docs/development.md) — setup, repository map, conventions,
  database workflow, verification, and release checklist
- [Architecture](docs/architecture.md) — trust boundaries, tenancy, data flow,
  journals, imports, and reporting design
- [Bookkeeping model](docs/bookkeeping-model.md) — entity facts, accounting
  source-of-truth rules, owner activity, business lines, and month-end workflow
- [Current project status](docs/project-status.md) — production state, known
  limitations, open bookkeeping work, and recommended next development
- [Operations reference](docs/operations.md) — user workflows for quotes,
  expenses, reconciliation, payments, close, imports, and exports
- [Authentication](docs/authentication.md) — owner bootstrap, invitations, Auth,
  SMTP, and production configuration
- [Management reporting](docs/management-reporting.md) — Crabtree-inspired
  metrics and their accounting boundaries
- [Quote AI workbench](docs/quote-ai-workbench.md) — private photo workflow,
  assistant behavior, and operator approval
- [Legacy migration](docs/legacy-migration.md) — repeatable SQLite import
- [Changelog](CHANGELOG.md) — feature history

Before changing Next.js code, read the relevant guide under
`node_modules/next/dist/docs/`. This repository uses Next.js 16 and its APIs and
conventions may differ from older Next.js examples.

## Technology

- Next.js 16 App Router, React 19, and TypeScript
- Tailwind CSS 4
- Supabase PostgreSQL 17, Auth, private Storage, RLS, and PostgreSQL RPCs
- OpenAI Responses API for draft quote analysis
- Vercel deployment target
- Vitest and ESLint
- `pdf-lib` for quote and invoice PDFs
- `read-excel-file` for validated spreadsheet imports

Node.js 22 or newer is required. The pinned version is in `.nvmrc`.

## Quick start

```bash
nvm use
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Required environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
OPENAI_QUOTE_MODEL=gpt-5.6-terra
```

`SUPABASE_SECRET_KEY`, `OPENAI_API_KEY`, and any equivalent secret must remain
server-only. Never expose one through a `NEXT_PUBLIC_` variable. Normal
application access uses the signed-in user's request-scoped Supabase client and
RLS; the secret key is limited to privileged owner workflows described in the
development and authentication guides.

For a disposable local database, install Docker Desktop or Podman and use the
Supabase CLI workflow in [Development](docs/development.md). Do not point routine
development at production. The repository currently has migration-history
timestamps that require review before any linked `supabase db push`.

## Product map

The main authenticated areas are:

| Area | Purpose |
| --- | --- |
| Dashboard | Daily operations and financial summary |
| Customers, jobs, quotes, invoices | Sales and service workflow from lead through payment |
| Expenses | Purchases, assets, refunds, receipts, review, edit, archive, and controlled deletion |
| Finance | Bank/card/Venmo import, matching, rules, classification, transfers, adjustments, reconciliation, and close |
| Books | Ledger-based P&L, balance sheet, cash flow, and trial balance |
| Crypto | Exchange CSV import, units, fees, transfers, reconciliations, and provisional FIFO views |
| Business lines | Federal IT Contracting, Demi Stump Grinding, and consolidated reporting |
| Owner | Contributions, loans, repayments, draws, and estimated taxes |
| Labor and reports | Labor detail, management normalization, scorecards, tax and ledger exports |
| Equipment | Assets, financial assumptions, hours, and maintenance history |
| Team | Invite-only role and membership administration |

Important routes:

```text
/dashboard
/customers
/jobs
/quotes
/invoices
/expenses
/finance
/finance/import
/finance/matching
/finance/suggestions
/finance/transactions/{transactionId}
/finance/reconciliations/{reconciliationId}
/finance/adjustments/new
/finance/month-end
/finance/digital-assets
/finance/classification
/finance/capital
/finance/business-settings
/finance/cleanup
/labor
/equipment
/reports
/reports/books
/reports/settings
/imports/jobs
/account/team
/help/financial-guide
/api/v1/{resource}
/api/v1/reports/{report}
```

## Architectural rules

The shortest useful mental model is:

```text
page or route
  -> validated Server Action / handler
    -> repository or service
      -> request-scoped Supabase client
        -> RLS + constraints + transactional RPC/trigger
```

These rules are non-negotiable:

1. Every operational row belongs to a business; never rely on a UI filter for
   tenant isolation.
2. Server Actions are thin: validate input, authorize, call a repository or
   service, then revalidate or redirect.
3. Repositories own reusable Supabase I/O. Services own multi-step workflows,
   private uploads, PDFs, and external APIs. Domain modules stay pure.
4. Cross-record accounting invariants belong in additive PostgreSQL migrations
   and atomic functions or triggers.
5. Ledger history is append/revision based. Do not directly edit or delete
   posted journal rows.
6. Payments are cash revenue. Quoted amounts are never revenue.
7. Expense source amounts remain positive; reporting logic gives refunds their
   negative effect.
8. Bank and exchange imports must remain preview-first and idempotent by file
   hash and normalized row fingerprint.
9. Closed accounting periods reject source-dated changes until an owner/admin
   reopens the month with a reason.
10. Schema changes are additive, RLS-protected, explicitly granted to Data API
    roles when required, and accompanied by updated TypeScript database types
    and tests.

See [Architecture](docs/architecture.md) for the full boundaries and
[Bookkeeping model](docs/bookkeeping-model.md) for the financial meaning behind
them.

## Database and migrations

Schema is versioned in `supabase/migrations`. As of 2026-08-16, all 36 migration
names in this repository are present in production. Some production migration
history timestamps differ from the local filenames because earlier changes were
applied through the Supabase management API. Since the CLI compares migration
versions, do not run a linked push blindly.

For every database change:

1. Add a new migration; never rewrite an applied migration.
2. Add explicit grants, RLS policies, constraints, indexes, and safe function
   privileges.
3. Test from an authenticated tenant perspective, not only as database owner.
4. Update `src/types/database.ts` and affected repositories/tests.
5. Compare local and remote migration history, preview on a local or staging
   database, and obtain explicit production approval before applying.

The detailed commands and the existing migration-history caveat are in
[Development](docs/development.md).

## Verification

Run the full gate before handing off a change:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

Database changes also require migration/RLS testing in a disposable environment.
Documentation-only changes should still pass Markdown link checks and at least
the application test, lint, typecheck, and build gates when practical.

## Security and account setup

The first workspace bootstrap is restricted to the configured owner email. Once
a business exists, account creation is invite-only. Membership roles are
`owner`, `admin`, and `employee`; RLS independently enforces membership on every
public business table. Private receipts and quote photos are opened with
short-lived signed URLs.

After initial setup, disable public signup and configure Supabase Auth URLs,
SMTP, password policy, and Vercel environment variables as described in
[Authentication](docs/authentication.md).

## Known boundaries

- Direct bank feeds, payment collection, payroll processing, tax filing,
  electronic signatures, and a customer portal are not implemented.
- Bookkeeping is cash-focused with a balanced ledger, but it is not a complete
  GAAP accrual system with payroll, inventory, A/R, and A/P subledgers.
- Digital-asset rows and reconciliations are stored, but tax-lot persistence,
  unmatched-basis handling, and automatic general-ledger posting are not yet
  complete. Treat the current FIFO display as provisional.
- The Labor page records paid employee/contractor labor. For the current default
  single-member LLC treatment, owner draws are equity activity, not wages or
  expenses; owner market compensation is a management-reporting normalization.
- The repository does not contain deployment automation or a checked-in Vercel
  project link. Confirm the target project and environment outside Git before
  deploying.

The dated and prioritized list is maintained in
[Current project status](docs/project-status.md).
