-- The owner confirmed that the May 9 Venmo withdrawal moved business cash
-- into the historical Bank of America checking account ending in 8010. That
-- account later funded the May 22 BTC purchase. Record the movement as a
-- cash-to-cash transfer so it has no effect on revenue, expense, or equity.

do $$
declare
  target_business_id bigint;
  stump_line_id bigint;
  cash_account_id bigint;
  venmo_account_id bigint;
  bofa_holding_account_id bigint;
  target_outgoing_transaction_id bigint;
  journal_id bigint;
  correction_time timestamptz := now();
  transfer_description text := 'Venmo to historical Bank of America business funds for May 22 BTC purchase';
begin
  select business_id into strict target_business_id
  from public.business_identity_settings
  where legal_name = 'Demi Solutions LLC';

  select id into strict stump_line_id
  from public.business_lines
  where business_id = target_business_id and code = 'stump_grinding';

  select id into strict cash_account_id
  from public.ledger_accounts
  where business_id = target_business_id and system_key = 'cash';

  select id into strict venmo_account_id
  from public.bank_accounts
  where business_id = target_business_id and name = 'Venmo';

  select id into bofa_holding_account_id
  from public.bank_accounts
  where business_id = target_business_id
    and institution = 'Bank of America'
    and account_type = 'checking'
    and last_four = '8010'
  order by id
  limit 1;

  if bofa_holding_account_id is null then
    insert into public.bank_accounts
      (business_id, business_line_id, name, institution, account_type,
       last_four, active, purpose)
    values
      (target_business_id, stump_line_id,
       'Historical Bank of America business funds (*8010)',
       'Bank of America', 'checking', '8010', false,
       'Business funds temporarily held in personal checking and used for historical crypto purchases')
    returning id into bofa_holding_account_id;
  else
    update public.bank_accounts
    set business_line_id = coalesce(business_line_id, stump_line_id),
        active = false,
        purpose = 'Business funds temporarily held in personal checking and used for historical crypto purchases'
    where business_id = target_business_id and id = bofa_holding_account_id;
  end if;

  select transaction.id into strict target_outgoing_transaction_id
  from public.bank_transactions transaction
  where transaction.business_id = target_business_id
    and transaction.account_id = venmo_account_id
    and transaction.transaction_date = date '2026-05-09'
    and transaction.amount = -150.00
    and transaction.description like 'Standard Transfer · BANK OF AMERICA%'
  for update;

  if exists (
    select 1
    from public.journal_entries entry
    where entry.business_id = target_business_id
      and entry.entry_date = date '2026-05-09'
      and entry.description = transfer_description
      and entry.source_type = 'transfer'
      and entry.status = 'posted'
  ) then
    update public.bank_transactions
    set status = 'matched', reviewed_at = coalesce(reviewed_at, correction_time),
        reviewed_by = null, excluded_reason = null
    where business_id = target_business_id and id = target_outgoing_transaction_id;
    return;
  end if;

  if exists (
    select 1 from public.bank_transaction_allocations allocation
    where allocation.business_id = target_business_id
      and allocation.bank_transaction_id = target_outgoing_transaction_id
      and allocation.voided_at is null
  ) then
    raise exception 'The May 9 Venmo transfer has an active allocation and cannot be reconciled automatically.';
  end if;

  if exists (
    select 1 from public.bank_transfer_links transfer
    where transfer.business_id = target_business_id
      and transfer.outgoing_transaction_id = target_outgoing_transaction_id
      and transfer.status = 'active'
  ) then
    raise exception 'The May 9 Venmo transfer is already linked to another bank transaction.';
  end if;

  insert into public.journal_entries
    (business_id, business_line_id, entry_date, description,
     source_type, source_id)
  values
    (target_business_id, stump_line_id, date '2026-05-09',
     transfer_description, 'transfer', null)
  returning id into journal_id;

  insert into public.journal_lines
    (business_id, journal_entry_id, account_id, debit, credit,
     memo, bank_account_id)
  values
    (target_business_id, journal_id, cash_account_id, 150.00, 0,
     'Business cash received in historical Bank of America checking',
     bofa_holding_account_id),
    (target_business_id, journal_id, cash_account_id, 0, 150.00,
     'Business cash transferred out of Venmo', venmo_account_id);

  update public.bank_transactions
  set status = 'matched', reviewed_at = correction_time,
      reviewed_by = null, excluded_reason = null
  where business_id = target_business_id and id = target_outgoing_transaction_id;
end;
$$;
