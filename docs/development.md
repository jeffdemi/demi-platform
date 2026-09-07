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

The local stack needs an ARM64 Docker-compatible runtime on Apple Silicon and
Node from `.nvmrc`. Scripts use the pinned npm Supabase CLI 2.117.0 rather than a
possibly stale system binary. No production keys or Supabase login are needed.

```bash
npm run db:prepare   # inspect the isolated schema projection, no database access
npm run db:start     # starts only the dedicated local project
npm run db:reset     # destroys/replays that local database, no seed
npm run db:test      # pgTAP assertions as authenticated tenant users
npm run db:history   # local applied versions only
npm run db:stop      # stop local containers; retain local volumes
```

These commands reject additional arguments and use `.supabase-local` with project
ID `demi-platform-reliability-local`; reset/tests explicitly pass `--local`.
Never link or deploy that generated directory. Do not run multiple local Supabase
stacks on the same default ports. Stop the existing local stack before starting
this one. `db:stop` retains local data; `db:reset` discards it deliberately.

**Raw migration replay is currently not empty-database safe.** Seven historical
production data corrections require specific financial records. The local helper
uses checksum-reviewed data-only exceptions while retaining schema changes.
Read [Migration history](migration-history.md) for the inventory, exact limitation
and reconciliation procedure. Never run a blind linked push or `db reset --linked`.

Tests in `supabase/tests` create synthetic users, two businesses and representative
records inside transactions, switch to the `authenticated` role with user claims,
and roll everything back. No real data or secret keys are fixtures. `db:test`
does not prove Storage policies or complete accounting behavior. For interactive
local testing, use the local API URL/keys from startup and create disposable users
through local Auth/onboarding; use a separate local app environment, never copy
production credentials. There is deliberately no persistent production-data seed.

### Hosted branch or staging — optional, separately verified

Use an isolated Supabase branch/project with separate credentials and Auth URLs,
no production outbound integrations, and a Vercel preview scoped only to that
project. Prefer a sanitized representative restore when rehearsing an existing
production upgrade. New empty staging projects face the historical replay issue
above; do not silently mark those migrations applied.

The safe npm helpers intentionally cannot target hosted databases. For an approved
disposable hosted test target, verify its project ref and host independently,
review `supabase test db --help`, then use `--db-url` with credentials supplied from
a protected operator environment. Never pass production connection details or
paste connection strings into logs/shell history. The SQL tests require a privileged
fixture setup connection, but all permission assertions run as authenticated users.
Run each file with pgTAP through the CLI, inspect failures, and discard the test
project after verification. No staging project is provisioned by this repository.

### Local tooling diagnosis (2026-09-07)

This task found ARM64 host architecture with Intel-only `/usr/local/bin/supabase`
and `/usr/local/bin/docker`. The pinned npm CLI works; Docker invocation fails
with `EBADARCH`. Docker Desktop was absent from `/Applications`. No system binary
was replaced. Install/start an ARM64 Docker Desktop or equivalent approved local
runtime, verify `file`/`docker version` and a reachable local daemon, then rerun
`db:start`, `db:reset`, and `db:test`. Installing a CLI alone does not supply the
Docker engine. Database execution remains unverified until those commands pass.

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

The repository has 43 historical migrations plus the new hardening RPC migration.
Exact production version mappings are **Needs confirmation**. Old notes report
management-API timestamp differences but contain no authoritative remote version
export. See [Migration history](migration-history.md) for every local version,
read-only inspection SQL, evidence requirements, and the approval-gated repair
procedure. Keep applied files immutable; do not infer safety from a dry run alone.

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

`.github/workflows/ci.yml` runs on pull requests and pushes to `main`. The quality
job runs `npm ci`, tests, lint, typecheck, build and the production dependency audit.
The database job prepares/replays the isolated schema and runs pgTAP; any failure
fails that job. Both use `.nvmrc` and npm lockfile caching, with read-only GitHub
permissions. CI performs no deployment and uses no production secrets.

The build requires `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and optionally `NEXT_PUBLIC_SITE_URL`.
CI sets localhost URL values and a non-secret placeholder publishable key. No
Supabase service/secret key, OpenAI key or bank encryption key is needed for the
normal gate. Google Fonts and npm downloads require outbound network access.

Owner setup in GitHub: protect `main` with required pull requests/review, require
both `Required quality gate` and `Required database gate` status checks from
Platform CI, require branches to be current, and block force pushes/deletion.
Confirm the exact check names after the first run and limit bypass permissions.
No branch protection was changed by this task. Verify Vercel's external deployment
policy separately, especially schema-before-app ordering and preview credentials.
Use [Release checklist](release-checklist.md) and [Backup/recovery](backup-recovery.md).

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
