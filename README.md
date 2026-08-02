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

## Current Milestone

The foundation includes secure sign-in, password recovery, invite-only account creation, session refresh, protected routing, owner workspace onboarding, a responsive operational dashboard, generated database types, transactional legacy import support, and additive Supabase migrations. Business module screens follow in later milestones.
