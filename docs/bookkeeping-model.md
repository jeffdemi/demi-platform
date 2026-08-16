# Bookkeeping Model

This document explains the financial meaning the application is designed to
preserve. It is an implementation and operating reference, not tax or legal
advice. A CPA should review tax treatment and year-end entries.

## Business context

The current workspace represents:

- legal entity: **Demi Solutions LLC**;
- current understood tax treatment: default single-member LLC, with no known
  S-corporation election;
- operating lines: **Federal IT Contracting** and **Demi Stump Grinding**;
- Federal IT client: FedUnited, billed at $75 per hour without withholding;
- public brand: Demi Stump Grinding, whose Pennsylvania fictitious-name status
  still requires confirmation;
- shared banking: Chase business checking is intended to receive revenue for
  both lines, while line attribution remains on the underlying records and
  journals;
- historical channels: Venmo, a Bank of America holding/checking route, the
  equipment credit card, a Chase business credit card, personal-funded business
  purchases, and a temporary crypto holding account.

Legal identity and public-brand settings are deliberately separate. A brand
name never changes which legal entity owns a transaction.

## Sources of truth

| Economic event | Primary record | Bookkeeping effect |
| --- | --- | --- |
| Customer cash received | `payments` | Revenue and cash/card/Venmo clearing through a balanced journal |
| Quote | `quotes` | Sales estimate only; never revenue |
| Invoice | `invoices` | Billing/operational state; cash reports still use payments |
| Business purchase | `expenses` | Expense, asset, or refund classification and balanced journal |
| Statement activity | `bank_transactions` | Evidence to match, split, transfer, exclude, or reconcile—not a second expense by itself |
| Bank/card statement | `bank_statement_periods` | Proof of opening balance, movement, and closing balance |
| Employee/contractor labor | `labor_entries` | Management/payroll detail; do not duplicate as an expense |
| Owner money in/out | `capital_transactions` | Contribution, loan, repayment, draw, or estimated tax; not operating revenue/expense |
| Crypto exchange activity | `digital_asset_transactions` | Digital-asset subledger; current automatic general-ledger posting is incomplete |
| Correcting/noncash entry | `bookkeeping_adjustments` | Explicit balanced journal with retained history |
| Opening or unresolved history | `bookkeeping_cleanup_items` | Off-ledger research queue until explicitly posted |

The journal is the source for formal book reports. Operational records remain
the human-readable evidence, and database posting functions keep the two layers
linked.

## Revenue

Cash-basis revenue comes from active payment records. A paid quote amount is not
revenue, and a job's quoted price is not a substitute for the amount actually
received. Historical paid jobs can be represented by a backfilled payment row so
the receipt is counted once.

Customer payments should be associated with the correct business line:

- stump-removal and grinding work → Demi Stump Grinding;
- FedUnited IT work → Federal IT Contracting.

Money moving among Venmo, a bank account, crypto, and Chase is a transfer or
asset movement. It must not create revenue again after the customer receipt was
already recognized.

## Expenses, assets, refunds, and evidence

Expense source amounts are stored as positive values. The financial type controls
their reporting effect:

- `expense`: operating or COGS cost;
- `asset`: balance-sheet purchase, excluded from operating expense;
- `refund`: linked reduction of a prior purchase; reporting supplies the
  negative effect.

COGS is a direct non-labor cost required to deliver customer work, such as a
job-specific disposal charge or subcontracted production. Customer revenue is
never COGS. General fuel, insurance, software, and ordinary overhead are normally
operating expense unless facts support a more direct classification.

A receipt or screenshot proves what was purchased. A statement row proves how
business money moved. They are related evidence but are not interchangeable:

- business bank/card purchase: enter or import the transaction and match it to
  the expense;
- personal funds used for a business purchase: record the expense as owner
  funded, attach evidence, and use owner contribution treatment; do not import a
  mostly personal statement solely to manufacture a match;
