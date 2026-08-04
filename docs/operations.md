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
internal notes. Expenses can link to a job, equipment item, both, or neither.

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
/api/v1/reports/summary
```

Add `?format=csv` to a record endpoint for a spreadsheet-compatible download.
Browser requests use the normal session cookie. External callers may send a
Supabase user access token in `Authorization: Bearer <token>`. Both paths use the
same business Row Level Security policies as the application. Service-role
credentials are never used.
