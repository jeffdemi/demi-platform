-- Bookkeeping and month-end close foundation.
-- All changes are additive or constraint-expanding and preserve existing records.

alter table public.monthly_financial_snapshots
  add column close_status text not null default 'open'
    check (close_status in ('open', 'closed')),
  add column closed_at timestamptz,
  add column closed_by uuid references auth.users(id) on delete set null,
  add column reopened_at timestamptz,
  add column reopened_by uuid references auth.users(id) on delete set null,
  add column reopen_reason text,
  add constraint monthly_snapshot_close_fields_check check (
    close_status = 'open'
    or (close_status = 'closed' and closed_at is not null and closed_by is not null)
  );

create index monthly_snapshots_business_close_status_idx
  on public.monthly_financial_snapshots (business_id, close_status, period_month desc);

create table public.bank_statement_periods (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  statement_start_date date not null,
  statement_end_date date not null,
  opening_balance numeric(12, 2) not null,
  closing_balance numeric(12, 2) not null,
  notes text,
  status text not null default 'draft'
    check (status in ('draft', 'reconciled', 'closed')),
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  closed_at timestamptz,
  closed_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, account_id, statement_end_date),
  foreign key (business_id, account_id)
    references public.bank_accounts(business_id, id),
  check (statement_end_date >= statement_start_date),
  check (status = 'draft' or (reconciled_at is not null and reconciled_by is not null)),
  check (status <> 'closed' or (closed_at is not null and closed_by is not null))
);

alter table public.bank_transactions
  add column statement_period_id bigint,
  add constraint bank_transactions_statement_period_fkey
    foreign key (business_id, statement_period_id)
    references public.bank_statement_periods(business_id, id);

alter table public.bank_transactions
  drop constraint bank_transactions_status_check,
  add constraint bank_transactions_status_check
    check (status in ('unreviewed', 'partially_matched', 'matched', 'excluded'));

create index bank_statement_periods_business_status_idx
  on public.bank_statement_periods (business_id, status, statement_end_date desc);
create index bank_statement_periods_account_dates_idx
  on public.bank_statement_periods (business_id, account_id, statement_start_date, statement_end_date);
create index bank_transactions_statement_period_idx
  on public.bank_transactions (business_id, statement_period_id, transaction_date, id)
  where statement_period_id is not null;

alter table public.journal_lines
  add column bank_account_id bigint,
  add constraint journal_lines_bank_account_fkey
    foreign key (business_id, bank_account_id)
    references public.bank_accounts(business_id, id);

create index journal_lines_bank_account_idx
  on public.journal_lines (business_id, bank_account_id, journal_entry_id)
  where bank_account_id is not null;

alter table public.journal_entries
  drop constraint journal_entries_source_type_check,
  add constraint journal_entries_source_type_check
    check (source_type in ('expense', 'payment', 'adjustment', 'allocation', 'transfer'));

create table public.bank_transaction_allocations (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  bank_transaction_id bigint not null,
  ledger_account_id bigint not null,
  amount numeric(12, 2) not null check (amount > 0),
  memo text not null check (nullif(trim(memo), '') is not null),
  tax_category text,
  deductible_percent numeric(5, 2) not null default 100
    check (deductible_percent between 0 and 100),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  unique (business_id, id),
  foreign key (business_id, bank_transaction_id)
    references public.bank_transactions(business_id, id),
  foreign key (business_id, ledger_account_id)
    references public.ledger_accounts(business_id, id),
  check (voided_at is null or nullif(trim(void_reason), '') is not null)
);

create index bank_transaction_allocations_transaction_idx
  on public.bank_transaction_allocations (business_id, bank_transaction_id, id)
  where voided_at is null;
create index bank_transaction_allocations_account_idx
  on public.bank_transaction_allocations (business_id, ledger_account_id, created_at desc)
  where voided_at is null;

