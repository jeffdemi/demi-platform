# Current Project Status

Last reviewed: **2026-08-16**

This is the dated development and bookkeeping handoff. Update it when production
state, unresolved financial facts, or release procedures materially change.

## Production baseline

- The application is in active use for Demi Solutions LLC.
- `main`, `origin/main`, and the working branch pointed to commit `d872c37` at
  the start of this documentation review.
- Production PostgreSQL is healthy and runs major version 17.
- All 35 migration names currently in `supabase/migrations` are represented in
  production.
- Several remote migration version timestamps differ from local filenames due
  to earlier management-API application. See [Development](development.md)
  before using the linked Supabase CLI.
- The repository has no checked-in CI workflow, Vercel project link, or
  deployment configuration that proves what a Git push deploys. Verify external
  GitHub/Vercel configuration before release.
- Production migrations, Git pushes, and deployments require explicit owner
  approval.

## Implemented and in use

- Invite-only, role-based tenant access with RLS and private file storage
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
refunds. Twenty-one now have linked operational expense records, with no active
allocation duplicate. The remaining Amazon $38.15 and Home Depot $14.37 rows are
still correctly represented once in the ledger as allocations, but need item
details before they can be promoted to defensibly categorized expense records.

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

### 5. Establish repeatable delivery infrastructure

- Reconcile the Supabase migration-history timestamp mismatch in a tested,
  reviewed release.
- Add CI for test, lint, typecheck, build, and migration validation.
- Document or check in the Vercel project/deployment policy without committing
  secrets.
- Add a staging or Supabase branch workflow so schema and RLS tests never require
  production.

## Known product boundaries

- No direct bank feeds; statements are CSV/XLSX imports.
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
