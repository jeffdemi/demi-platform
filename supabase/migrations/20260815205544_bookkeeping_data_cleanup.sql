-- Correct production bookkeeping classifications that can be resolved from
-- existing linked records without guessing at historical amounts or funding.
do $$
declare
  target_business_id bigint;
  stump_line_id bigint;
  owner_contribution_account_id bigint;
  cash_account_id bigint;
  venmo_account_id bigint;
  equipment_card_id bigint;
  target_transaction record;
  target_allocation record;
  target_payment_id bigint;
  new_allocation_id bigint;
  new_journal_id bigint;
  correction_time timestamptz := now();
begin
  select business_id into strict target_business_id
  from public.business_identity_settings
  where legal_name = 'Demi Solutions LLC';

  select id into strict stump_line_id
  from public.business_lines
  where business_id = target_business_id and code = 'stump_grinding';

  select id into strict owner_contribution_account_id
  from public.ledger_accounts
  where business_id = target_business_id and system_key = 'owner_contributions';

  select id into strict cash_account_id
  from public.ledger_accounts
  where business_id = target_business_id and system_key = 'cash';

  select id into strict venmo_account_id
  from public.bank_accounts
  where business_id = target_business_id and lower(name) = 'venmo';

  select id into strict equipment_card_id
  from public.bank_accounts
  where business_id = target_business_id and name = 'Equipment Credit Card';

  -- Imported Venmo receipts duplicate two existing customer payments. Retain
  -- the customer-payment journals and attach their Venmo account dimension.
  for target_transaction in
    select * from public.bank_transactions
    where business_id = target_business_id and account_id = venmo_account_id
      and amount in (600, 160) and description like 'Payment ·%'
  loop
    select id into strict target_payment_id
    from public.payments
    where business_id = target_business_id and voided_at is null
      and lower(method) = 'venmo' and amount = target_transaction.amount;

    update public.bank_transaction_allocations
    set voided_at = correction_time,
        void_reason = 'Linked imported Venmo receipt to existing customer payment; removes duplicate revenue.'
    where business_id = target_business_id
      and bank_transaction_id = target_transaction.id and voided_at is null;

    update public.journal_entries je
    set status = 'void'
    where je.business_id = target_business_id and je.source_type = 'allocation'
      and je.status = 'posted' and exists (
        select 1 from public.bank_transaction_allocations a
        where a.id = je.source_id and a.bank_transaction_id = target_transaction.id
      );

    update public.payments
    set bank_transaction_id = target_transaction.id,
        business_line_id = stump_line_id,
        updated_at = correction_time
    where id = target_payment_id;

    update public.journal_lines jl
    set bank_account_id = venmo_account_id
    from public.journal_entries je, public.ledger_accounts la
    where je.business_id = target_business_id and je.source_type = 'payment'
      and je.source_id = target_payment_id and je.status = 'posted'
      and jl.journal_entry_id = je.id
      and la.id = jl.account_id and la.system_key = 'cash';

    update public.bank_transactions
    set status = 'matched', reviewed_at = correction_time
    where id = target_transaction.id;
  end loop;

  -- Personal-checking payments of the business credit card are owner
  -- contributions, not additional customer revenue.
  for target_allocation in
    select a.*
    from public.bank_transaction_allocations a
    join public.bank_transactions bt on bt.id = a.bank_transaction_id
    join public.ledger_accounts la on la.id = a.ledger_account_id
    where a.business_id = target_business_id and a.voided_at is null
      and bt.account_id = equipment_card_id
      and bt.description = 'ONLINE PAYMENT FROM CHK 8'
      and bt.amount in (588.50, 400.00)
      and la.system_key = 'service_revenue'
  loop
    update public.bank_transaction_allocations
    set voided_at = correction_time,
        void_reason = 'Credit-card payment from personal checking reclassified from revenue to owner contribution.'
    where id = target_allocation.id;

    update public.journal_entries
    set status = 'void'
    where business_id = target_business_id and source_type = 'allocation'
      and source_id = target_allocation.id and status = 'posted';

    insert into public.bank_transaction_allocations
      (business_id, bank_transaction_id, ledger_account_id, amount, memo,
       tax_category, deductible_percent, created_by, business_line_id)
    values
      (target_business_id, target_allocation.bank_transaction_id,
       owner_contribution_account_id, target_allocation.amount,
       'Business credit card paid from personal checking', null, 0,
       target_allocation.created_by, stump_line_id)
    returning id into new_allocation_id;

    insert into public.journal_entries
      (business_id, entry_date, description, source_type, source_id, created_by, business_line_id)
    select target_business_id, bt.transaction_date,
      'Business credit card paid from personal checking', 'allocation',
      new_allocation_id, target_allocation.created_by, stump_line_id
    from public.bank_transactions bt where bt.id = target_allocation.bank_transaction_id
    returning id into new_journal_id;

    insert into public.journal_lines
      (business_id, journal_entry_id, account_id, debit, credit, memo, bank_account_id)
    values
      (target_business_id, new_journal_id, cash_account_id, target_allocation.amount, 0,
       'Business credit card paid from personal checking', equipment_card_id),
      (target_business_id, new_journal_id, owner_contribution_account_id, 0, target_allocation.amount,
       'Business credit card paid from personal checking', null);
  end loop;

  -- Venmo withdrawals to the historical Bank of America holding account are
  -- transfers, not revenue. Reopen them until the receiving side and crypto
  -- clearing activity are available for a proper transfer reconciliation.
  for target_transaction in
    select * from public.bank_transactions
    where business_id = target_business_id and account_id = venmo_account_id
      and amount in (-588.50, -150.00)
      and description like 'Standard Transfer · BANK OF AMERICA%'
  loop
    update public.bank_transaction_allocations
    set voided_at = correction_time,
        void_reason = 'Venmo-to-Bank-of-America movement is a transfer, not revenue; awaiting receiving-side reconciliation.'
    where business_id = target_business_id
      and bank_transaction_id = target_transaction.id and voided_at is null;

    update public.journal_entries je
    set status = 'void'
    where je.business_id = target_business_id and je.source_type = 'allocation'
      and je.status = 'posted' and exists (
        select 1 from public.bank_transaction_allocations a
        where a.id = je.source_id and a.bank_transaction_id = target_transaction.id
      );

    update public.bank_transactions
    set status = 'unreviewed', reviewed_at = null, reviewed_by = null
    where id = target_transaction.id;
  end loop;

  -- Current operating history predates Federal IT activity; consistently
  -- assign it to the stump-grinding segment, including Cloudflare's domain.
  update public.expenses
  set business_line_id = stump_line_id, updated_at = correction_time
  where business_id = target_business_id and voided_at is null and business_line_id is null;

  update public.bank_transaction_allocations
  set business_line_id = stump_line_id
  where business_id = target_business_id and voided_at is null and business_line_id is null;

  update public.digital_asset_transactions
  set business_line_id = stump_line_id
  where business_id = target_business_id and business_line_id is null;

  update public.journal_entries je
  set business_line_id = e.business_line_id
  from public.expenses e
  where je.business_id = target_business_id and je.status = 'posted'
    and je.source_type = 'expense' and je.source_id = e.id and je.business_line_id is null;

  update public.journal_entries je
  set business_line_id = p.business_line_id
  from public.payments p
  where je.business_id = target_business_id and je.status = 'posted'
    and je.source_type = 'payment' and je.source_id = p.id and je.business_line_id is null;

  update public.journal_entries je
  set business_line_id = a.business_line_id
  from public.bank_transaction_allocations a
  where je.business_id = target_business_id and je.status = 'posted'
    and je.source_type = 'allocation' and je.source_id = a.id and je.business_line_id is null;

  -- Learned text rules are not account-scoped. Disable broad payment/transfer
  -- rules so they cannot recreate revenue or contribution mistakes elsewhere.
  update public.bank_classification_rules
  set active = false, updated_at = correction_time
  where business_id = target_business_id and active = true
    and lower(match_text) in (
      'venmo', 'online payment', 'online payment from chk',
      'online payment from chk 8', 'online scheduled payment',
      'standard transfer · bank of america n.a. *8010'
    );
end;
$$;
