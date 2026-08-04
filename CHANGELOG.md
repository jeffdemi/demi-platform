# Changelog

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
