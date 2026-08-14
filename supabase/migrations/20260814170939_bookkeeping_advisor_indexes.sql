-- Cover foreign keys introduced by the bookkeeping and month-end close release.

create index bank_statement_periods_reconciled_by_idx
  on public.bank_statement_periods (reconciled_by)
  where reconciled_by is not null;
create index bank_statement_periods_closed_by_idx
  on public.bank_statement_periods (closed_by)
  where closed_by is not null;
create index bank_statement_periods_created_by_idx
  on public.bank_statement_periods (created_by)
  where created_by is not null;

create index bank_transaction_allocations_created_by_idx
  on public.bank_transaction_allocations (created_by)
  where created_by is not null;
create index bank_transaction_allocations_voided_by_idx
  on public.bank_transaction_allocations (voided_by)
  where voided_by is not null;

create index bank_transfer_links_created_by_idx
  on public.bank_transfer_links (created_by)
  where created_by is not null;
create index bank_transfer_links_voided_by_idx
  on public.bank_transfer_links (voided_by)
  where voided_by is not null;

create index bookkeeping_adjustments_debit_account_idx
  on public.bookkeeping_adjustments (business_id, debit_account_id);
create index bookkeeping_adjustments_credit_account_idx
  on public.bookkeeping_adjustments (business_id, credit_account_id);
create index bookkeeping_adjustments_created_by_idx
  on public.bookkeeping_adjustments (created_by)
  where created_by is not null;
create index bookkeeping_adjustments_voided_by_idx
  on public.bookkeeping_adjustments (voided_by)
  where voided_by is not null;

create index monthly_financial_snapshots_closed_by_idx
  on public.monthly_financial_snapshots (closed_by)
  where closed_by is not null;
create index monthly_financial_snapshots_reopened_by_idx
  on public.monthly_financial_snapshots (reopened_by)
  where reopened_by is not null;
