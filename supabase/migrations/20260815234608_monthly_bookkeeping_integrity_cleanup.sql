-- Make source-journal dimensions durable across later edits and correct
-- bookkeeping rows that are unambiguously resolved by the source records.

create or replace function private.validate_expense_bank_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  bank_amount numeric;
begin
  if new.bank_transaction_id is null or new.voided_at is not null then return new; end if;

  select amount into bank_amount
  from public.bank_transactions
  where business_id = new.business_id and id = new.bank_transaction_id;

  if bank_amount is null or abs(bank_amount) <> new.amount
     or (new.transaction_type = 'refund' and bank_amount <= 0)
     or (new.transaction_type <> 'refund' and bank_amount >= 0) then
    raise exception 'The bank transaction direction and amount must match the expense or refund.';
  end if;
  return new;
end;
$$;

revoke all on function private.validate_expense_bank_match() from public, anon, authenticated;

create or replace function private.tag_source_bank_account_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  update public.journal_entries
  set business_line_id = new.business_line_id
  where business_id = new.business_id and source_type = tg_argv[0]
    and source_id = new.id and status = 'posted';

  if new.bank_transaction_id is null then return new; end if;

  update public.journal_lines jl
  set bank_account_id = bt.account_id
  from public.journal_entries je, public.ledger_accounts la, public.bank_transactions bt
  where je.business_id = new.business_id and je.source_type = tg_argv[0]
    and je.source_id = new.id and je.status = 'posted'
    and jl.business_id = je.business_id and jl.journal_entry_id = je.id
    and la.business_id = jl.business_id and la.id = jl.account_id and la.system_key = 'cash'
    and bt.business_id = new.business_id and bt.id = new.bank_transaction_id;
  return new;
end;
$$;

revoke all on function private.tag_source_bank_account_journal() from public, anon, authenticated;

drop trigger if exists z_expenses_tag_bank_account_journal on public.expenses;
create trigger z_expenses_tag_bank_account_journal
after insert or update of bank_transaction_id, amount, expense_date, transaction_type,
  financial_classification, refund_of_expense_id, vendor, description,
  payment_method, voided_at, business_line_id on public.expenses
for each row execute function private.tag_source_bank_account_journal('expense');

drop trigger if exists z_payments_tag_bank_account_journal on public.payments;
create trigger z_payments_tag_bank_account_journal
after insert or update of bank_transaction_id, payment_date, amount, reference,
  voided_at, business_line_id on public.payments
for each row execute function private.tag_source_bank_account_journal('payment');

-- Backfill dimensions lost when classification or payment edits rebuilt a
-- previously matched journal after the original dimension-tagging trigger ran.
update public.journal_entries je
set business_line_id = e.business_line_id
from public.expenses e
where je.business_id = e.business_id and je.source_type = 'expense'
  and je.source_id = e.id and je.status = 'posted'
  and je.business_line_id is distinct from e.business_line_id;

update public.journal_entries je
set business_line_id = p.business_line_id
from public.payments p
where je.business_id = p.business_id and je.source_type = 'payment'
  and je.source_id = p.id and je.status = 'posted'
  and je.business_line_id is distinct from p.business_line_id;

update public.journal_lines jl
set bank_account_id = bt.account_id
from public.journal_entries je, public.ledger_accounts la,
  public.expenses e, public.bank_transactions bt
where je.business_id = e.business_id and je.source_type = 'expense'
  and je.source_id = e.id and je.status = 'posted'
  and e.bank_transaction_id = bt.id and e.business_id = bt.business_id
  and jl.business_id = je.business_id and jl.journal_entry_id = je.id
  and la.business_id = jl.business_id and la.id = jl.account_id
  and la.system_key = 'cash'
  and jl.bank_account_id is distinct from bt.account_id;

update public.journal_lines jl
set bank_account_id = bt.account_id
from public.journal_entries je, public.ledger_accounts la,
  public.payments p, public.bank_transactions bt
where je.business_id = p.business_id and je.source_type = 'payment'
  and je.source_id = p.id and je.status = 'posted'
  and p.bank_transaction_id = bt.id and p.business_id = bt.business_id
  and jl.business_id = je.business_id and jl.journal_entry_id = je.id
  and la.business_id = jl.business_id and la.id = jl.account_id
  and la.system_key = 'cash'
  and jl.bank_account_id is distinct from bt.account_id;

do $$
declare
  target_business_id bigint;
  stump_line_id bigint;
  equipment_card_id bigint;
  venmo_account_id bigint;
  grinder_id bigint;
  trailer_id bigint;
  hiscox_expense_id bigint;
  hiscox_transaction_id bigint;
  trailer_expense_id bigint;
  trailer_transaction_id bigint;
  refund_expense_id bigint;
  refund_transaction_id bigint;
  marsha_payment_id bigint;
  marsha_job_id bigint;
  correction_time timestamptz := now();
