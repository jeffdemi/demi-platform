# Bridge Media

Bridge Media is a small social-media campaign manager for the Bridge Course at
Valley Creek Church in Malvern, Pennsylvania. V1 supports planning, drafting,
assigning, and manually posting Facebook and Instagram content. It intentionally
does **not** publish through Meta APIs.

This repository is currently at the **architecture checkpoint**. The proposed
structure, schema, and phased implementation plan are documented for review
before feature implementation begins.

## Product scope

The initial campaign is **Bridge Fall 2026**, beginning September 9, 2026. Its
message invites people who have questions, doubts, skepticism, or negative
experiences with church to explore Christianity through a free 10-week course
with dinner and childcare.

V1 is limited to:

- a dashboard, campaign calendar, and content queue;
- the statuses Idea, Draft, Ready, Scheduled, and Posted;
- Facebook, Instagram, and local Facebook community-group variants;
- ownership, private image/video uploads, and manual copy-to-clipboard posting;
- AI-assisted drafts that follow the campaign voice guidelines; and
- manual tracking of views, shares, clicks, and registrations.

## Architecture checkpoint

- [Architecture and proposed repository structure](docs/architecture.md)
- [Proposed PostgreSQL schema and access model](docs/database-schema.md)
- [Small-phase implementation plan](docs/implementation-plan.md)

No V1 workflow is considered approved for implementation until these three
documents have been reviewed. In particular, this checkpoint does not add Meta
publishing, analytics ingestion, approvals, notifications, or other speculative
features.

## Planned technology

- Next.js 16.3 App Router, React, and TypeScript
- Tailwind CSS and shadcn/ui
- Supabase PostgreSQL, Auth, and private Storage
- Vercel AI SDK with OpenAI
- Vercel deployment and GitHub source control

The application will use Server Components by default. Server Actions will
handle authenticated mutations, while Route Handlers will be reserved for
streaming AI responses or integrations that require HTTP endpoints. Supabase
and AI code will live behind dedicated `src/lib/supabase` and `src/lib/ai`
boundaries.

## Planned local setup

The commands below describe the intended setup after the scaffold phase is
approved and completed:

```bash
nvm use
npm install
cp .env.example .env.local
npx supabase start
npx supabase db reset
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

Planned environment variables:

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=
```

Only the first two values may be exposed to the browser. The Supabase secret key
and OpenAI key must remain server-only. Normal application reads and writes will
use the signed-in user's request-scoped Supabase client so PostgreSQL row-level
security remains the authorization boundary.

## Planned verification

Each implementation phase must keep these checks green:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Database phases will also test migrations and row-level-security policies against
a disposable local Supabase instance.