- business cash purchase: record it as cash with evidence and no bank statement
  match required.

## Imported banking workflow

1. Add the real account: bank, credit card, or Venmo.
2. Preview the institution CSV/XLSX. Preview does not write data.
3. Import once. File hashes and row fingerprints make re-imports idempotent.
4. Review each row:
   - match a recorded expense or customer payment;
   - create the missing operational record;
   - split it across ledger accounts;
   - pair both sides of a transfer;
   - exclude a duplicate, personal, or non-book item with a reason.
5. Use automatic matching and learned classification suggestions to clear the
   predictable bulk, but approve suggestions before posting.
6. Reconcile each statement period to the institution's signed opening and
   closing balances.

An imported credit-card payment is not an expense. Pair the bank withdrawal and
card credit as a transfer when both accounts are present. A card-side `PAYMENT
ADJUSTMENT` that merely offsets the same payment should be excluded or paired
according to the issuer's actual statement behavior, never counted as revenue or
expense.

## Owner activity and labor

For the currently understood default single-member LLC treatment:

- owner contributions increase equity;
- owner draws and personal estimated-tax payments reduce owner equity;
- a genuine owner loan is a liability and its repayment reduces that liability;
- none of those items are ordinary business revenue or expense;
- the owner should not be entered as a W-2 employee merely to satisfy the Labor
  page;
- owner market compensation in Reports is a management normalization, not a
  payroll transaction or tax deduction.

Use the Labor page for actual employee or contractor labor costs when wages,
taxes, benefits, or another paid labor amount exist. The application is not a
payroll processor and does not calculate withholding or file payroll returns.

## Business lines

Business lines are management dimensions within one legal entity, not separate
books or bank ownership. Classify income, expenses, assets, labor, payments,
allocations, and their journals consistently. `/reports/books` can then show:

- consolidated Demi Solutions LLC results;
- Federal IT Contracting only;
- Demi Stump Grinding only.

Shared overhead can remain consolidated or be allocated under a documented,
consistent policy. Do not change historical classifications merely to improve a
line's apparent result.

## Digital assets

The business temporarily held BTC, ETH, and ADA. The application stores exchange
accounts, imports, transactions, fees, transfer references, and as-of balance
reconciliations. Import remains idempotent by source file and normalized row.

The current FIFO display is provisional:

- the page calculates FIFO in application memory from imported transactions;
- the schema contains lot/disposal tables, but the current import workflow does
  not persist a complete tax-lot audit trail into them;
- a sale with missing acquisition rows can display an incomplete cost basis and
  overstated gain because unmatched units are not yet blocked or surfaced
  strongly enough;
- exchange rows do not yet post their purchases, proceeds, fees, basis, and gains
  automatically to the general ledger.

Therefore, do not treat the Crypto page alone as a tax-ready gain/loss report.
Import the all-time exchange history, resolve every unmatched unit, reconcile the
final exchange balance, and have the final lot schedule reviewed before year end.

When sale proceeds temporarily pass through a personal account on their way to
Chase business checking, use a documented business-clearing/owner-held-business-
funds path. Do not treat the personal-account landing or later Chase deposit as
new income.

## Month-end standard

A month is ready to close only when:

1. every business bank, card, and Venmo statement is imported;
2. every imported row is matched, classified, transferred, or excluded;
3. directly entered expenses are reviewed and either matched or correctly marked
   as no bank match required;
4. customer payments agree with actual cash receipts;
5. owner activity is outside operating profit;
6. business lines are assigned where known;
7. each account's opening, movement, and closing balance reconciles;
8. the trial balance is balanced and P&L, balance sheet, and cash flow are
   reasonable;
9. unresolved opening balances or advances remain visible in Cleanup rather than
   being guessed into the ledger;
10. the management snapshot and checklist are complete.

Closing locks source-dated changes. Reopen only for a necessary correction and
record the reason.
