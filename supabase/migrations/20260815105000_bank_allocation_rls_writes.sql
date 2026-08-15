create policy journal_entries_admin_insert
  on public.journal_entries for insert to authenticated
  with check ((select private.is_business_admin(business_id)));

create policy journal_lines_admin_insert
  on public.journal_lines for insert to authenticated
  with check ((select private.is_business_admin(business_id)));

create or replace function public.add_bank_transaction_allocation(
  target_business_id bigint, target_bank_transaction_id bigint, target_ledger_account_id bigint,
  allocation_amount numeric, allocation_memo text, allocation_tax_category text default null,
  allocation_deductible_percent numeric default 100
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  bank_record record;
  account_record record;
  allocated numeric;
  allocation_id bigint;
  journal_id bigint;
  cash_account_id bigint;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if allocation_amount <= 0 then raise exception 'Allocation amount must be greater than zero.'; end if;
  if nullif(trim(allocation_memo), '') is null then raise exception 'Allocation memo is required.'; end if;
  if allocation_deductible_percent < 0 or allocation_deductible_percent > 100 then
    raise exception 'Deductible percentage must be between 0 and 100.';
  end if;
  select * into bank_record from public.bank_transactions
  where business_id = target_business_id and id = target_bank_transaction_id for update;
  if bank_record.id is null then raise exception 'Bank transaction not found.'; end if;
  perform private.assert_accounting_period_open(target_business_id, bank_record.transaction_date);
  if bank_record.status in ('matched', 'excluded') then raise exception 'This bank transaction is already fully reviewed.'; end if;
  if exists (select 1 from public.expenses where business_id = target_business_id and bank_transaction_id = target_bank_transaction_id and voided_at is null)
    or exists (select 1 from public.payments where business_id = target_business_id and bank_transaction_id = target_bank_transaction_id and voided_at is null) then
    raise exception 'This bank transaction is already linked to a business record.';
  end if;
  select * into account_record from public.ledger_accounts
  where business_id = target_business_id and id = target_ledger_account_id and active = true;
  if account_record.id is null then raise exception 'Ledger account not found.'; end if;
  if account_record.system_key = 'cash' then raise exception 'Choose the other side of the transaction, not Cash and bank.'; end if;
  select coalesce(sum(amount), 0) into allocated from public.bank_transaction_allocations
  where business_id = target_business_id and bank_transaction_id = target_bank_transaction_id and voided_at is null;
  if allocated + allocation_amount > abs(bank_record.amount) + 0.005 then
    raise exception 'Allocations cannot exceed the bank transaction amount.';
  end if;
  select id into cash_account_id from public.ledger_accounts
  where business_id = target_business_id and system_key = 'cash' and active = true;
  if cash_account_id is null then raise exception 'The Cash and bank bookkeeping account is missing. Complete bookkeeping setup first.'; end if;
  insert into public.bank_transaction_allocations
    (business_id, bank_transaction_id, ledger_account_id, amount, memo, tax_category, deductible_percent, created_by)
  values (target_business_id, target_bank_transaction_id, target_ledger_account_id, allocation_amount,
    trim(allocation_memo), nullif(trim(allocation_tax_category), ''), allocation_deductible_percent, auth.uid())
  returning id into allocation_id;
  insert into public.journal_entries (business_id, entry_date, description, source_type, source_id, created_by)
  values (target_business_id, bank_record.transaction_date, trim(allocation_memo), 'allocation', allocation_id, auth.uid())
  returning id into journal_id;
  if bank_record.amount < 0 then
    insert into public.journal_lines (business_id, journal_entry_id, account_id, debit, credit, memo, bank_account_id)
    values
      (target_business_id, journal_id, target_ledger_account_id, allocation_amount, 0, trim(allocation_memo), null),
      (target_business_id, journal_id, cash_account_id, 0, allocation_amount, trim(allocation_memo), bank_record.account_id);
  else
    insert into public.journal_lines (business_id, journal_entry_id, account_id, debit, credit, memo, bank_account_id)
    values
      (target_business_id, journal_id, cash_account_id, allocation_amount, 0, trim(allocation_memo), bank_record.account_id),
      (target_business_id, journal_id, target_ledger_account_id, 0, allocation_amount, trim(allocation_memo), null);
  end if;
  allocated := allocated + allocation_amount;
  update public.bank_transactions
  set status = case when abs(allocated - abs(amount)) <= 0.005 then 'matched' else 'partially_matched' end,
      reviewed_at = case when abs(allocated - abs(amount)) <= 0.005 then now() else null end,
      reviewed_by = case when abs(allocated - abs(amount)) <= 0.005 then auth.uid() else null end,
      excluded_reason = null
  where business_id = target_business_id and id = target_bank_transaction_id;
  return allocation_id;
end;
$$;

revoke all on function public.add_bank_transaction_allocation(bigint, bigint, bigint, numeric, text, text, numeric)
  from public, anon;
grant execute on function public.add_bank_transaction_allocation(bigint, bigint, bigint, numeric, text, text, numeric)
  to authenticated;
