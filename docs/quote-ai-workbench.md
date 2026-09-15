# Quote AI Workbench

## Workflow

A new quote is a single route with two steps, `/quotes/[quoteId]?step=1|2`, driven
by the `step` query param so back/forward/refresh work normally. Every write on
either step saves straight to Supabase — nothing lives only in component state.
Uploading, analyzing, chatting, or applying a recommendation never marks the quote
sent; the existing sales action remains the only delivery-status control.

**Step 1 — Prepare** (`/quotes/new` creates the draft, then `?step=1`):

1. Enter customer, address, scope, special instructions, and other quote details.
   Optionally check "Save this to my knowledge base" to turn the special
   instructions into a standing `quote_knowledge` entry.
2. Upload up to twelve site photos.
3. Confirm that the prepared photos and minimized quote context may be analyzed.
4. Review observations, missing-information questions, assumptions, risk flags,
   price range, recommended price, scope, and customer wording.
5. Answer follow-up questions in the persistent quote conversation — as many
   rounds as needed, each producing a revised recommendation.
6. Optionally apply the current scope and recommended price to the draft.
7. Continue to step 2.

**Step 2 — Quote** (`?step=2`):

1. Review the read-only summary of everything collected in step 1.
2. Review the latest AI estimate (price, range, confidence, observations).
3. Set the final price — a separate field from the AI's estimate, defaulting to
   it as a starting point when nothing has been entered yet, but never
   overwritten automatically in either direction.
4. Review the normal customer message/PDF and mark the quote sent from here.

A quote that is no longer a draft (sent, accepted, etc.) shows the permanent,
read-only quote record instead of the stepped flow.

## Knowledge Base

`/quotes/knowledge` is a simple CRUD list (title, body, tags, timestamps) of
Jeff's standing pricing notes and rules of thumb. Every entry is injected into
every AI estimate request via the `knowledgeBase` context field, and the
assistant is instructed to apply them the way Jeff would. Entries can be added
directly from the knowledge base page or from step 1's "save to knowledge base"
checkbox, which also records the originating `source_quote_id`.

## Photo Storage

JPEG, PNG, WebP, HEIC, and HEIF photos are resized to a maximum 2,000-pixel edge,
converted to JPEG, and stripped of embedded metadata in the browser before upload.
Each prepared image is limited to six MB. Files are stored in the private
`quote-photos` Supabase bucket under:

The browser tries native decoding first. HEIC/HEIF files that cannot be decoded
natively use a pinned, CSP-safe client-side decoder before the same resize and
metadata-removal pipeline.

```text
{business_id}/{quote_id}/{random_uuid}.jpg
```

Storage policies require an authenticated business member and an existing draft
quote matching the first two path segments. Database metadata is stored in
`quote_photos`. The application uses short-lived signed URLs for display and AI
analysis; there are no public photo URLs.

## AI Data Boundary

The server sends OpenAI only:

- Customer-facing scope and special instructions (distinct from internal notes)
- General property-location category
- Current price when one has been entered, plus pro-bono and PA 811 fields
- Prepared site photos selected by the operator
- Anonymized comparable-job amounts, durations, and same-location indicators
- The business's knowledge base entries (title, body, tags)
- Messages entered into the quote AI conversation

The request excludes customer identity, phone, email, exact service address,
location description, internal notes, hazard notes, job IDs, and raw comparable
job descriptions. API responses use `store: false`. The API key remains in the
server-only `OPENAI_API_KEY` environment variable.

## Estimating Rules

The assistant is advisory. It must identify uncertainty and ask questions rather
than infer exact stump dimensions, access clearance, underground utilities,
grinding depth, or cleanup requirements from ambiguous photos. Comparable jobs
are supporting evidence rather than a pricing formula. Only the operator can
apply a recommendation, mark a quote sent, or convert an accepted quote to a job.

## Schema

```text
quote_photos
quote_ai_threads
quote_ai_messages
quote_ai_recommendations
quote_knowledge
storage bucket: quote-photos
```

Recommendation rows preserve the model, prompt version, structured result,
response identifier, creator, timestamp, and whether/when the result was applied.
`quote_knowledge` rows are business-wide standing notes, optionally linked back
to the quote they originated from via `source_quote_id`.

## Configuration

```text
OPENAI_API_KEY=
OPENAI_QUOTE_MODEL=gpt-5.6-terra
```

Apply `supabase/migrations/20260808120000_quote_ai_workbench.sql`,
`supabase/migrations/20260915120000_remove_quote_job_municipality.sql`, and
`supabase/migrations/20260915120100_quote_knowledge_base.sql` before running
application code that reads the workbench tables.
