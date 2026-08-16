# Changelog

## Unreleased - Documentation Handoff

### Documentation

- Reorganized the README around product purpose, architecture rules, onboarding,
  safe database work, verification, and current boundaries
- Added a development guide covering repository structure, Next.js 16 guidance,
  RLS/migration discipline, financial regression checks, and the release process
- Added a bookkeeping model for revenue, expenses, owner funding, labor,
  transfers, business lines, digital assets, and month-end close
- Added a dated project-status handoff with the production baseline, open
  bookkeeping work, delivery risks, and recommended next development
- Corrected outdated claims that the digital-assets/business-lines migration was
  local-only and that the current crypto view was already a complete tax-lot
  ledger

## Digital Assets And Business Lines

### Added

- Digital-asset accounts, idempotent exchange CSV imports, transaction units, fees, transfer references, FIFO cost basis, sales, and realized gain/loss reporting
- Stored exchange as-of reconciliations for BTC, ETH, ADA, USD cash, and future assets
- Federal IT Contracting and Demi Stump Grinding classification across operating and ledger records
- Separate business-line and consolidated profit-and-loss reporting and CSV exports
- Chase checking promotion tracking plus original equipment and Chase business credit-card records
- Owner contributions, related-party loans, repayments, draws, and estimated-tax entries that stay outside operating expenses
- Legal-name, public-brand, tax-treatment, and fictitious-name review settings
- Historical opening-balance, Venmo, owner-advance, and cleanup staging with explicit balanced posting

### Database

- Added tenant-scoped RLS tables, explicit Data API grants, foreign-key indexes, and security-invoker RPCs
- Added nullable business-line dimensions without rewriting existing records
- Seeded Demi Solutions LLC-specific lines and accounts only when that legal entity exists

### Operational Safety

- The migration was additive and preserved existing operational records
- Exchange imports are idempotent by file hash and transaction fingerprint
- Internal digital-asset transfers do not create realized gains
- Owner draws and estimated taxes post to owner equity, not business expenses

## Bookkeeping And Month-End Close

### Added

- Bank and credit-card statement periods with opening, closing, imported, and book-balance reconciliation
- Split transaction allocations, bank-transfer matching, and retained exclusion reasons
- Balanced manual adjustments for depreciation, loan, owner-equity, and correcting entries
- Ledger-based profit and loss, balance sheet, cash flow, and trial balance reports with CSV exports
- Account-level month-end reconciliation and a close lock that blocks changes to closed source periods
- Owner/admin reopening with a required reason and retained close/reopen audit fields

### Database

- Added statement periods, allocation history, transfer links, and bookkeeping adjustment records
- Added bank-account attribution to journal lines and expanded the default chart of accounts
- Added business-scoped RLS, targeted indexes, security-invoker posting functions, and period-open guards
- Preserved existing transactions and journal history; the migration is additive and performs no deletes

### Deferred

- Direct bank feeds and automatic bank credential synchronization
- Statement PDF storage, OCR, and automatic transaction categorization
- Automated payroll posting, loan amortization, and depreciation generation
- Multi-line adjustment worksheets beyond the current balanced two-line entry
- Tax filing, CPA review, and a full GAAP accrual/subledger implementation

## Paid Amount Integrity

### Fixed

- Job lists now show the actual amount paid instead of the quoted amount
- Cash and management reports include recorded job paid totals when a historical payment row is missing, without double counting linked payments
- Existing paid jobs without payment rows are backfilled into the payment ledger and balanced journal without changing source job records

## Management Reporting Foundation

### Added

- Labor and payroll entry with direct, management, and sales classifications
- Owner compensation setup with market-rate salary, actual wages, distributions, and contributions kept distinct
- COGS, operating, labor, asset, and owner-distribution expense classifications
- Monthly balance snapshots, cash reconciliation, and a missing-information checklist
- Equipment purchase cost, straight-line management depreciation, and loan tracking
- Configurable Total LER, profit-to-gross-margin, core-capital, and ROIC targets
- A normalized management P&L and Simple Numbers-style scorecard alongside existing cash and tax reports
- A searchable financial guide, context-aware global help link, and inline definitions for specialized terms

### Database

- Added owner/admin-scoped financial settings, owner compensation, labor entries, and monthly snapshot tables
- Added management classification columns to expenses and financial schedule columns to equipment
- Added targeted indexes, validation constraints, RLS policies, and classification-aware journal accounts
- Preserved all existing source records; legacy expenses default to operating and are explicitly queued for review

### Deferred

- Payroll processing, payroll tax filing, and employee deductions
- Automatic payroll-provider or live bank-feed synchronization
- CPA-approved tax depreciation schedules and formal GAAP financial statements
- Historical accounts-receivable aging snapshots and full accrual accounting automation
- Automated loan amortization, principal/interest splitting, and lender statement imports
- Benchmark calibration using a larger history of closed months

## Quote AI Workbench

### Added

