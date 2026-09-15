# Demi Platform — Workflow Improvement Tickets

Grounded in the actual code (paths/line refs below are current as of the `add-transactions-nav` branch, commit `c57ac62e`).

---

## TICKET 1 — Reorder left nav: Jobs before Invoices

**Priority:** Low effort / do first
**File:** `src/components/app-shell.tsx` (lines 23–37)

**Problem**
Nav order is Dashboard → Customers → Quotes → **Invoices → Jobs** → Expenses → ... Invoices comes before Jobs even though every invoice depends on a job existing first.

**Fix**
Swap the two array entries so the order reads Quotes → Jobs → Invoices, matching the actual lifecycle (quote → job → invoice).

**Acceptance criteria**
- Nav renders Jobs before Invoices on both desktop (sidebar) and mobile (top scroll bar), since both read from the same `navigation` array.

---

## TICKET 2 — New job should pull from an existing quote

**Priority:** High
**Files:** `src/app/(app)/jobs/new/page.tsx`, `src/app/(app)/jobs/job-form.tsx`, `src/app/(app)/jobs/actions.ts`, `src/app/(app)/quotes/actions.ts` (`convertQuoteToJob`), `supabase/migrations/20260804001500_full_feature_parity.sql` (`convert_quote_to_job` function)

**Problem**
Today there are two disconnected paths into a job:

1. "Convert to job" button on the quote detail page (`quotes/status-actions.tsx`) — calls the `convert_quote_to_job` Postgres RPC, which copies `service_address`, `property_location`, `location_description`, `referral_source`, `customer_scope → work_description`, `hazard_notes`, `quoted_price → amount_quoted`, `pro_bono`, `pa811_required`, `acceptance_notes → notes`. Only usable when quote status is `accepted`, and it locks the quote afterward.
2. "Add job" from the Jobs list or from a customer's page (`customers/[customerId]/page.tsx` line 25) — opens a completely blank `JobForm` with no `quoteId` awareness at all, even if that exact customer has an accepted quote sitting there.

So unless you remember to start from the quote's own page, you retype everything by hand.

**Fix**
Give `/jobs/new` the same query-param prefill pattern `/invoices/new` already uses for jobs (`invoices/new/page.tsx` — accepts `?jobId=` and prefills customer + amount):
- Accept `?quoteId=` on `/jobs/new`.
- When present, look up the quote (`getQuoteForEdit`) and pass its fields into `JobForm` as defaults, same fields the RPC currently copies, *plus* let the user still edit/save through the normal `saveJob` action (no need for a separate RPC path for this entry point).
- Add a quote picker to the plain `/jobs/new` form: if the selected customer has open/accepted quotes, show a "Start from quote" dropdown that re-navigates to `/jobs/new?quoteId=X`.
- On the customer detail page, only show "Add job" as the primary action when there's no eligible quote; when there is, surface it (see Ticket 5) so the natural click-through is quote → job, not a second blank form.

**Acceptance criteria**
- Starting a job from a quote (either via "Convert to job" or via `/jobs/new?quoteId=X`) pre-populates address, scope, price, hazard notes, PA811, and referral source without retyping.
- Starting a job with no quote still works exactly as it does today.

---

## TICKET 3 — Convert-to-job should carry schedule info and land on Edit

**Priority:** Medium
**Files:** `supabase/migrations/20260804001500_full_feature_parity.sql` (`convert_quote_to_job`), `src/app/(app)/quotes/actions.ts` (`convertQuoteToJob`)

**Problem**
The `convert_quote_to_job` insert never sets `job_date`, `scheduled_date`, `scheduled_start_time`, or `estimated_duration_minutes` — every converted job lands with zero schedule info. `convertQuoteToJob` then redirects to `/jobs/${jobId}` (the read-only detail page), so setting a date requires a second, unprompted trip into Edit.

**Fix**
Either:
- (a) Redirect straight to `/jobs/${jobId}/edit` after conversion so the schedule fields are the first thing you see, or
- (b) Add a small "When is this scheduled?" prompt as part of the convert action itself (date + start time), submitted in the same step.

(a) is the smaller change and pairs well with Ticket 4 below.

**Acceptance criteria**
- After clicking "Convert to job," Jeff is not required to separately click "Edit job" just to set a date.

---

## TICKET 4 — Stop double-asking for a job date

**Priority:** Medium
**Files:** `src/app/(app)/jobs/job-form.tsx` (lines 46–47), `src/lib/domain/jobs.ts`, `src/app/(app)/jobs/page.tsx`, `src/app/(app)/jobs/[jobId]/page.tsx`, `src/app/(app)/customers/[customerId]/page.tsx`

**Problem**
`job-form.tsx` puts "Job date" (defaults to today via `dateInTimeZone`) and "Scheduled date" (blank) side by side with no explanation of the difference. Nothing in the DB schema or validation layer (`lib/validation/operations.ts`) distinguishes their purpose. Every place the app *displays* a job date already treats them as one value with a fallback — `jobs/page.tsx`, `jobs/[jobId]/page.tsx`, and `customers/[customerId]/page.tsx` all render `job.scheduled_date || job.job_date`. So the UI itself only ever shows one date, but the create form asks for two.

