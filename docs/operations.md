# Operations Reference

## Quote lifecycle

Supported quote statuses are `draft`, `sent`, `accepted`, `declined`,
`no_response`, `expired`, and `converted`. Marking a quote sent records its first
sent date. Accepting or declining records the response date. Only an accepted,
unconverted quote can create a job. Conversion copies the customer, location,
scope, hazards, price, pro bono flag, and PA 811 flag and permanently links both
records in one transaction.

Customer messages and quote PDFs include customer-facing scope and location
details. They never include internal notes; hazard notes are also omitted from
customer documents.

## Invoices and expenses

Invoice numbers use `INV-YYYY-NNNN`. Creating an invoice for a job updates the
job to `invoiced`, or `paid` when the invoice is created paid. Invoice PDFs omit
internal notes.

Expense records use one of three financial types:

- `expense`: included in operating expense and cash outflow
- `asset`: excluded from operating expense but included in cash outflow
- `refund`: linked to its original expense and subtracted from both operating expense and cash outflow

Archived records remain stored but are excluded from every financial total.
Archiving requires explicit confirmation and a reason and can be reversed.
Receipts are limited to JPG, PNG, WebP, or PDF files up to 4 MB. They are stored
in a private Supabase bucket and opened through short-lived signed URLs.

Reports show operating profit (`paid revenue - net operating expense`) separately
from cash net (`paid revenue - net cash outflow`). This prevents equipment
purchases from distorting operating performance while retaining their cash impact.

Refunds cannot exceed the unrefunded amount of their active source purchase. The
service reports the remaining refundable balance, and PostgreSQL independently
enforces the same ceiling for direct or concurrent writes.

## Reconciliation and payments

`/finance` manages business bank accounts and imported statement activity.
`/finance/import` accepts `.csv` and `.xlsx` exports with Date, Description, and
Amount columns, or separate Debit and Credit columns. Deposits are positive and
withdrawals are negative. Previewing never writes data; confirmation is idempotent.

Unreviewed withdrawals can prefill an expense, while deposits can prefill a
customer payment. The database requires the linked source amount to match exactly.
Nonbusiness transfers and duplicates can be excluded with a retained reason.

Payments support partial invoice collections. A fully paid balance updates the
invoice status and linked job totals. Existing paid invoices and paid jobs without
invoices are backfilled once as legacy payments.

## Ledger, tax, and receipts

Every active expense, asset purchase, refund, and customer payment produces a
balanced two-line journal. Corrections supersede the prior journal revision, so the
general ledger retains its posting history. Ledger tables cannot be edited through
normal client data access.

Expense forms include a tax category and business-deductible percentage. These
fields support preparation reports; they are not tax advice. `/reports` provides
annual tax detail and general-ledger CSV exports for an accountant or bookkeeping
system.

Receipt review suggests a tax category from the verified vendor, description, and
category already on the record. The extracted-data and review fields are ready for
a future OCR provider, but this release does not send private receipts to an
external AI service.

## Equipment and maintenance

Maintenance records include service date/type, meter reading, cost, next due
date/hours, and notes. A new reading advances the equipment meter but never
reduces an existing reading.

## Spreadsheet import

`/imports/jobs` accepts `.xlsx` workbooks with a `Jobs` worksheet and `.csv`
files. Required columns are `Customer`, `Address`, `Phone`, `Description`, and
`Status`. Supported optional columns are `Job #`, `Job Date`, `Referred By`,
`Amount Quoted`, `Amount Paid`, `Payment Method`, `Paid Date`, and `Notes`.

The preview does not write data. Confirmation is transactional. Row fingerprints
prevent duplicate jobs, and a file SHA-256 prevents the same exact spreadsheet
from being imported twice.

## API and exports

Signed-in business members can request JSON from:

```text
/api/v1/customers
/api/v1/jobs
/api/v1/quotes
/api/v1/invoices
/api/v1/expenses
/api/v1/payments
/api/v1/bank_transactions
/api/v1/reports/summary
/api/v1/reports/tax-summary
/api/v1/reports/general-ledger
```

Add `?format=csv` to a record endpoint for a spreadsheet-compatible download.
Browser requests use the normal session cookie. External callers may send a
Supabase user access token in `Authorization: Bearer <token>`. Both paths use the
same business Row Level Security policies as the application. Service-role
credentials are never used.