create table public.bank_transfer_links (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  outgoing_transaction_id bigint not null,
  incoming_transaction_id bigint not null,
  transfer_date date not null,
  amount numeric(12, 2) not null check (amount > 0),
  memo text,
  status text not null default 'active' check (status in ('active', 'void')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  unique (business_id, id),
  foreign key (business_id, outgoing_transaction_id)
    references public.bank_transactions(business_id, id),
  foreign key (business_id, incoming_transaction_id)
    references public.bank_transactions(business_id, id),
  check (outgoing_transaction_id <> incoming_transaction_id),
  check (status = 'active' or (voided_at is not null and nullif(trim(void_reason), '') is not null))
);

create unique index bank_transfer_links_outgoing_active_idx
  on public.bank_transfer_links (business_id, outgoing_transaction_id)
  where status = 'active';
create unique index bank_transfer_links_incoming_active_idx
  on public.bank_transfer_links (business_id, incoming_transaction_id)
  where status = 'active';

create table public.bookkeeping_adjustments (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  entry_date date not null,
  description text not null check (nullif(trim(description), '') is not null),
  debit_account_id bigint not null,
  credit_account_id bigint not null,
  amount numeric(12, 2) not null check (amount > 0),
  reason text not null check (nullif(trim(reason), '') is not null),
  status text not null default 'posted' check (status in ('posted', 'void')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  unique (business_id, id),
  foreign key (business_id, debit_account_id)
    references public.ledger_accounts(business_id, id),
  foreign key (business_id, credit_account_id)
    references public.ledger_accounts(business_id, id),
  check (debit_account_id <> credit_account_id),
  check (status = 'posted' or (voided_at is not null and nullif(trim(void_reason), '') is not null))
);

create index bookkeeping_adjustments_business_date_idx
  on public.bookkeeping_adjustments (business_id, entry_date desc, id desc)
  where status = 'posted';

create trigger bank_statement_periods_set_updated_at
  before update on public.bank_statement_periods
  for each row execute function private.set_updated_at();

alter table public.bank_statement_periods enable row level security;
alter table public.bank_transaction_allocations enable row level security;
alter table public.bank_transfer_links enable row level security;
alter table public.bookkeeping_adjustments enable row level security;

create policy bank_statement_periods_admin_access on public.bank_statement_periods for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy bank_transaction_allocations_admin_access on public.bank_transaction_allocations for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy bank_transfer_links_admin_access on public.bank_transfer_links for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy bookkeeping_adjustments_admin_access on public.bookkeeping_adjustments for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));

grant select, insert, update on public.bank_statement_periods,
  public.bank_transaction_allocations, public.bank_transfer_links,
  public.bookkeeping_adjustments to authenticated;
grant usage, select on sequence public.bank_statement_periods_id_seq,
  public.bank_transaction_allocations_id_seq, public.bank_transfer_links_id_seq,
  public.bookkeeping_adjustments_id_seq to authenticated;

create or replace function private.ensure_default_ledger_accounts(target_business_id bigint)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  insert into public.ledger_accounts
    (business_id, code, name, account_type, normal_balance, system_key)
  values
    (target_business_id, '1000', 'Cash and bank', 'asset', 'debit', 'cash'),
    (target_business_id, '1100', 'Accounts receivable', 'asset', 'debit', 'accounts_receivable'),
    (target_business_id, '1500', 'Equipment and fixed assets', 'asset', 'debit', 'fixed_assets'),
    (target_business_id, '1590', 'Accumulated depreciation', 'asset', 'credit', 'accumulated_depreciation'),
    (target_business_id, '2000', 'Accounts payable', 'liability', 'credit', 'accounts_payable'),
    (target_business_id, '2100', 'Credit cards payable', 'liability', 'credit', 'credit_cards_payable'),
    (target_business_id, '2200', 'Taxes payable', 'liability', 'credit', 'taxes_payable'),
    (target_business_id, '2300', 'Loans payable', 'liability', 'credit', 'loans_payable'),
    (target_business_id, '3000', 'Owner equity', 'equity', 'credit', 'owner_equity'),
    (target_business_id, '3100', 'Owner contributions', 'equity', 'credit', 'owner_contributions'),
    (target_business_id, '3200', 'Owner distributions', 'equity', 'debit', 'owner_distributions'),
    (target_business_id, '4000', 'Service revenue', 'revenue', 'credit', 'service_revenue'),
    (target_business_id, '4100', 'Other income', 'revenue', 'credit', 'other_income'),
    (target_business_id, '5000', 'Cost of goods sold', 'expense', 'debit', 'cogs'),
    (target_business_id, '6000', 'Operating expenses', 'expense', 'debit', 'operating_expense'),
    (target_business_id, '6100', 'Labor expense', 'expense', 'debit', 'labor_expense'),
    (target_business_id, '6200', 'Interest expense', 'expense', 'debit', 'interest_expense'),
    (target_business_id, '6300', 'Depreciation expense', 'expense', 'debit', 'depreciation_expense')
  on conflict (business_id, system_key) do nothing;