**Fix**
- Stop defaulting "Job date" to today on the new-job form.
- For new jobs going forward, treat "Scheduled date" as the single field you fill in; keep "Job date" in the form but relabel/reposition it as a completed/imported-job field only (it's already used that way by the legacy import path in `supabase/migrations/20260802020758_legacy_import_support.sql`).
- Optional: when a job's status moves to `completed`, auto-copy `scheduled_date` into `job_date` if `job_date` is still empty, so historical reporting keeps working without asking Jeff to fill both.

**Acceptance criteria**
- Creating a new job asks for one date up front (Scheduled date).
- Existing imported/completed jobs that rely on `job_date` are unaffected.

---

## TICKET 5 — Show a customer's open quotes on their detail page

**Priority:** Low / nice-to-have
**File:** `src/app/(app)/customers/[customerId]/page.tsx`

**Problem**
The customer page shows Jobs and Invoice history but never Quotes. There's no visual cue that a customer already has an accepted, unconverted quote before clicking "Add job" and starting from scratch.

**Fix**
Add a "Quotes" section (same pattern as the existing Jobs/Invoices sections), and when there's an accepted-but-unconverted quote, make the primary action on that customer page "Continue quote → job" instead of a bare "Add job" button.

**Acceptance criteria**
- An accepted, unconverted quote is visible on the customer's page without navigating to the full quotes list.

---

## TICKET 6 — AI-assisted expense/transaction entry: description-first, auto-fill the rest

**Priority:** High — new feature
**Files to build from / extend:**
- Existing AI precedent to copy: `src/lib/services/quote-ai.ts`, `src/lib/domain/quote-ai.ts`, `src/lib/repositories/quote-ai-repository.ts`, `src/app/(app)/quotes/quote-ai-workbench.tsx` — this is a working OpenAI Responses API integration (structured JSON-schema output, `OPENAI_API_KEY`, configurable model via env, stored recommendation + "apply" flow). The transaction/expense version should follow the same shape rather than inventing a new pattern.
- Entry points to change: `src/app/(app)/transactions/transaction-review-forms.tsx` (`QuickCategorizeForm`, used when categorizing an unreviewed bank transaction as a new expense) and `src/app/(app)/expenses/expense-form.tsx` (manual "Add expense").
- Field target list, all from `expense-form.tsx`: `category`, `vendor`, `taxCategory`, `deductiblePercent`, `financialClassification`, `laborClass`, `paymentMethod`, `jobId` (optional link), `equipmentId` (optional link).

**What Jeff asked for**
On the transaction/expense review screen, the *first* thing entered is a free-text description box (e.g. "Home Depot, lumber and screws for the Elm St stump job"). An AI agent then infers every other field on the form. Each auto-filled field is color-coded by the model's confidence — low-confidence fields are visually flagged as needing review — so the goal state is: write one sentence, review a few flagged fields, save.

**Proposed design**
1. New service `src/lib/services/expense-ai.ts`, mirroring `quote-ai.ts`: takes the free-text description (plus, when available, the bank transaction's own description/amount/date/account as extra context) and calls the OpenAI Responses API with a `json_schema` response shape covering every target field, each returned as `{ value, confidence: "high" | "medium" | "low" }`.
2. New domain module `src/lib/domain/expense-ai.ts` (parallel to `quote-ai.ts`'s domain helpers) defining that schema, the prompt, and a `confidenceColor()` helper.
3. Client-side: `QuickCategorizeForm` and `ExpenseForm` get a description box at the top, wired to an action that calls the AI service on blur/submit-of-description and returns the field values. Populate the existing controlled inputs with the returned values; wrap each field in a colored ring/badge keyed to its confidence (e.g. green border = high, amber = medium/needs a glance, red = low/likely wrong — reuse the existing `StatusBadge` color tokens for consistency with the rest of the app).
4. Every field stays a normal editable input — the AI is prefilling, not locking. Saving still goes through the existing `saveExpense` / `quickCategorizeTransaction` actions and validation (`lib/validation/business-records.ts` or wherever expense validation lives) unchanged.
5. Bank-fed transactions already carry a raw description (often cryptic, e.g. "SQ *HOME DEPOT 4429") — pass that in as context even when Jeff types his own plain-English description, so the model has both signals.
6. Feed the model's own vendor-matching rules where they exist: `expense-repository.ts` and the fuzzy-match/classification-rules tables already encode Jeff's historical categorization patterns (see `bank_classification_rules` migrations) — worth having the prompt reference recent similar expenses for this vendor/category so confidence improves over time, the same way `quote-ai.ts` uses `rankComparableJobs` for pricing.

**Acceptance criteria**
- Typing a description and tabbing out (or an explicit "Suggest fields" button, to control API cost) fills category, vendor, tax category, deductible %, management classification, labor class, payment method, and job/equipment link where inferable.
- Each auto-filled field shows a clear, accessible (not color-only) confidence indicator — icon or label text, not just a color, so it isn't lost on colorblind users or in the color-coded badge alone.
- No field is ever submitted without being visible/editable — this is assisted entry, not silent auto-save.
- Feature is gated behind the same `OPENAI_API_KEY` configuration check pattern as `isQuoteAiConfigured()`, so it degrades gracefully (plain manual form) when unset.

**Open question for Jeff**
Should the AI call fire automatically as soon as the description field loses focus, or only on an explicit button click? Automatic is smoother but burns an API call on every partial edit; a button gives control over cost. Recommend starting with an explicit button (matches how the existing Quote AI workbench works — it's action-triggered, not automatic) and revisiting if it feels like friction.

---

*Compiled from a live code review of the repo on 2026-08-25. File line numbers may drift as the code changes — re-check before implementing.*