begin
  select business_id into strict target_business_id
  from public.business_identity_settings
  where legal_name = 'Demi Solutions LLC';

  select id into strict stump_line_id
  from public.business_lines
  where business_id = target_business_id and code = 'stump_grinding';

  select id into strict equipment_card_id
  from public.bank_accounts
  where business_id = target_business_id and name = 'Equipment Credit Card';

  select id into strict venmo_account_id
  from public.bank_accounts
  where business_id = target_business_id and lower(name) = 'venmo';

  select id into strict grinder_id
  from public.equipment
  where business_id = target_business_id and name = 'Toro STX-26';

  select id into strict trailer_id
  from public.equipment
  where business_id = target_business_id and name = '4x8 Trailer';

  -- These source records describe the same first Hiscox premium. Preserve the
  -- expense record, use the statement amount, and retain the old allocation as
  -- a void audit record instead of counting the premium twice.
  select id into strict hiscox_expense_id
  from public.expenses
  where business_id = target_business_id and voided_at is null
    and lower(vendor) = 'hiscox' and expense_date = date '2026-04-01'
    and amount = 123.00;

  select id into strict hiscox_transaction_id
  from public.bank_transactions
  where business_id = target_business_id and account_id = equipment_card_id
    and transaction_date = date '2026-04-03'
    and description = 'HIS*HISCOX INC' and amount = -123.70;

  update public.expenses
  set amount = 123.70,
      bank_transaction_id = hiscox_transaction_id,
      tax_category = 'Business insurance',
      notes = concat_ws(' ', notes,
        'Reconciled to the $123.70 Bank of America card charge.'),
      updated_at = correction_time
  where id = hiscox_expense_id;

  update public.bank_transaction_allocations
  set voided_at = correction_time,
      void_reason = 'Merged with the existing Hiscox expense; prevents duplicate insurance expense.'
  where business_id = target_business_id
    and bank_transaction_id = hiscox_transaction_id and voided_at is null;

  update public.journal_entries je
  set status = 'void'
  where je.business_id = target_business_id and je.source_type = 'allocation'
    and je.status = 'posted' and exists (
      select 1 from public.bank_transaction_allocations a
      where a.id = je.source_id and a.bank_transaction_id = hiscox_transaction_id
        and a.voided_at is not null
    );

  -- The same-day Tractor Supply charge is the trailer purchase recorded in the
  -- legacy workbook. Preserve one asset at the statement amount and link it to
  -- the equipment register.
  select id into strict trailer_expense_id
  from public.expenses
  where business_id = target_business_id and voided_at is null
    and transaction_type = 'asset' and expense_date = date '2026-04-11'
    and lower(description) = 'trailer' and amount = 2121.00;

  select id into strict trailer_transaction_id
  from public.bank_transactions
  where business_id = target_business_id and account_id = equipment_card_id
    and transaction_date = date '2026-04-11'
    and description = 'TRACTOR SUPPLY #707' and amount = -2121.99;

  update public.expenses
  set amount = 2121.99,
      bank_transaction_id = trailer_transaction_id,
      equipment_id = trailer_id,
      vendor = 'Tractor Supply',
      tax_category = 'Equipment asset',
      notes = concat_ws(' ', notes,
        'Reconciled to the $2,121.99 Bank of America card charge.'),
      updated_at = correction_time
  where id = trailer_expense_id;

  update public.bank_transaction_allocations
  set voided_at = correction_time,
      void_reason = 'Merged with the existing trailer asset; prevents duplicate fixed assets.'
  where business_id = target_business_id
    and bank_transaction_id = trailer_transaction_id and voided_at is null;

  update public.journal_entries je
  set status = 'void'
  where je.business_id = target_business_id and je.source_type = 'allocation'
    and je.status = 'posted' and exists (
      select 1 from public.bank_transaction_allocations a
      where a.id = je.source_id and a.bank_transaction_id = trailer_transaction_id
        and a.voided_at is not null
    );

  update public.expenses
  set equipment_id = grinder_id,
      tax_category = 'Equipment asset',
      updated_at = correction_time
  where business_id = target_business_id and voided_at is null
    and transaction_type = 'asset' and amount = 10200.00
    and lower(description) = 'toro grinder';

  -- The exact Rock Auto deposit is the recorded water-pump refund. Link the
  -- refund and remove the second journal representation.
  select id into strict refund_expense_id
  from public.expenses
  where business_id = target_business_id and voided_at is null
    and transaction_type = 'refund' and amount = 79.24
    and lower(vendor) = 'van parts';

  select id into strict refund_transaction_id
  from public.bank_transactions
  where business_id = target_business_id and account_id = equipment_card_id
    and description = 'ROCK AUTO' and amount = 79.24;

  update public.expenses
  set bank_transaction_id = refund_transaction_id,
      tax_category = 'Repairs and maintenance',
      updated_at = correction_time
  where id = refund_expense_id;

  update public.expenses
  set tax_category = 'Repairs and maintenance', updated_at = correction_time
  where business_id = target_business_id and id = (
    select refund_of_expense_id from public.expenses where id = refund_expense_id
  );

  update public.bank_transaction_allocations
  set voided_at = correction_time,
      void_reason = 'Merged with the existing Rock Auto refund; prevents a duplicate expense reduction.'
  where business_id = target_business_id
    and bank_transaction_id = refund_transaction_id and voided_at is null;

  update public.journal_entries je
  set status = 'void'
  where je.business_id = target_business_id and je.source_type = 'allocation'
    and je.status = 'posted' and exists (
      select 1 from public.bank_transaction_allocations a
      where a.id = je.source_id and a.bank_transaction_id = refund_transaction_id
        and a.voided_at is not null
    );

  -- The Venmo statement supplies the actual cash-receipt date for Marsha's
  -- $160 payment; the legacy import had defaulted it to the job date.
  select p.id, p.job_id into strict marsha_payment_id, marsha_job_id
  from public.payments p
  join public.bank_transactions bt
    on bt.business_id = p.business_id and bt.id = p.bank_transaction_id
  where p.business_id = target_business_id and p.voided_at is null
    and p.amount = 160 and bt.account_id = venmo_account_id
    and bt.transaction_date = date '2026-05-08';

  update public.payments
  set payment_date = date '2026-05-08',
      notes = concat_ws(' ', notes,
        'Receipt date corrected from the imported Venmo statement.'),
      updated_at = correction_time
  where id = marsha_payment_id;

  update public.jobs
  set paid_date = date '2026-05-08', updated_at = correction_time
  where id = marsha_job_id;

  -- The original job ledger and linked paid invoice both show a $200 price.
  update public.jobs j
  set amount_quoted = 200.00, updated_at = correction_time
  where j.business_id = target_business_id and j.job_date = date '2026-07-20'
    and j.amount_quoted = 0 and exists (
      select 1 from public.invoices i
      where i.business_id = j.business_id and i.job_id = j.id
        and i.archived_at is null and i.amount = 200.00
    );

  -- Existing receipt rows created before receipt replacement hardening should
  -- visibly require review instead of appearing unattached or not requested.
  update public.expenses
  set receipt_review_status = 'needs_review',
      receipt_extracted_data = null,
      receipt_reviewed_at = null,
      receipt_reviewed_by = null,
      updated_at = correction_time
  where business_id = target_business_id and voided_at is null
    and receipt_path is not null and receipt_review_status = 'not_requested';

  update public.expenses
  set vendor = 'Cloudflare',
      tax_category = 'Advertising',
      updated_at = correction_time
  where business_id = target_business_id and voided_at is null
    and lower(vendor) = 'cloudfare';

  update public.expenses
  set tax_category = 'Taxes and licenses', updated_at = correction_time
  where business_id = target_business_id and voided_at is null
    and lower(vendor) = 'dmv / notary'
    and lower(description) like '%registration%';

  update public.bank_transaction_allocations a
  set tax_category = case
      when bt.description like 'LUKOIL %' then 'Fuel'
      when bt.description = 'STATE FARM  INSURANCE' then 'Business insurance'
      else a.tax_category
    end
  from public.bank_transactions bt
  where a.business_id = target_business_id and a.voided_at is null
    and bt.business_id = a.business_id and bt.id = a.bank_transaction_id
    and (bt.description like 'LUKOIL %' or bt.description = 'STATE FARM  INSURANCE');

  update public.bank_classification_rules
  set tax_category = case
      when match_text = 'lukoil' then 'Fuel'
      when match_text = 'state farm  insurance' then 'Business insurance'
      else tax_category
    end,
    updated_at = correction_time
  where business_id = target_business_id
    and match_text in ('lukoil', 'state farm  insurance');

  -- Home Depot purchases can be supplies, repairs, or fixed assets, so this
  -- merchant-wide rule is not safe enough for automatic suggestions.
  update public.bank_classification_rules
  set active = false, updated_at = correction_time
  where business_id = target_business_id and match_text = 'home depot';

  -- The empty account is the personal Visa import that was intentionally
  -- removed from the business books.
  update public.bank_accounts
  set active = false, updated_at = correction_time
  where business_id = target_business_id and lower(name) = 'bac visa'
    and not exists (
      select 1 from public.bank_transactions bt
      where bt.business_id = target_business_id and bt.account_id = public.bank_accounts.id
    );

  update public.bank_accounts
  set institution = 'Bank of America', last_four = '3472', updated_at = correction_time
  where id = equipment_card_id;

  update public.bank_accounts
  set institution = 'Venmo',
      purpose = coalesce(purpose, 'Customer payments and transfers to the historical Bank of America holding account'),
      updated_at = correction_time
  where id = venmo_account_id;
end;
$$;
