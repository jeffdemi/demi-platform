# Development Guide

This guide is the practical handoff for changing Demi Platform safely. Read the
[README](../README.md), [Architecture](architecture.md), and
[Bookkeeping model](bookkeeping-model.md) before modifying financial behavior.

## Prerequisites

- Node.js 22 or newer (`.nvmrc` is authoritative)
- npm
- Git
- A Supabase project for application data and Auth
- Docker Desktop or Podman when running Supabase locally
- A Vercel project only when deploying

Install dependencies:

```bash
nvm use
npm install
```

Copy `.env.example` to `.env.local`. Do not commit `.env.local` or print its
contents in logs.

## Choose a database mode deliberately

### Local Supabase — preferred for schema work

The local stack requires a Docker-compatible container runtime:

```bash
npx supabase start
npx supabase db reset --no-seed
```

The reset command destroys only the selected local database and reapplies every
migration. Never run `db reset --linked`, and never use production as a scratch
database. `supabase/config.toml` currently names `supabase/seed.sql`, but that
file is absent and the repository does not ship production business data. Use
`--no-seed`; onboarding creates the first owner workspace.

Use the local API URL and keys printed by `supabase start` in `.env.local`.

### Hosted branch or staging — acceptable alternative

When local containers are unavailable, use a separate Supabase branch or staging
project. Apply migrations there, create test users, exercise RLS as an
authenticated caller, and discard the environment when finished.

### Production — diagnostics and approved operations only

Connecting the app to the hosted production project mutates live business and
bookkeeping data. Use that mode only for an owner-authorized diagnostic,
bookkeeping operation, or release. Never use production to develop destructive
workflows or test migrations.

## Repository map

```text
src/app/                       Next.js App Router pages, layouts, actions, APIs
src/components/                Reusable UI and forms
src/lib/auth.ts                Membership and role authorization
src/lib/validation/            Zod schemas for untrusted input
src/lib/repositories/          Reusable request-scoped Supabase I/O
src/lib/services/              Multi-step workflows, uploads, PDFs, external APIs
src/lib/domain/                Pure accounting, import, reporting, and display logic
src/lib/supabase/              Browser, server, proxy, and privileged clients
src/types/database.ts          Application-facing Supabase schema types
supabase/migrations/           Ordered, additive database history
scripts/                       Legacy migration tooling
docs/                          Architecture, operations, accounting, and handoff docs
```

Page-specific Server Actions and form components usually live beside their
route. Shared database queries belong in repositories; shared business logic
does not belong in page files.

## Before editing Next.js code

This is Next.js 16, not a legacy Pages Router application. Before writing code,
read the relevant guide under `node_modules/next/dist/docs/` and follow current
deprecation guidance. In particular, verify current behavior for App Router,
Server Actions, caching/revalidation, Route Handlers, cookies, and proxy/session
refresh instead of relying on older examples.

## Request and data flow

1. A Server Component loads a signed-in business context.
2. A form submits to a Server Action or a request hits a Route Handler.
3. Zod validates the untrusted payload.
4. The action rechecks membership and any owner/admin requirement.
5. A repository or service calls Supabase with the request-scoped user client.
6. RLS enforces the same tenant boundary independently.
7. Constraints, triggers, or RPCs enforce atomic cross-row invariants.
8. The action revalidates affected paths and redirects or returns field-safe
   state so a recoverable error does not erase user input.

`src/lib/supabase/admin.ts` is exceptional. It is for narrow privileged flows
such as owner-initiated team invitations and legacy import support, not normal
application CRUD.

## Database change workflow

All schema changes must be additive. Never edit a migration that has been
applied to any shared environment.

1. Create a timestamped SQL migration under `supabase/migrations`.
2. Add constraints and tenant-safe composite relationships.
3. Enable RLS on every exposed table and write business-membership policies.
4. Add explicit `GRANT` statements for Data API roles. New Supabase tables are
   no longer automatically exposed, and grants and RLS solve different layers.
