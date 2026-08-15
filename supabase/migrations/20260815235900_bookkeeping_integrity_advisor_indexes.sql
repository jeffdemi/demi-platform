-- Cover foreign keys introduced by the bookkeeping, business-line, and
-- digital-asset releases. These indexes keep parent updates/deletes and the
-- related finance lookups predictable as the ledgers grow.

create index bank_allocations_business_line_idx
  on public.bank_transaction_allocations (business_id, business_line_id)
  where business_line_id is not null;

create index cleanup_items_business_line_idx
  on public.bookkeeping_cleanup_items (business_id, business_line_id)
  where business_line_id is not null;

create index cleanup_items_debit_account_idx
  on public.bookkeeping_cleanup_items (business_id, debit_account_id)
  where debit_account_id is not null;

create index cleanup_items_credit_account_idx
  on public.bookkeeping_cleanup_items (business_id, credit_account_id)
  where credit_account_id is not null;

create index cleanup_items_posted_journal_idx
  on public.bookkeeping_cleanup_items (business_id, posted_journal_entry_id)
  where posted_journal_entry_id is not null;

create index capital_transactions_business_line_idx
  on public.capital_transactions (business_id, business_line_id)
  where business_line_id is not null;

create index digital_asset_lots_account_idx
  on public.digital_asset_lots (business_id, account_id);

create index digital_asset_lots_acquisition_idx
  on public.digital_asset_lots (business_id, acquisition_transaction_id)
  where acquisition_transaction_id is not null;

create index digital_asset_transactions_business_line_idx
  on public.digital_asset_transactions (business_id, business_line_id)
  where business_line_id is not null;

create index labor_entries_created_by_idx
  on public.labor_entries (created_by)
  where created_by is not null;

create index labor_entries_voided_by_idx
  on public.labor_entries (voided_by)
  where voided_by is not null;

create index monthly_snapshots_created_by_idx
  on public.monthly_financial_snapshots (created_by)
  where created_by is not null;

create index monthly_snapshots_reconciled_by_idx
  on public.monthly_financial_snapshots (reconciled_by)
  where reconciled_by is not null;

create index owner_comp_periods_created_by_idx
  on public.owner_compensation_periods (created_by)
  where created_by is not null;

create index record_deletion_audit_deleted_by_idx
  on public.record_deletion_audit (deleted_by)
  where deleted_by is not null;
