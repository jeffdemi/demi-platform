# Changelog

## Unreleased - Quote AI Workbench

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

## Unreleased - Financial Accuracy

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

## Unreleased - Full Feature Parity

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