5. Restrict function execution deliberately. Prefer security-invoker functions;
   keep unavoidable privileged helpers in the unexposed `private` schema and
   expose only safe wrappers.
6. Add indexes for foreign keys, tenant/date filters, status queues, and policy
   lookups.
7. Apply from scratch locally or in staging, then test permitted and denied
   calls as authenticated users from different businesses.
8. Update `src/types/database.ts`, repositories, domain logic, and tests.
9. Inspect Supabase security and performance advisors.

### Existing production migration-history caveat

As of 2026-08-16, the 35 local migration names all exist in production, but
several production history version timestamps differ from their local filenames.
Earlier releases were applied through the Supabase management API, which recorded
the migration name under the time it was applied. The Supabase CLI compares
version timestamps, not SQL contents or migration names.

Consequences:

- do not run a linked `supabase db push` without inspecting migration history;
- use `npx supabase migration list` and `npx supabase db push --dry-run` first;
- rehearse any history reconciliation on a branch/staging project;
- do not use `migration repair` casually—repair changes history state, not the
  database schema;
- obtain explicit owner approval before any production migration, push, or
  deployment.

The safe long-term fix is a reviewed, one-time alignment of local filenames and
remote migration history, followed by CLI-based versioned releases.

## Financial change checklist

Any change touching money should answer all of these questions:

- What is the source of truth: payment, expense, bank row, journal, labor entry,
  owner transaction, or digital-asset transaction?
- Is the amount's sign stored or derived consistently?
- Can the same economic event be imported or entered twice?
- Does the write create or revise a balanced journal exactly once?
- Is a transfer being kept out of revenue and expense?
- Is owner activity kept out of operating profit?
- Does business-line classification propagate to the posted ledger?
- What happens in a closed period?
- Is history superseded or audited instead of overwritten?
- Does the report use actual receipts rather than quotes or stale status fields?

Add a regression test for every financial bug. Prefer pure tests for formulas and
parsers plus database/RLS verification for transactional behavior.

## Verification

Run the complete application gate:

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm audit --omit=dev
```

For a schema release also verify:

- all migrations apply from an empty disposable database;
- migrations upgrade a representative existing database without deletion;
- allowed authenticated operations work;
- cross-business and insufficient-role operations fail;
- storage policies protect private receipt and quote-photo objects;
- Supabase security and performance advisors have no unexplained regressions;
- bank/exchange re-imports remain idempotent;
- journal entries balance and closed-period guards work.

## Release checklist

1. Confirm the intended branch, target Supabase project, and target Vercel
   project. Do not infer them from a remembered prior release.
2. Review `git status`, `git diff`, and the migration list; preserve unrelated
   worktree changes.
3. Commit a clean checkpoint before beginning a separate release.
4. Run tests, lint, typecheck, build, and relevant browser workflows.
5. Apply additive database migrations before application code that reads the new
   schema, but only after explicit production approval.
6. Re-run the key production read/write workflow with the owner and inspect logs.
7. Deploy only after explicit approval. Record the migration and code commit in
   the release handoff.

There is no checked-in CI workflow or Vercel project link. GitHub and Vercel may
still be configured externally, so verify them rather than assuming a push will
deploy.

## Common pitfalls

- A local `npx supabase start` failure saying Docker/Podman is missing means the
  CLI is installed but its container runtime is not.
- A Supabase permission error can be a missing table grant, RLS policy, function
  execute grant, or helper-function privilege; inspect the exact layer.
- Updating only a source record can leave its journal or review status stale.
  Follow the existing posting/revision path instead of bypassing it.
- Directly entered expenses do not create fake bank transactions. They appear in
  Finance as awaiting a bank match or, for documented owner-funded/cash items, as
  no statement match required.
- A receipt proves the purchase; it does not transform a personal-funded expense
  into a business-bank transaction.
- Never classify customer revenue as COGS. COGS is the direct non-labor cost of
  delivering the work.
