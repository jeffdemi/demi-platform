-- The owner confirmed that the $588.50 Venmo withdrawal on April 23 passed
-- through the historical Bank of America checking account and funded the
-- exact $588.50 equipment-card payment on April 26. Replace the temporary
-- owner-contribution classification with one auditable internal transfer.

do $$
declare
  target_business_id bigint;
  stump_line_id bigint;
  cash_account_id bigint;
  outgoing_transaction_id bigint;
  incoming_transaction_id bigint;
  owner_allocation_id bigint;
  transfer_id bigint;
  journal_id bigint;
  correction_time timestamptz := now();
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

  select transaction.id into strict outgoing_transaction_id
  from public.bank_transactions transaction
  join public.bank_accounts account
    on account.business_id = transaction.business_id
   and account.id = transaction.account_id
  where transaction.business_id = target_business_id
    and account.name = 'Venmo'
    and transaction.transaction_date = date '2026-04-23'
    and transaction.amount = -588.50
    and transaction.description like 'Standard Transfer · BANK OF AMERICA%';

  select transaction.id into strict incoming_transaction_id
  from public.bank_transactions transaction
  join public.bank_accounts account
    on account.business_id = transaction.business_id
   and account.id = transaction.account_id
  where transaction.business_id = target_business_id
    and account.name = 'Equipment Credit Card'
    and transaction.transaction_date = date '2026-04-26'
    and transaction.amount = 588.50
    and transaction.description = 'ONLINE PAYMENT FROM CHK 8';

  select allocation.id into strict owner_allocation_id
  from public.bank_transaction_allocations allocation
  join public.ledger_accounts ledger
    on ledger.business_id = allocation.business_id
   and ledger.id = allocation.ledger_account_id
  where allocation.business_id = target_business_id
    and allocation.bank_transaction_id = incoming_transaction_id
    and allocation.voided_at is null
    and allocation.amount = 588.50
    and ledger.system_key = 'owner_contributions';

  update public.bank_transaction_allocations
  set voided_at = correction_time,
      void_reason = 'Owner confirmed this card payment was funded by the April 23 Venmo transfer through Bank of America checking.'
  where business_id = target_business_id and id = owner_allocation_id;

  update public.journal_entries
  set status = 'void'
  where business_id = target_business_id
    and source_type = 'allocation'
    and source_id = owner_allocation_id
    and status = 'posted';

  insert into public.bank_transfer_links
    (business_id, outgoing_transaction_id, incoming_transaction_id,
     transfer_date, amount, memo)
  values
    (target_business_id, outgoing_transaction_id, incoming_transaction_id,
     date '2026-04-26', 588.50,
     'Venmo to Bank of America checking, then equipment-card payment')
  returning id into transfer_id;

  insert into public.journal_entries
    (business_id, business_line_id, entry_date, description,
     source_type, source_id)
  values
    (target_business_id, stump_line_id, date '2026-04-26',
     'Venmo transfer through Bank of America to equipment card',
     'transfer', transfer_id)
  returning id into journal_id;

  insert into public.journal_lines
    (business_id, journal_entry_id, account_id, debit, credit,
     memo, bank_account_id)
  select target_business_id, journal_id, cash_account_id,
         line.debit, line.credit, line.memo, line.bank_account_id
  from (
    values
      (588.50::numeric, 0::numeric, 'Transfer into equipment card',
       (select account_id from public.bank_transactions
        where business_id = target_business_id and id = incoming_transaction_id)),
      (0::numeric, 588.50::numeric, 'Transfer out of Venmo',
       (select account_id from public.bank_transactions
        where business_id = target_business_id and id = outgoing_transaction_id))
  ) as line(debit, credit, memo, bank_account_id);

  update public.bank_transactions
  set status = 'matched',
      reviewed_at = correction_time,
      reviewed_by = null,
      excluded_reason = null
  where business_id = target_business_id
    and id in (outgoing_transaction_id, incoming_transaction_id);
end;
$$;
