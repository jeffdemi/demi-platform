# Bridge Media implementation plan

Keep every phase reviewable and deployable. Do not begin Phase 1 until the
architecture checkpoint (Phase 0) is approved.

## Phase 0 — architecture checkpoint (this change)

- Define the V1 boundary and proposed repository structure.
- Propose the relational schema, storage layout, tenant model, and RLS approach.
- Record local setup, security rules, and the implementation sequence.
- Stop for review before replacing the existing scaffold or building features.

**Exit:** product owner approves or amends the structure, schema, and phases.

## Phase 1 — clean scaffold

- Replace the unrelated legacy application code with the approved Bridge Media
  Next.js 16.3 App Router scaffold.
- Configure TypeScript, Tailwind CSS, shadcn/ui, ESLint, Vitest, and environment
  validation.
- Add the route groups and empty authenticated shell from the proposed tree.
- Install only the approved runtime dependencies, including Supabase and the
  Vercel AI SDK.

**Exit:** a branded shell runs locally and lint, typecheck, tests, and production
build pass. No campaign workflow is implemented.

## Phase 2 — database, Auth, and tenancy

- Convert the approved schema into one reviewable Supabase migration.
- Add constraints, indexes, grants, RLS policies, private Storage policies, and
  seed data for Valley Creek Church / Bridge Fall 2026.
- Add server, browser, and proxy Supabase clients in `src/lib/supabase`.
- Generate `src/types/database.ts`; do not hand-maintain schema types.
- Implement login, callback, protected workspace layout, and admin/member access.
- Test unauthenticated and cross-organization denial paths.

**Exit:** a seeded member can sign in and read only their organization; RLS tests
pass in disposable local Supabase.

## Phase 3 — campaign content queue

- Add the campaign summary and content queue Server Components.
- Add small validated Server Actions for creating/editing a content item,
  changing its status, assigning it, and maintaining platform variants.
- Support Idea, Draft, Ready, Scheduled, and Posted filters.
- Keep forms simple and use shadcn/ui primitives without a custom design system.

**Exit:** the Bridge team can manage a content item and its Facebook, Instagram,
and community-group copy from idea through posted state.

## Phase 4 — calendar and manual posting

- Add a campaign calendar backed by `content_platforms.scheduled_for`.
- Add the smallest Client Component needed to copy a variant body to clipboard.
- Allow a user to record `posted_at` and an optional external post URL.
- Do not call Meta APIs or imply that Scheduled means automatic publishing.

**Exit:** users can schedule internally, copy text, post manually, and record the
post without leaving ambiguous publishing state.

## Phase 5 — private media

- Add validated image/video uploads to the private `campaign-media` bucket.
- Use signed upload/view URLs, file type and size limits, safe paths, and deletion
  authorization.
- Add alt text and show attached media on content details.

**Exit:** organization members can access their own campaign media, while
cross-tenant and unauthenticated access tests fail closed.

## Phase 6 — AI-assisted drafting

- Implement durable guidance and prompt construction in `src/lib/ai`.
- Add an authenticated streaming endpoint using Vercel AI SDK and OpenAI.
- Generate optional platform variants from the campaign facts and user brief.
- Validate model output and require explicit user review/save; retain no hidden
  auto-publish or auto-approval path.

**Exit:** a user can request, review, edit, and deliberately save a conversational
draft that follows the documented theological and audience guidance.

## Phase 7 — dashboard and results

- Add manual cumulative metric snapshots for views, shares, clicks,
  registrations.
- Build a compact dashboard of queue counts, upcoming scheduled variants, recent
  posts, and latest results.
- Verify responsive and accessible behavior; document Vercel deployment and
  environment configuration.

**Exit:** V1's ten requested capabilities work end to end, all checks pass, and
the explicit boundaries remain intact.

## Deferred until evidence justifies them

Meta publishing and analytics APIs, approvals, comments, notifications, a social
inbox, reusable asset libraries, campaign templates, organization billing, and
advanced analytics are not hidden backlog requirements for V1. Each requires a
separate product decision.