- Private, phone-friendly multi-photo uploads for draft quotes
- Reliable HEIC/HEIF conversion fallback for iPhone photos when the browser cannot decode them natively
- Price-pending drafts so photos and AI preparation can happen before an amount is entered
- Browser-side image resizing, JPEG conversion, and metadata removal before upload
- A quote preparation screen with structured AI observations, questions, assumptions, price range, recommended price, scope, and customer wording
- Persistent per-quote follow-up conversations that recalculate the recommendation as new information is supplied
- Locally ranked, anonymized completed-job measurements as pricing evidence
- Explicit operator approval before a recommendation changes the quote

### Database

- Added business-scoped quote photos, AI threads, messages, and recommendation history
- Added a private `quote-photos` bucket with quote-aware Storage RLS and file restrictions
- Added explicit authenticated-role grants for current Supabase Data API behavior
- Preserved every existing quote, job, customer, and financial record

### Privacy And Control

- Keeps customer identity, exact service address, internal notes, hazard notes, and raw comparable-job descriptions out of AI requests
- Uses short-lived signed photo URLs and disables OpenAI response storage
- Requires an explicit photo-analysis confirmation and never sends or changes quote status automatically

### Deferred

- Automatic stump measurements from photos; the assistant asks for measurements when images do not establish scale
- Customer-facing AI chat, automatic quote delivery, and autonomous pricing decisions
- Calibration reports comparing recommendations with accepted price, actual work time, and job profitability

## v0.2.0 - Accounting Operations

### Added

- Preview-first CSV/XLSX bank-statement imports with file and row duplicate protection
- Bank-account register, reconciliation queue, expense/payment matching, and explicit exclusions
- Source-linked payment records supporting partial payments and imported deposits
- Double-entry chart of accounts and revision-preserving journals for expenses, assets, refunds, and customer payments
- Tax categories, deductible percentages, annual tax-preparation summaries, and accountant-ready CSV exports
- Receipt review and automatic category suggestions based on recorded vendor and description
- Database and service-level controls preventing refunds from exceeding their original purchase

### Database

- Added business-scoped bank accounts, import batches, bank transactions, payments, ledger accounts, journal entries, and journal lines
- Backfills paid invoices and uninvoiced paid jobs into the payment ledger without modifying source records
- Backfills balanced journal revisions for active expenses and payments
- Adds transaction matching, payment synchronization, refund ceilings, RLS, and targeted query indexes

### Security

- Moved setup and invitation `SECURITY DEFINER` implementations out of the exposed API schema
- Preserved public RPC signatures through least-privilege `SECURITY INVOKER` wrappers
- Leaked-password protection remains a Supabase Auth dashboard setting and must be enabled there

### Deferred

- Direct live bank feeds; this release imports bank-provided CSV/XLSX statements
- Image OCR; receipt review currently suggests categories from verified record fields and retains an extraction-review schema for a future provider
- Automated tax filing, depreciation decisions, and jurisdiction-specific tax advice
- Direct QuickBooks/Xero synchronization; stable CSV exports are provided instead

## Financial Accuracy

### Added

- Operating expense, asset purchase, and linked refund classifications
- Expense detail/edit workflows and reversible archive/restore controls
- Private receipt uploads with business-scoped Storage policies and signed URLs
- Operating profit, capital purchase, refund, cash-outflow, and cash-net reporting
- Monthly financial performance and operating expense category summaries

### Database

- Added expense classification, refund relationship, receipt path, and archive audit columns
- Added active-record and refund-source indexes
- Classified only explicitly tagged imported assets and the known imported refund
- Preserved all original records and source amounts

### Deferred

- Depreciation schedules and formal fixed-asset accounting
- Split transactions, sales-tax allocation, and accounting-platform synchronization
- Invoice payment ledger, partial payments, and Stripe reconciliation

## Full Feature Parity

### Added

- Quote sales pipeline, customer message generator, PDFs, status dates, and transactional quote-to-job conversion
- Invoice list/detail/create workflows, status updates, job links, and PDFs
- Expense entry and history with job/equipment associations
- Equipment records, maintenance history, future service tracking, and safe meter updates
- Preview-first Excel/CSV job import with duplicate protection and audit history
- Financial and operational dashboard queues, quote metrics, maintenance alerts, and referral revenue
- Monthly reporting, authenticated JSON endpoints, and CSV exports
- Global navigation for all operational modules and password-manager-friendly login autocomplete

### Database

- Added `job_imports` with business-scoped RLS and import fingerprint uniqueness
- Added caller-authorized transactional functions for quote conversion, invoice creation, maintenance, and job imports
- Preserved all existing tables, records, legacy IDs, and tenant policies

### Deferred

- SMS/email delivery, electronic signatures, online acceptance, customer portal, and payment collection
- PA 811 submission, municipality lookup, travel-time calculation, and AI photo pricing
- External accounting/CRM credentials and outbound webhook integrations
