# Bridge Media architecture

## Principles

1. Keep one Next.js App Router repository and no separate backend service.
2. Render pages and fetch data in Server Components by default.
3. Use small Client Components only for browser interactions such as copying
   text, upload progress, drag/drop, and interactive calendar controls.
4. Put authenticated mutations in Server Actions. Use Route Handlers only where
   an HTTP boundary is necessary, initially the streaming AI endpoint.
5. Keep all database and storage access in `src/lib/supabase`; UI modules never
   instantiate Supabase clients directly.
6. Keep prompt construction, content rules, provider configuration, and AI
   result validation in `src/lib/ai`.
7. Enforce organization isolation with PostgreSQL row-level security (RLS), not
   with UI filters.
8. Treat generated copy as a draft. A person must review it before it becomes
   Ready, Scheduled, or Posted.

## Proposed repository structure

The scaffold phase will replace the unrelated legacy application with this
structure after this checkpoint is approved:

```text
bridge-media/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   ├── (workspace)/
│   │   │   ├── dashboard/
│   │   │   ├── campaigns/
│   │   │   │   └── [campaignId]/
│   │   │   │       ├── calendar/
│   │   │   │       └── content/
│   │   │   │           └── [contentId]/
│   │   │   └── layout.tsx
│   │   ├── api/ai/content/route.ts
│   │   ├── auth/callback/route.ts
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── campaign/
│   │   ├── content/
│   │   └── ui/                 # shadcn/ui primitives
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── guidelines.ts
│   │   │   ├── prompts.ts
│   │   │   └── generate-content.ts
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   ├── server.ts
│   │   │   ├── proxy.ts
│   │   │   └── repositories/
│   │   ├── actions/
│   │   └── validation/
│   ├── types/database.ts       # generated from the SQL schema
│   └── proxy.ts
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/
├── public/
└── package.json
```

Route groups keep authentication and workspace layouts separate without adding
segments to URLs. Feature-specific components stay near their domain; reusable
shadcn/ui primitives stay in `components/ui`.

## Request and data flow

```text
Server Component
  -> typed repository
    -> request-scoped Supabase server client
      -> PostgreSQL constraints + RLS

Client interaction
  -> validated Server Action
    -> typed repository
      -> Supabase PostgreSQL or private Storage
    -> revalidate affected route

AI draft panel
  -> authenticated streaming Route Handler
    -> lib/ai prompt + campaign context + output validation
      -> Vercel AI SDK -> OpenAI
  -> reviewed draft saved through a Server Action
```

The browser Supabase client is limited to interactions that truly need it. V1
uploads may use signed upload URLs so large media does not pass through the
Next.js server. The database stores only the private bucket path and metadata;
views use short-lived signed URLs.

## Authentication and tenancy

Supabase Auth owns credentials. `profiles.id` matches `auth.users.id` and stores
display data only. `organization_memberships` connects a profile to one or more
organizations with a small V1 role set (`admin`, `member`). All campaign data is
reachable from an organization and protected by membership-aware RLS policies.

Server Actions must still validate input and check intended permissions, but RLS
is the final access boundary. The server-only Supabase secret key is reserved for
controlled operational tasks and is not used for ordinary application requests.

## Content model decisions

- A `content_item` is the shared idea and workflow record.
- A `content_platform` is the platform-specific copy and schedule. This permits
  genuinely different Facebook, Instagram, and community-group variants rather
  than hiding variants in JSON.
- V1 keeps one current assignee per content item. The `assignments` table makes
  that relationship explicit without introducing task-management features.
- Media belongs to one content item in V1. Reuse and asset libraries can be
  revisited only if a real need appears.
- Results are manual, timestamped snapshots for a platform variant. This keeps
  the history of entered metrics without pretending to provide live analytics.

## AI guardrails

Every generation request supplies the campaign facts and these durable rules:

- write primarily for people who do not regularly attend church;
- avoid Christian jargon and corporate-advertising language;
- use natural, conversational invitations and welcome honest questions;
- never assume that the reader already believes Christianity;
- stay consistent with historic evangelical Christianity without weakening its
  claims for engagement; and
- prefer authentic testimony and personal invitation over marketing copy.

Generated output is untrusted input: validate its shape and length, display it as
a suggestion, and require a user to choose whether to save it. Do not send user
credentials, private media, or unnecessary profile data to the model.

## Explicit V1 boundaries

- No Meta/Facebook/Instagram publishing APIs; users copy approved variants and
  post them manually.
- No automatic results ingestion.
- No multi-stage approval engine, comments, notifications, social inbox, or CRM.
- No background worker or separate API service.
- No organization billing or self-service organization creation.
