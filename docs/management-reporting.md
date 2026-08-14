# Management Reporting

This release adds a Crabtree-inspired management reporting layer for operating
decisions. It is not affiliated with Greg Crabtree or Simple Numbers, and it is
not a substitute for CPA-prepared tax returns or formal financial statements.

## In-App Help

The global information button opens `/help/financial-guide` at the section most
relevant to the current page. Specialized finance fields and report metrics also
include information buttons that show the same definition, formula, source, and
operating guidance without leaving the current workflow. The full guide includes
the monthly workflow diagram and a searchable glossary.

## Core Terms

- **Revenue** uses active payment-ledger receipts on the cash basis. Historical
  jobs with a recorded paid amount and no payment-ledger row are included once
  as a preservation fallback. Accrual basis uses non-draft invoices on
  the accrual basis, according to the reporting setting.
- **COGS** is the non-labor cost directly required to deliver a job, such as
  disposal fees, subcontracted production, or job-specific materials.
- **Gross margin** is revenue minus COGS.
- **Direct labor** performs customer work. Management labor runs the company.
  Sales labor creates demand and closes work.
- **Contribution margin** is gross margin minus direct labor.
- **Pretax profit** is gross margin minus normalized labor, payroll burden,
  operating expense, and management depreciation.
- **Total LER** is gross margin divided by total labor. Direct and management LER
  are also shown when the denominator is available.
- **Core capital** is the configured number of months of average labor, payroll
  burden, and operating expense.
- **ROIC** annualizes management pretax profit and divides it by invested capital
  from the latest monthly balance snapshot.

## Monthly Workflow

1. Review each expense and assign COGS, operating, labor, asset, or owner
   distribution. Labor expenses also require direct, management, or sales.
2. Record gross wages, employer payroll taxes, benefits, hours, and labor class
   in `/labor`.
3. Record owner market salary, actual wages, distributions, and contributions in
   `/reports/settings`.
4. Import each bank and credit-card statement, clear unmatched items, and create
   a reconciliation period in `/finance/reconciliations/new`.
5. Reconcile imported activity and journal activity to every statement closing
   balance. Review the trial balance, P&L, balance sheet, and cash flow in
   `/reports/books`.
6. Enter receivables, payables, debt, taxes, inventory, and net fixed assets in
   `/finance/month-end`, resolve the checklist, then close the month.
7. Review the normalized management P&L and scorecard in `/reports`. Reopen a
   closed month only to make a necessary correction and record the reason.

## Data Discipline

Owner wages are normalized to a market rate for management reporting. Owner
distributions are returns on ownership and do not reduce operating profit.
When the same distribution is recorded in both the monthly owner record and a
classified cash outflow, the report uses the larger period total instead of
adding both totals and double-counting the same money.

Do not enter the same payroll cost both as a labor entry and as a labor-classified
expense. Use labor entries for payroll detail. A labor-classified expense is for
labor costs that are not represented in payroll entries, such as a separately
tracked production subcontractor.

The equipment depreciation schedule is a management estimate. Store the current
loan balance from the lender statement, but continue to use your accountant's
schedule for tax depreciation and your lender's statement for official payoff.

## Current Boundaries

- Bank activity is imported from CSV/XLSX statements; direct bank feeds and
  statement PDF storage are deferred.
- Bookkeeping reports are ledger-based, but this is not a complete GAAP accrual
  system with inventory, payroll, and receivable/payable subledgers.
- Manual adjustments currently support one debit and one credit per entry.
- The app records payroll totals but does not calculate checks, withholdings, or
  payroll tax filings.
- Accounts receivable in the close checklist compares the entered month-end
  balance with invoices currently marked unpaid. Historical aging is deferred.
- Equipment loans track balances and terms but do not generate amortization or
  split imported payments between principal and interest.
- Management targets are configurable starting points, not universal rules.
