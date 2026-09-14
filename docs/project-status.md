# Current Project Status

Last reviewed: **2026-09-07**

This is the dated development and bookkeeping handoff. Update it when production
state, unresolved financial facts, or release procedures materially change.

## Repository and release baseline

- Working branch: `workflow-improvements`; reviewed HEAD:
  `649ced54df6869877449e47e5e645777bcb0d098`.
- Local `main`: `6c41380b50216a92e8be7c5a9481834e41297fdc`.
  Cached `origin/main`: `8db65e1a3a52d73ccc77afb79abd08480b5c03b0`.
  These refs differ; current live remote main is **Needs confirmation**. No fetch,
  merge, commit, push or deployment was performed. This document describes the
  reviewed checkout, not an assumed production commit.
- Main history includes multi-business switching/creation (#10), transaction
  navigation/quick categorization and monthly reports (#12–14). Reviewed HEAD
  also includes quote context/AI expense suggestions, UI/navigation work (#17)
  and the navigation Server Component fix (#18). Their current production
  deployment status is **Needs confirmation**.
- Historical notes identify active production use, PostgreSQL 17, SimpleFIN and
  Vercel project `stump-grinding` deploying from main. Current deployed SHA,
  project linkage, database health and environment settings: **Needs confirmation**.
- 44 local migrations: 43 historical plus
  `20260907221107_platform_reliability_atomic_quote_conversion.sql`, newly added
  in this worktree and not applied to production in this task. Exact production
  history and schema application: **Needs confirmation** for every mapping.
  See [Migration history](migration-history.md). Intern, fuzzy-match,
  multi-business and category migrations have no verified application evidence.
- Platform Reliability & Delivery is an uncommitted hardening change: two CI gates,
  local schema projection, pgTAP isolation/conversion tests, transactional final
  quote/job values, smoke checks and recovery guidance. Hosted CI execution and
  required branch protection are **Needs confirmation**.
- Application tests: **154 passing tests in 18 files** (144 baseline + 10 workflow
  cases). Database SQL tests contain **124 assertions** (109 isolation/role, 15 conversion),
  authored but not executed: ARM64 host has an
  Intel-only Docker CLI and no Docker Desktop installation found. The pinned
  npm Supabase CLI 2.117.0 works. See [Development](development.md).
- Final application verification: tests, lint, typecheck and build passed;
  `npm audit --omit=dev` reported zero vulnerabilities. Build also passed with CI
  placeholder public configuration and empty server secrets. Local database test
  connection was refused at `127.0.0.1:54322` because Docker could not start.
- Dependency fix: PostCSS's transitive `nanoid` updated only from 3.3.16 to 3.3.18
  in the lockfile for GHSA-2v37-7h3g-55p8. No forced or broad dependency upgrade.
- Production migrations, history repairs, backup configuration, Git pushes and
  deployments require a separately approved concrete owner plan.

## Implemented in the reviewed checkout

- Invite-only, role-based tenant access with RLS and private file storage,
  including a read-only intern role gated by an `is_business_writer()` RLS
  helper and matching UI write-path checks
- Customers, jobs, quotes, invoices, expenses, receipts, equipment, maintenance,
  and operational reports
- Quote PDFs and a private-photo OpenAI quote-preparation workbench
- Preview-first job, bank/card, Venmo, and exchange CSV imports with duplicate
  protection
- Expense/payment matching, split allocation, transfer pairing, exclusion,
  classification rules, and batch approval pages
- Balanced payment/expense journals, manual adjustments, statement periods,
  bookkeeping reports, and month close/reopen controls
- Business-line classification and consolidated/per-line P&L
- Owner contribution/loan/repayment/draw/estimated-tax workflows
- Historical cleanup queue and auditable archive/deletion override workflows
- Management labor, owner normalization, monthly snapshots, and scorecards

## Confirmed business facts

- Legal entity: Demi Solutions LLC
- Current understood tax treatment: default single-member LLC; no known S-corp
  election
- Operating lines: Federal IT Contracting and Demi Stump Grinding
- FedUnited IT billing: $75/hour with no withholding
- Personal transfers are owner contributions/draws/loans, not operating expense
- Demi Stump Grinding's Pennsylvania fictitious-name registration still needs
  confirmation
- Chase business checking is intended as the shared operating account; the
  original equipment card and Chase business credit card are separate accounts
- Historical activity includes Venmo, personal/related-party advances, a Bank of
  America holding route, and temporary business-owned crypto

## Current bookkeeping handoff

The known stump-grinding job/payment history was compared with the original
spreadsheet. The July 31 receipt is correctly $150. Recent additive cleanup
migrations preserve that amount and reconcile known April and May transfers
without inventing income or expense.

The Bank of America equipment-card export contains 23 merchant purchases or
refunds. All 23 now have linked operational expense records, with no active
allocation duplicates. The final two are the owner-confirmed Amazon $38.15
grease gun and Home Depot $14.37 trailer-hardware purchases.

The business sold its remaining crypto on 2026-08-15. Current working facts are:

- net exchange sale proceeds: **$2,714.64**;
- withdrawal fee: **$47.51**;
- expected cash transfer: **$2,667.13**;
- route: exchange → personal Bank of America account → Chase business checking;
- accounting intent: business funds in transit, not an owner distribution or a
  second revenue event.

Those amounts are operational notes, not a final tax-lot calculation. The all-
time acquisition basis and any earlier disposal basis still require completion
and reconciliation.

## Highest-priority open work

### Tolerance-based (fuzzy) expense matching — shipped, pending production migration

Bank transactions that are close in amount (e.g. a rounded-cent expense entry)
and date to a recorded expense, but not exact, now surface as a manual-approve
"Possible match" suggestion on the transaction review page instead of sitting
unmatched indefinitely. The exact-match bulk auto-matcher is unchanged and
still only auto-links true exact matches. Approving a fuzzy match corrects the
expense's recorded amount to the bank withdrawal and logs the correction in
the new `expense_bank_match_corrections` audit table, inside a security-
invoker function that also re-checks owner/admin membership and the
closed-period lock. Tolerance percent (default 2%, 0-20) and day window
(default 10, 0-60) are owner/admin-configurable on
`/reports/settings`.

Production application of `20260818130000_expense_match_tolerance_settings.sql`
and `20260818140000_fuzzy_expense_match_corrections.sql` is **Needs confirmation**;
this environment had no local Docker/Postgres available to rehearse the
migration end to end, so re-verify the RPC's rejection paths (wrong business,
already-matched, closed period, non-owner/admin) against a real database
before or immediately after applying.

### SimpleFIN bank sync

Historical handoff notes report the additive SimpleFIN Bridge integration deployed.
Current deployment and configuration are **Needs confirmation**. It adds
owner/admin connection and mapping controls, encrypted Access URL storage, a
user-driven safe preview, account-scoped provider-ID/fingerprint duplicate
protection, and confirmed import of posted activity. The production encryption
key is stored as a sensitive Vercel variable. The first owner-driven connection
still needs to prove that all four provider accounts appear (including the
Chase credit card), map only business accounts, and confirm that previously
imported CSV rows are linked rather than duplicated.

### 1. Finish digital-asset accounting before tax preparation

- Import and reconcile the all-time exchange history, not only the latest 30
  days.
- Detect and block or clearly flag sales whose units exceed available lots.
- Allocate proceeds only to matched disposal units.
- Persist tax lots and disposal links or produce an equally durable audit trail.
- Post purchases, fees, proceeds, basis, gains/losses, and transfers to the
  general ledger through an auditable workflow.
- Record and match the $2,667.13 in-transit proceeds through the personal holding
  account and Chase without creating revenue twice.
- Obtain CPA review of final realized gains, fees, and holding-period treatment.

### 2. Complete month-by-month close

For each active month, finish statement imports, clear unreviewed rows, prove
transfers, reconcile every active business account, inspect all four book
statements, resolve Cleanup items, and then close the period. Do not close a month
with guessed opening balances.

### 3. Resolve legal and tax configuration

- Confirm Pennsylvania fictitious-name registration for Demi Stump Grinding.
- Confirm tax election status with the owner/CPA before implementing any owner
  payroll behavior.
- Have a CPA confirm the treatment of owner-held business funds, equipment basis,
  depreciation, related-party advances, and estimated-tax payments.

### 4. Make financial automation safer and easier

- Add confidence/reason visibility and collision handling to learned merchant
  classifications.
- Expand bulk approval without weakening review or period-lock controls.
- Improve statement-period dashboards so unmatched operational records and
  imported activity converge on one close checklist.
- Preserve form values and actionable error text for every failed Server Action.

### 5. Complete reliability release validation

- Install/start a compatible local container runtime and pass both database suites.
- Require the two CI checks before merging; hosted runs are not yet verified.
- Rehearse original migration history on a sanitized representative restore.
  The local projection omits seven production-dependent data blocks and therefore
  does not prove those corrections or a full historical upgrade.
- Obtain the actual production history and approve a precise reconciliation map.
- Verify backup coverage, key recovery access and an isolated restore drill.
- After database and CI evidence, approve the additive RPC migration before app
  promotion, then execute the [smoke checklist](release-checklist.md).

Recommended next release: **Recovery & Migration Validation** to close these
operational evidence gaps before expanding financial automation. Existing
bookkeeping/tax uncertainties above remain unchanged.

## Known product boundaries

- Production has a user-driven SimpleFIN transaction feed. CSV/XLSX statements
  remain the fallback and are still required for formal reconciliation because
  the feed does not provide statement PDFs or opening/closing statement proof.
- No payroll calculation, withholding, payment, or filing.
- No tax filing or guarantee of tax treatment.
- No full A/R, A/P, inventory, or loan-amortization subledger.
- Manual adjustments currently support one debit and one credit.
- Receipt review is structured and rule-based; private receipts are not sent to
  an OCR/AI provider.
- External SMS/email delivery, payment collection, signatures, customer portal,
  PA 811 submission, municipality lookup, and travel-time services remain
  deferred.

## Definition of a clean handoff

A future developer should leave this file updated with:

- the deployed Git commit;
- migrations applied and their target environment;
- tests and production smoke checks run;
- financial records changed and the business reason;
- unresolved factual questions that must not be guessed;
- any new limitation that affects books, taxes, security, or data integrity.
