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
```

Only use a modern Supabase publishable key in browser-visible configuration. Never expose a secret or service-role key through a `NEXT_PUBLIC_` variable.

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

## Current Milestone

The foundation includes secure sign-in, session refresh, protected routing, owner workspace onboarding, a responsive operational dashboard, generated database types, and the initial Supabase migration. Business modules and verified migration of legacy SQLite records follow in later milestones.