end;
$$;

create or replace function private.assert_accounting_period_open(target_business_id bigint, target_date date)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if exists (
    select 1 from public.monthly_financial_snapshots
    where business_id = target_business_id
      and period_month = date_trunc('month', target_date)::date
      and close_status = 'closed'
  ) then
    raise exception 'This accounting month is closed. Reopen it before changing dated records.';
  end if;
end;
$$;

create or replace function private.prevent_closed_period_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  record_date date;
  record_business_id bigint;
  record_data jsonb;
begin
  if tg_op = 'DELETE' then
    record_data := to_jsonb(old);
  else
    record_data := to_jsonb(new);
  end if;
  record_business_id := (record_data ->> 'business_id')::bigint;
  record_date := (record_data ->> tg_argv[0])::date;
  if record_date is not null then
    perform private.assert_accounting_period_open(record_business_id, record_date);
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger expenses_period_open_guard before insert or update or delete on public.expenses
  for each row execute function private.prevent_closed_period_change('expense_date');
create trigger payments_period_open_guard before insert or update or delete on public.payments
  for each row execute function private.prevent_closed_period_change('payment_date');
create trigger bank_transactions_period_open_guard before insert or update or delete on public.bank_transactions
  for each row execute function private.prevent_closed_period_change('transaction_date');
create trigger labor_entries_period_open_guard before insert or update or delete on public.labor_entries
  for each row execute function private.prevent_closed_period_change('period_end');
create trigger owner_compensation_period_open_guard before insert or update or delete on public.owner_compensation_periods
  for each row execute function private.prevent_closed_period_change('period_month');
create trigger bookkeeping_adjustments_period_open_guard before insert or update or delete on public.bookkeeping_adjustments
  for each row execute function private.prevent_closed_period_change('entry_date');

create or replace function private.tag_source_bank_account_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
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

create trigger z_expenses_tag_bank_account_journal
  after insert or update of bank_transaction_id, amount, expense_date on public.expenses
  for each row execute function private.tag_source_bank_account_journal('expense');
create trigger z_payments_tag_bank_account_journal
  after insert or update of bank_transaction_id, amount, payment_date on public.payments
  for each row execute function private.tag_source_bank_account_journal('payment');

-- Attribute existing matched cash journal lines without changing financial values.
update public.journal_lines jl
set bank_account_id = bt.account_id
from public.journal_entries je, public.ledger_accounts la, public.expenses e, public.bank_transactions bt
where je.business_id = e.business_id and je.source_type = 'expense' and je.source_id = e.id and je.status = 'posted'
  and e.bank_transaction_id is not null and bt.business_id = e.business_id and bt.id = e.bank_transaction_id
  and jl.business_id = je.business_id and jl.journal_entry_id = je.id
  and la.business_id = jl.business_id and la.id = jl.account_id and la.system_key = 'cash';

update public.journal_lines jl
set bank_account_id = bt.account_id
from public.journal_entries je, public.ledger_accounts la, public.payments p, public.bank_transactions bt
where je.business_id = p.business_id and je.source_type = 'payment' and je.source_id = p.id and je.status = 'posted'
  and p.bank_transaction_id is not null and bt.business_id = p.business_id and bt.id = p.bank_transaction_id
  and jl.business_id = je.business_id and jl.journal_entry_id = je.id
  and la.business_id = jl.business_id and la.id = jl.account_id and la.system_key = 'cash';

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
  perform private.ensure_default_ledger_accounts(target_business_id);
  select id into cash_account_id from public.ledger_accounts where business_id = target_business_id and system_key = 'cash';
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

