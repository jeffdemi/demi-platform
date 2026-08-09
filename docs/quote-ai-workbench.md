# Quote AI Workbench

## Workflow

New quotes are always created as `draft`, and the quoted price may be left blank.
Saving a new quote opens its detail page, where the operator can attach site photos
and prepare the price and scope. Uploading,
analyzing, chatting, or applying a recommendation never marks the quote sent.
The existing sales action remains the only delivery-status control.

The preparation flow is:

1. Save the quote draft without entering a price when the estimate is not ready.
2. Upload up to twelve site photos.
3. Confirm that the prepared photos and minimized quote context may be analyzed.
4. Review observations, missing-information questions, assumptions, risk flags,
   price range, recommended price, scope, and customer wording.
5. Answer follow-up questions in the persistent quote conversation.
6. Apply the current scope and recommended price to the draft deliberately.
7. Review the normal customer message/PDF and mark the quote sent separately.

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

- Customer-facing scope
- Municipality and general property-location category
- Current price when one has been entered, plus pro-bono and PA 811 fields
- Prepared site photos selected by the operator
- Anonymized comparable-job amounts, durations, and same-location indicators
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
storage bucket: quote-photos
```

Recommendation rows preserve the model, prompt version, structured result,
response identifier, creator, timestamp, and whether/when the result was applied.

## Configuration

```text
OPENAI_API_KEY=
OPENAI_QUOTE_MODEL=gpt-5.6-terra
```

Apply `supabase/migrations/20260808120000_quote_ai_workbench.sql` before running
application code that reads the workbench tables.
