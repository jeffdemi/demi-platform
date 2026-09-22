-- Transfers use existing bookkeeping setup; never insert ledger accounts under caller privileges.
-- Preserve SECURITY INVOKER, tenant checks, row locks, period checks and atomic posting.
create or replace function public.create_bank_transfer(
  target_business_id bigint, target_outgoing_transaction_id bigint,
  target_incoming_transaction_id bigint, target_memo text default null
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  outgoing_record record;
  incoming_record record;
  transfer_id bigint;
  journal_id bigint;
  cash_account_id bigint;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  select * into outgoing_record from public.bank_transactions
  where business_id = target_business_id and id = target_outgoing_transaction_id for update;
  select * into incoming_record from public.bank_transactions
  where business_id = target_business_id and id = target_incoming_transaction_id for update;
  if outgoing_record.id is null or incoming_record.id is null then raise exception 'Both transfer transactions are required.'; end if;
  if outgoing_record.amount >= 0 or incoming_record.amount <= 0 then raise exception 'Choose one withdrawal and one deposit.'; end if;
  if outgoing_record.account_id = incoming_record.account_id then raise exception 'A transfer must move between different accounts.'; end if;
  if abs(abs(outgoing_record.amount) - incoming_record.amount) > 0.005 then raise exception 'Transfer amounts must match.'; end if;
  if outgoing_record.status <> 'unreviewed' or incoming_record.status <> 'unreviewed' then raise exception 'Both transfer transactions must be unreviewed.'; end if;
  perform private.assert_accounting_period_open(target_business_id, outgoing_record.transaction_date);
  perform private.assert_accounting_period_open(target_business_id, incoming_record.transaction_date);
  select id into cash_account_id from public.ledger_accounts where business_id = target_business_id and system_key = 'cash' and active = true;
  if cash_account_id is null then
    raise exception 'The Cash and bank bookkeeping account is missing. Complete bookkeeping setup first.';
  end if;
  insert into public.bank_transfer_links
    (business_id, outgoing_transaction_id, incoming_transaction_id, transfer_date, amount, memo, created_by)
  values (target_business_id, outgoing_record.id, incoming_record.id,
    greatest(outgoing_record.transaction_date, incoming_record.transaction_date), incoming_record.amount,
    nullif(trim(target_memo), ''), auth.uid()) returning id into transfer_id;
  insert into public.journal_entries (business_id, entry_date, description, source_type, source_id, created_by)
  values (target_business_id, greatest(outgoing_record.transaction_date, incoming_record.transaction_date),
    coalesce(nullif(trim(target_memo), ''), 'Transfer between business accounts'), 'transfer', transfer_id, auth.uid())
  returning id into journal_id;
  insert into public.journal_lines (business_id, journal_entry_id, account_id, debit, credit, memo, bank_account_id)
  values
    (target_business_id, journal_id, cash_account_id, incoming_record.amount, 0, 'Transfer in', incoming_record.account_id),
    (target_business_id, journal_id, cash_account_id, 0, incoming_record.amount, 'Transfer out', outgoing_record.account_id);
  update public.bank_transactions set status = 'matched', reviewed_at = now(), reviewed_by = auth.uid()
  where business_id = target_business_id and id in (outgoing_record.id, incoming_record.id);
  return transfer_id;
end;
$$;