create or replace function public.void_bank_transaction_allocation(
  target_business_id bigint, target_allocation_id bigint, target_reason text
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  allocation_record record;
  bank_record record;
  allocated numeric;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if nullif(trim(target_reason), '') is null then raise exception 'A correction reason is required.'; end if;
  select * into allocation_record from public.bank_transaction_allocations
  where business_id = target_business_id and id = target_allocation_id and voided_at is null for update;
  if allocation_record.id is null then raise exception 'Allocation not found.'; end if;
  select * into bank_record from public.bank_transactions
  where business_id = target_business_id and id = allocation_record.bank_transaction_id for update;
  perform private.assert_accounting_period_open(target_business_id, bank_record.transaction_date);
  update public.bank_transaction_allocations set voided_at = now(), voided_by = auth.uid(), void_reason = trim(target_reason)
  where business_id = target_business_id and id = target_allocation_id;
  update public.journal_entries set status = 'void'
  where business_id = target_business_id and source_type = 'allocation' and source_id = target_allocation_id and status = 'posted';
  select coalesce(sum(amount), 0) into allocated from public.bank_transaction_allocations
  where business_id = target_business_id and bank_transaction_id = allocation_record.bank_transaction_id and voided_at is null;
  update public.bank_transactions
  set status = case when allocated = 0 then 'unreviewed' when abs(allocated - abs(amount)) <= 0.005 then 'matched' else 'partially_matched' end,
      reviewed_at = case when abs(allocated - abs(amount)) <= 0.005 then now() else null end,
      reviewed_by = case when abs(allocated - abs(amount)) <= 0.005 then auth.uid() else null end
  where business_id = target_business_id and id = allocation_record.bank_transaction_id;
end;
$$;

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
  perform private.ensure_default_ledger_accounts(target_business_id);
  select id into cash_account_id from public.ledger_accounts where business_id = target_business_id and system_key = 'cash';
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

create or replace function public.create_bookkeeping_adjustment(
  target_business_id bigint, adjustment_date date, adjustment_description text,
  target_debit_account_id bigint, target_credit_account_id bigint,
  adjustment_amount numeric, adjustment_reason text
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  adjustment_id bigint;
  journal_id bigint;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if adjustment_date is null then raise exception 'Adjustment date is required.'; end if;
  perform private.assert_accounting_period_open(target_business_id, adjustment_date);
  if target_debit_account_id = target_credit_account_id then raise exception 'Debit and credit accounts must differ.'; end if;
  if adjustment_amount <= 0 then raise exception 'Adjustment amount must be greater than zero.'; end if;
  if nullif(trim(adjustment_description), '') is null or nullif(trim(adjustment_reason), '') is null then
    raise exception 'Description and reason are required.';
  end if;
  if not exists (select 1 from public.ledger_accounts where business_id = target_business_id and id = target_debit_account_id and active)
    or not exists (select 1 from public.ledger_accounts where business_id = target_business_id and id = target_credit_account_id and active) then
    raise exception 'Both ledger accounts must be active.';
  end if;
  insert into public.bookkeeping_adjustments
    (business_id, entry_date, description, debit_account_id, credit_account_id, amount, reason, created_by)
  values (target_business_id, adjustment_date, trim(adjustment_description), target_debit_account_id,
    target_credit_account_id, adjustment_amount, trim(adjustment_reason), auth.uid()) returning id into adjustment_id;
  insert into public.journal_entries (business_id, entry_date, description, source_type, source_id, created_by)
  values (target_business_id, adjustment_date, trim(adjustment_description), 'adjustment', adjustment_id, auth.uid())
  returning id into journal_id;
  insert into public.journal_lines (business_id, journal_entry_id, account_id, debit, credit, memo)
  values
    (target_business_id, journal_id, target_debit_account_id, adjustment_amount, 0, trim(adjustment_reason)),
    (target_business_id, journal_id, target_credit_account_id, 0, adjustment_amount, trim(adjustment_reason));
  return adjustment_id;
end;
$$;

create or replace function public.save_bank_statement_period(
  target_business_id bigint, target_account_id bigint, statement_start date, statement_end date,
  statement_opening_balance numeric, statement_closing_balance numeric, statement_notes text default null
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare period_id bigint;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if statement_start is null or statement_end is null or statement_end < statement_start then raise exception 'Enter a valid statement date range.'; end if;
  perform private.assert_accounting_period_open(target_business_id, statement_end);
  if not exists (select 1 from public.bank_accounts where business_id = target_business_id and id = target_account_id and active) then
    raise exception 'Bank account not found.';
  end if;
  if exists (
    select 1 from public.bank_statement_periods
    where business_id = target_business_id and account_id = target_account_id
      and daterange(statement_start_date, statement_end_date, '[]') && daterange(statement_start, statement_end, '[]')
  ) then raise exception 'This statement overlaps an existing reconciliation period.'; end if;
  insert into public.bank_statement_periods
    (business_id, account_id, statement_start_date, statement_end_date, opening_balance, closing_balance, notes, created_by)
  values (target_business_id, target_account_id, statement_start, statement_end, statement_opening_balance,
    statement_closing_balance, nullif(trim(statement_notes), ''), auth.uid()) returning id into period_id;
  update public.bank_transactions set statement_period_id = period_id
  where business_id = target_business_id and account_id = target_account_id and statement_period_id is null
    and transaction_date between statement_start and statement_end;
  return period_id;
end;
$$;

create or replace function public.reconcile_bank_statement_period(target_business_id bigint, target_period_id bigint)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  period_record record;
  statement_activity numeric;
  book_activity numeric;
  statement_difference numeric;
  book_difference numeric;
  pending_count integer;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  select * into period_record from public.bank_statement_periods
  where business_id = target_business_id and id = target_period_id for update;
  if period_record.id is null then raise exception 'Statement period not found.'; end if;
  if period_record.status = 'closed' then raise exception 'This statement belongs to a closed month.'; end if;
  perform private.assert_accounting_period_open(target_business_id, period_record.statement_end_date);
  update public.bank_transactions set statement_period_id = target_period_id
  where business_id = target_business_id and account_id = period_record.account_id and statement_period_id is null
    and transaction_date between period_record.statement_start_date and period_record.statement_end_date;
  select coalesce(sum(amount), 0), count(*) filter (where status in ('unreviewed', 'partially_matched'))
  into statement_activity, pending_count from public.bank_transactions
  where business_id = target_business_id and statement_period_id = target_period_id;
  select coalesce(sum(jl.debit - jl.credit), 0) into book_activity
  from public.journal_lines jl
  join public.journal_entries je on je.business_id = jl.business_id and je.id = jl.journal_entry_id
  join public.ledger_accounts la on la.business_id = jl.business_id and la.id = jl.account_id
  where jl.business_id = target_business_id and jl.bank_account_id = period_record.account_id
    and je.status = 'posted' and je.entry_date between period_record.statement_start_date and period_record.statement_end_date
    and la.system_key = 'cash';
  statement_difference := period_record.opening_balance + statement_activity - period_record.closing_balance;
  book_difference := period_record.opening_balance + book_activity - period_record.closing_balance;
  if pending_count > 0 then raise exception 'Review every transaction before reconciling this statement.'; end if;
  if abs(statement_difference) > 0.01 then raise exception 'Imported activity does not match the statement ending balance.'; end if;
  if abs(book_difference) > 0.01 then raise exception 'Book activity does not match the statement ending balance.'; end if;
  update public.bank_statement_periods set status = 'reconciled', reconciled_at = now(), reconciled_by = auth.uid()
  where business_id = target_business_id and id = target_period_id;
  return jsonb_build_object('statement_activity', statement_activity, 'book_activity', book_activity,
    'statement_difference', statement_difference, 'book_difference', book_difference, 'pending_count', pending_count);
end;
$$;

create or replace function public.close_accounting_month(target_business_id bigint, target_period_month date)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  month_end date;
  required_accounts integer;
  reconciled_accounts integer;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if target_period_month <> date_trunc('month', target_period_month)::date then raise exception 'Choose the first day of the month.'; end if;
  month_end := (target_period_month + interval '1 month - 1 day')::date;
  if not exists (
    select 1 from public.monthly_financial_snapshots
    where business_id = target_business_id and period_month = target_period_month and reconciled_at is not null and close_status = 'open'
  ) then raise exception 'Save and reconcile the month-end balance snapshot first.'; end if;
  if exists (
    select 1 from public.bank_transactions
    where business_id = target_business_id and transaction_date <= month_end and status in ('unreviewed', 'partially_matched')
  ) then raise exception 'Review all bank transactions through month end before closing.'; end if;
  select count(*) into required_accounts from public.bank_accounts
  where business_id = target_business_id and active and account_type <> 'cash';
  select count(distinct account_id) into reconciled_accounts from public.bank_statement_periods
  where business_id = target_business_id and statement_end_date between target_period_month and month_end and status = 'reconciled';
  if reconciled_accounts < required_accounts then raise exception 'Reconcile a statement for every active bank and credit account before closing.'; end if;
  update public.bank_statement_periods set status = 'closed', closed_at = now(), closed_by = auth.uid()
  where business_id = target_business_id and statement_end_date between target_period_month and month_end and status = 'reconciled';
  update public.monthly_financial_snapshots set close_status = 'closed', closed_at = now(), closed_by = auth.uid()
  where business_id = target_business_id and period_month = target_period_month;
end;
$$;

create or replace function public.reopen_accounting_month(
  target_business_id bigint, target_period_month date, target_reason text
)
returns void language plpgsql security invoker set search_path = '' as $$
declare month_end date;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if nullif(trim(target_reason), '') is null then raise exception 'A reopen reason is required.'; end if;
  month_end := (target_period_month + interval '1 month - 1 day')::date;
  update public.monthly_financial_snapshots
  set close_status = 'open', reopened_at = now(), reopened_by = auth.uid(), reopen_reason = trim(target_reason),
      closed_at = null, closed_by = null
  where business_id = target_business_id and period_month = target_period_month and close_status = 'closed';
  if not found then raise exception 'Closed accounting month not found.'; end if;
  update public.bank_statement_periods set status = 'reconciled', closed_at = null, closed_by = null
  where business_id = target_business_id and statement_end_date between target_period_month and month_end and status = 'closed';
end;
$$;

do $$ declare business_record record; begin
  for business_record in select id from public.businesses loop
    perform private.ensure_default_ledger_accounts(business_record.id);
  end loop;
end $$;

revoke all on function private.assert_accounting_period_open(bigint, date) from public, anon, authenticated;
grant execute on function private.assert_accounting_period_open(bigint, date) to authenticated;
revoke all on function private.ensure_default_ledger_accounts(bigint) from public, anon, authenticated;
grant execute on function private.ensure_default_ledger_accounts(bigint) to authenticated;
revoke all on function private.prevent_closed_period_change() from public, anon, authenticated;
revoke all on function private.tag_source_bank_account_journal() from public, anon, authenticated;
revoke all on function public.add_bank_transaction_allocation(bigint, bigint, bigint, numeric, text, text, numeric) from public, anon;
revoke all on function public.void_bank_transaction_allocation(bigint, bigint, text) from public, anon;
revoke all on function public.create_bank_transfer(bigint, bigint, bigint, text) from public, anon;
revoke all on function public.create_bookkeeping_adjustment(bigint, date, text, bigint, bigint, numeric, text) from public, anon;
revoke all on function public.save_bank_statement_period(bigint, bigint, date, date, numeric, numeric, text) from public, anon;
revoke all on function public.reconcile_bank_statement_period(bigint, bigint) from public, anon;
revoke all on function public.close_accounting_month(bigint, date) from public, anon;
revoke all on function public.reopen_accounting_month(bigint, date, text) from public, anon;
grant execute on function public.add_bank_transaction_allocation(bigint, bigint, bigint, numeric, text, text, numeric) to authenticated;
grant execute on function public.void_bank_transaction_allocation(bigint, bigint, text) to authenticated;
grant execute on function public.create_bank_transfer(bigint, bigint, bigint, text) to authenticated;
grant execute on function public.create_bookkeeping_adjustment(bigint, date, text, bigint, bigint, numeric, text) to authenticated;
grant execute on function public.save_bank_statement_period(bigint, bigint, date, date, numeric, numeric, text) to authenticated;
grant execute on function public.reconcile_bank_statement_period(bigint, bigint) to authenticated;
grant execute on function public.close_accounting_month(bigint, date) to authenticated;
grant execute on function public.reopen_accounting_month(bigint, date, text) to authenticated;
