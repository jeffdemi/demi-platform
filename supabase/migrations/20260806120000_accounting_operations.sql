-- Accounting operations: reconciliation, payments, ledger, tax metadata, and receipt review.
-- All changes are additive and preserve existing operational records.

alter table public.expenses
  add column bank_transaction_id bigint,
  add column tax_category text,
  add column deductible_percent numeric(5, 2) not null default 100
    check (deductible_percent between 0 and 100),
  add column receipt_review_status text not null default 'not_requested'
    check (receipt_review_status in ('not_requested', 'pending', 'needs_review', 'approved', 'failed')),
  add column receipt_extracted_data jsonb,
  add column receipt_reviewed_at timestamptz,
  add column receipt_reviewed_by uuid references auth.users(id) on delete set null;

create table public.bank_accounts (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  name text not null check (nullif(trim(name), '') is not null),
  institution text,
  account_type text not null default 'checking'
    check (account_type in ('checking', 'savings', 'credit_card', 'cash', 'other')),
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.bank_imports (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  file_name text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  imported_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (business_id, account_id, source_sha256),
  unique (business_id, id),
  foreign key (business_id, account_id)
    references public.bank_accounts(business_id, id)
);

create table public.bank_transactions (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  import_id uuid not null,
  transaction_date date not null,
  posted_date date,
  description text not null check (nullif(trim(description), '') is not null),
  amount numeric(12, 2) not null check (amount <> 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  external_id text,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'unreviewed'
    check (status in ('unreviewed', 'matched', 'excluded')),
  excluded_reason text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, account_id, fingerprint),
  foreign key (business_id, account_id)
    references public.bank_accounts(business_id, id),
  foreign key (business_id, import_id)
    references public.bank_imports(business_id, id),
  check (status <> 'excluded' or nullif(trim(excluded_reason), '') is not null)
);

alter table public.expenses
  add constraint expenses_bank_transaction_fkey
    foreign key (business_id, bank_transaction_id)
    references public.bank_transactions(business_id, id);

create unique index expenses_bank_transaction_unique_idx
  on public.expenses (business_id, bank_transaction_id)
  where bank_transaction_id is not null and voided_at is null;

create table public.payments (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  customer_id bigint,
  invoice_id bigint,
  job_id bigint,
  bank_transaction_id bigint,
  payment_date date not null default current_date,
  amount numeric(12, 2) not null check (amount > 0),
  method text,
  reference text,
  source text not null default 'manual' check (source in ('manual', 'legacy', 'bank_import')),
  notes text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, customer_id) references public.customers(business_id, id),
  foreign key (business_id, invoice_id) references public.invoices(business_id, id),
  foreign key (business_id, job_id) references public.jobs(business_id, id),
  foreign key (business_id, bank_transaction_id) references public.bank_transactions(business_id, id),
  check (invoice_id is not null or job_id is not null),
  check (voided_at is null or nullif(trim(void_reason), '') is not null)
);

create unique index payments_bank_transaction_unique_idx
  on public.payments (business_id, bank_transaction_id)
  where bank_transaction_id is not null and voided_at is null;
create index payments_business_date_idx
  on public.payments (business_id, payment_date desc, id desc)
  where voided_at is null;
create index payments_invoice_idx on public.payments (business_id, invoice_id);
create index payments_job_idx on public.payments (business_id, job_id);
create index payments_voided_by_idx on public.payments (voided_by) where voided_by is not null;

create table public.ledger_accounts (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  code text not null,
  name text not null check (nullif(trim(name), '') is not null),
  account_type text not null check (account_type in ('asset', 'liability', 'equity', 'revenue', 'expense')),
  normal_balance text not null check (normal_balance in ('debit', 'credit')),
  system_key text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code),
  unique (business_id, system_key)
);

create table public.journal_entries (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  entry_date date not null,
  description text not null check (nullif(trim(description), '') is not null),
  source_type text not null check (source_type in ('expense', 'payment', 'adjustment')),
  source_id bigint,
  revision integer not null default 1 check (revision > 0),
  status text not null default 'posted' check (status in ('posted', 'superseded', 'void')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table public.journal_lines (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  journal_entry_id bigint not null,
  account_id bigint not null,
  debit numeric(12, 2) not null default 0 check (debit >= 0),
  credit numeric(12, 2) not null default 0 check (credit >= 0),
  memo text,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, journal_entry_id) references public.journal_entries(business_id, id) on delete cascade,
  foreign key (business_id, account_id) references public.ledger_accounts(business_id, id),
  check ((debit > 0 and credit = 0) or (credit > 0 and debit = 0))
);

create unique index journal_entries_active_source_idx
  on public.journal_entries (business_id, source_type, source_id)
  where source_id is not null and status = 'posted';
create index journal_entries_business_date_idx
  on public.journal_entries (business_id, entry_date desc, id desc);
create index journal_lines_entry_idx on public.journal_lines (business_id, journal_entry_id);
create index journal_lines_account_idx on public.journal_lines (business_id, account_id);
create index bank_transactions_review_idx
  on public.bank_transactions (business_id, status, transaction_date desc, id desc);
create index bank_transactions_account_date_idx
  on public.bank_transactions (business_id, account_id, transaction_date desc, id desc);
create index bank_transactions_reviewed_by_idx
  on public.bank_transactions (reviewed_by) where reviewed_by is not null;
create index bank_imports_imported_by_idx on public.bank_imports (imported_by);
create index expenses_receipt_reviewed_by_idx
  on public.expenses (receipt_reviewed_by) where receipt_reviewed_by is not null;

create trigger bank_accounts_set_updated_at before update on public.bank_accounts
  for each row execute function private.set_updated_at();
create trigger bank_transactions_set_updated_at before update on public.bank_transactions
  for each row execute function private.set_updated_at();
create trigger payments_set_updated_at before update on public.payments
  for each row execute function private.set_updated_at();
create trigger ledger_accounts_set_updated_at before update on public.ledger_accounts
  for each row execute function private.set_updated_at();

alter table public.bank_accounts enable row level security;
alter table public.bank_imports enable row level security;
alter table public.bank_transactions enable row level security;
alter table public.payments enable row level security;
alter table public.ledger_accounts enable row level security;
alter table public.journal_entries enable row level security;
alter table public.journal_lines enable row level security;

create policy bank_accounts_business_access on public.bank_accounts for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy bank_imports_business_access on public.bank_imports for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy bank_transactions_business_access on public.bank_transactions for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy payments_business_access on public.payments for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy ledger_accounts_business_select on public.ledger_accounts for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy journal_entries_business_select on public.journal_entries for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy journal_lines_business_select on public.journal_lines for select to authenticated
  using ((select private.is_business_member(business_id)));

grant select, insert, update, delete on public.bank_accounts, public.bank_imports,
  public.bank_transactions, public.payments to authenticated;
grant select on public.ledger_accounts, public.journal_entries, public.journal_lines to authenticated;
grant usage, select on all sequences in schema public to authenticated;

create or replace function private.ensure_default_ledger_accounts(target_business_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ledger_accounts
    (business_id, code, name, account_type, normal_balance, system_key)
  values
    (target_business_id, '1000', 'Cash and bank', 'asset', 'debit', 'cash'),
    (target_business_id, '1500', 'Equipment and fixed assets', 'asset', 'debit', 'fixed_assets'),
    (target_business_id, '4000', 'Service revenue', 'revenue', 'credit', 'service_revenue'),
    (target_business_id, '6000', 'Operating expenses', 'expense', 'debit', 'operating_expense'),
    (target_business_id, '3000', 'Owner equity', 'equity', 'credit', 'owner_equity')
  on conflict (business_id, system_key) do nothing;
end;
$$;

create or replace function private.replace_source_journal(
  target_business_id bigint,
  target_source_type text,
  target_source_id bigint,
  target_date date,
  target_description text,
  debit_key text,
  credit_key text,
  target_amount numeric,
  target_user uuid
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  next_revision integer;
  entry_id bigint;
  debit_account bigint;
  credit_account bigint;
begin
  perform private.ensure_default_ledger_accounts(target_business_id);
  select coalesce(max(revision), 0) + 1 into next_revision
  from public.journal_entries
  where business_id = target_business_id
    and source_type = target_source_type
    and source_id = target_source_id;

  update public.journal_entries set status = 'superseded'
  where business_id = target_business_id
    and source_type = target_source_type
    and source_id = target_source_id
    and status = 'posted';

  if target_amount <= 0 then return; end if;

  select id into debit_account from public.ledger_accounts
  where business_id = target_business_id and system_key = debit_key;
  select id into credit_account from public.ledger_accounts
  where business_id = target_business_id and system_key = credit_key;

  insert into public.journal_entries
    (business_id, entry_date, description, source_type, source_id, revision, created_by)
  values
    (target_business_id, target_date, target_description, target_source_type,
     target_source_id, next_revision, target_user)
  returning id into entry_id;

  insert into public.journal_lines
    (business_id, journal_entry_id, account_id, debit, credit, memo)
  values
    (target_business_id, entry_id, debit_account, target_amount, 0, target_description),
    (target_business_id, entry_id, credit_account, 0, target_amount, target_description);
end;
$$;

create or replace function private.sync_expense_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_type text;
begin
  if new.voided_at is not null then
    update public.journal_entries set status = 'void'
    where business_id = new.business_id and source_type = 'expense'
      and source_id = new.id and status = 'posted';
    return new;
  end if;

  if new.transaction_type = 'asset' then
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Asset purchase'),
      'fixed_assets', 'cash', new.amount, auth.uid());
  elsif new.transaction_type = 'refund' then
    select transaction_type into source_type from public.expenses
    where business_id = new.business_id and id = new.refund_of_expense_id;
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Purchase refund'),
      'cash', case when source_type = 'asset' then 'fixed_assets' else 'operating_expense' end,
      new.amount, auth.uid());
  else
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Operating expense'),
      'operating_expense', 'cash', new.amount, auth.uid());
  end if;
  return new;
end;
$$;

create trigger expenses_sync_journal
after insert or update of expense_date, amount, transaction_type, refund_of_expense_id,
  vendor, description, voided_at on public.expenses
for each row execute function private.sync_expense_journal();

create or replace function private.sync_payment_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.voided_at is not null then
    update public.journal_entries set status = 'void'
    where business_id = new.business_id and source_type = 'payment'
      and source_id = new.id and status = 'posted';
    return new;
  end if;
  perform private.replace_source_journal(new.business_id, 'payment', new.id,
    new.payment_date, 'Customer payment' || coalesce(' ' || new.reference, ''),
    'cash', 'service_revenue', new.amount, auth.uid());
  return new;
end;
$$;

create trigger payments_sync_journal
after insert or update of payment_date, amount, reference, voided_at on public.payments
for each row execute function private.sync_payment_journal();

create or replace function private.capture_paid_invoice_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'paid' and new.amount > 0 and not exists (
    select 1 from public.payments
    where business_id = new.business_id and invoice_id = new.id and voided_at is null
  ) then
    insert into public.payments
      (business_id, customer_id, invoice_id, job_id, payment_date, amount, source, notes)
    values
      (new.business_id, new.customer_id, new.id, new.job_id,
       coalesce(new.paid_date, current_date), new.amount, 'legacy',
       'Automatically recorded when invoice was marked paid');
  end if;
  return new;
end;
$$;

create trigger invoices_capture_paid_payment
after insert or update of status, paid_date, amount on public.invoices
for each row execute function private.capture_paid_invoice_payment();

create or replace function private.enforce_refund_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_amount numeric;
  refunded_amount numeric;
begin
  if new.transaction_type <> 'refund' or new.voided_at is not null then return new; end if;
  select amount into source_amount from public.expenses
  where business_id = new.business_id and id = new.refund_of_expense_id
    and transaction_type <> 'refund' and voided_at is null;
  if source_amount is null then raise exception 'The original expense is unavailable for a refund.'; end if;
  select coalesce(sum(amount), 0) into refunded_amount from public.expenses
  where business_id = new.business_id
    and refund_of_expense_id = new.refund_of_expense_id
    and transaction_type = 'refund' and voided_at is null
    and id is distinct from new.id;
  if refunded_amount + new.amount > source_amount then
    raise exception 'Refunds cannot exceed the original expense amount of %.', source_amount;
  end if;
  return new;
end;
$$;

create trigger expenses_enforce_refund_limit
before insert or update of amount, transaction_type, refund_of_expense_id, voided_at
on public.expenses for each row execute function private.enforce_refund_limit();

create or replace function private.validate_expense_bank_match()
returns trigger language plpgsql security definer set search_path = '' as $$
declare bank_amount numeric;
begin
  if new.bank_transaction_id is null or new.voided_at is not null then return new; end if;
  select amount into bank_amount from public.bank_transactions
  where business_id = new.business_id and id = new.bank_transaction_id;
  if bank_amount is null or bank_amount >= 0 or abs(bank_amount) <> new.amount then
    raise exception 'The bank withdrawal must equal the expense amount.';
  end if;
  return new;
end;
$$;

create trigger expenses_validate_bank_match
before insert or update of bank_transaction_id, amount, voided_at on public.expenses
for each row execute function private.validate_expense_bank_match();

create or replace function private.sync_expense_bank_match()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and old.bank_transaction_id is not null and
     (new.bank_transaction_id is distinct from old.bank_transaction_id or new.voided_at is not null) then
    update public.bank_transactions set status = 'unreviewed', reviewed_at = null, reviewed_by = null
    where business_id = old.business_id and id = old.bank_transaction_id
      and not exists (select 1 from public.payments where business_id = old.business_id and bank_transaction_id = old.bank_transaction_id and voided_at is null);
  end if;
  if new.bank_transaction_id is not null and new.voided_at is null then
    update public.bank_transactions set status = 'matched', reviewed_at = now(), reviewed_by = auth.uid()
    where business_id = new.business_id and id = new.bank_transaction_id;
  end if;
  return new;
end;
$$;

create trigger expenses_sync_bank_match
after insert or update of bank_transaction_id, voided_at on public.expenses
for each row execute function private.sync_expense_bank_match();

create or replace function public.import_bank_statement(
  target_business_id bigint,
  target_account_id bigint,
  import_file_name text,
  import_source_sha256 text,
  import_rows jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  caller_id uuid := auth.uid();
  import_record_id uuid;
  row_data jsonb;
  created_count integer := 0;
  skipped_count integer := 0;
begin
  if caller_id is null or not private.is_business_member(target_business_id) then
    raise exception 'Business access is required.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.bank_accounts where business_id = target_business_id and id = target_account_id and active) then
    raise exception 'Select an active bank account.' using errcode = '22023';
  end if;
  if import_source_sha256 !~ '^[0-9a-f]{64}$' or jsonb_typeof(import_rows) <> 'array' then
    raise exception 'The bank import payload is invalid.' using errcode = '22023';
  end if;

  select id into import_record_id from public.bank_imports
  where business_id = target_business_id and account_id = target_account_id and source_sha256 = import_source_sha256;
  if import_record_id is not null then
    return jsonb_build_object('already_imported', true, 'created', 0, 'skipped', jsonb_array_length(import_rows));
  end if;

  insert into public.bank_imports (business_id, account_id, file_name, source_sha256, row_count, imported_by)
  values (target_business_id, target_account_id, left(import_file_name, 500), import_source_sha256, jsonb_array_length(import_rows), caller_id)
  returning id into import_record_id;

  for row_data in select value from jsonb_array_elements(import_rows) loop
    insert into public.bank_transactions
      (business_id, account_id, import_id, transaction_date, posted_date, description,
       amount, external_id, fingerprint)
    values
      (target_business_id, target_account_id, import_record_id,
       (row_data ->> 'transactionDate')::date,
       nullif(row_data ->> 'postedDate', '')::date,
       left(row_data ->> 'description', 2000),
       (row_data ->> 'amount')::numeric,
       nullif(left(row_data ->> 'externalId', 500), ''),
       row_data ->> 'fingerprint')
    on conflict (business_id, account_id, fingerprint) do nothing;
    if found then created_count := created_count + 1; else skipped_count := skipped_count + 1; end if;
  end loop;
  return jsonb_build_object('already_imported', false, 'created', created_count, 'skipped', skipped_count);
end;
$$;

revoke all on function public.import_bank_statement(bigint, bigint, text, text, jsonb) from public, anon;
grant execute on function public.import_bank_statement(bigint, bigint, text, text, jsonb) to authenticated;

create or replace function public.record_payment(
  target_business_id bigint,
  target_invoice_id bigint,
  target_job_id bigint,
  payment_on date,
  payment_amount numeric,
  payment_method text,
  payment_reference text,
  target_bank_transaction_id bigint,
  payment_notes text
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  payment_id bigint;
  target_customer_id bigint;
  invoice_amount numeric;
  bank_amount numeric;
  paid_total numeric;
begin
  if not private.is_business_member(target_business_id) then
    raise exception 'Business access is required.' using errcode = '42501';
  end if;
  if payment_amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  if target_invoice_id is not null then
    select customer_id, amount, coalesce(target_job_id, job_id)
    into target_customer_id, invoice_amount, target_job_id
    from public.invoices where business_id = target_business_id and id = target_invoice_id for update;
    if target_customer_id is null then raise exception 'Invoice not found.'; end if;
  elsif target_job_id is not null then
    select customer_id into target_customer_id from public.jobs
    where business_id = target_business_id and id = target_job_id;
    if target_customer_id is null then raise exception 'Job not found.'; end if;
  else
    raise exception 'Select an invoice or job.';
  end if;
  if target_bank_transaction_id is not null then
    select amount into bank_amount from public.bank_transactions
    where business_id = target_business_id and id = target_bank_transaction_id for update;
    if bank_amount is null or bank_amount <= 0 or bank_amount <> payment_amount then
      raise exception 'The bank deposit must equal the payment amount.';
    end if;
  end if;
  insert into public.payments
    (business_id, customer_id, invoice_id, job_id, bank_transaction_id, payment_date,
     amount, method, reference, source, notes)
  values
    (target_business_id, target_customer_id, target_invoice_id, target_job_id,
     target_bank_transaction_id, payment_on, payment_amount, nullif(trim(payment_method), ''),
     nullif(trim(payment_reference), ''), case when target_bank_transaction_id is null then 'manual' else 'bank_import' end,
     nullif(trim(payment_notes), ''))
  returning id into payment_id;
  if target_bank_transaction_id is not null then
    update public.bank_transactions set status = 'matched', reviewed_at = now(), reviewed_by = auth.uid()
    where business_id = target_business_id and id = target_bank_transaction_id;
  end if;
  if target_invoice_id is not null then
    select coalesce(sum(amount), 0) into paid_total from public.payments
    where business_id = target_business_id and invoice_id = target_invoice_id and voided_at is null;
    update public.invoices set status = case when paid_total >= invoice_amount then 'paid' else 'unpaid' end,
      paid_date = case when paid_total >= invoice_amount then payment_on else null end
    where business_id = target_business_id and id = target_invoice_id;
  end if;
  if target_job_id is not null then
    select coalesce(sum(amount), 0) into paid_total from public.payments
    where business_id = target_business_id and job_id = target_job_id and voided_at is null;
    update public.jobs set amount_paid = paid_total,
      paid_date = case when paid_total > 0 then payment_on else paid_date end
    where business_id = target_business_id and id = target_job_id;
  end if;
  return payment_id;
end;
$$;

revoke all on function public.record_payment(bigint, bigint, bigint, date, numeric, text, text, bigint, text) from public, anon;
grant execute on function public.record_payment(bigint, bigint, bigint, date, numeric, text, text, bigint, text) to authenticated;

-- Preserve current cash-revenue totals by creating one legacy payment per paid invoice,
-- then one per paid job that has no invoice. Source business records remain unchanged.
insert into public.payments
  (business_id, customer_id, invoice_id, job_id, payment_date, amount, method, source, notes)
select i.business_id, i.customer_id, i.id, i.job_id,
  coalesce(i.paid_date, i.invoice_date), i.amount, j.payment_method, 'legacy',
  'Backfilled from paid invoice ' || i.invoice_number
from public.invoices i
left join public.jobs j on j.business_id = i.business_id and j.id = i.job_id
where i.status = 'paid' and i.amount > 0
  and not exists (select 1 from public.payments p where p.business_id = i.business_id and p.invoice_id = i.id);

insert into public.payments
  (business_id, customer_id, job_id, payment_date, amount, method, source, notes)
select j.business_id, j.customer_id, j.id,
  coalesce(j.paid_date, j.job_date, j.created_at::date), j.amount_paid,
  j.payment_method, 'legacy', 'Backfilled from paid job without an invoice'
from public.jobs j
where coalesce(j.amount_paid, 0) > 0
  and not exists (select 1 from public.invoices i where i.business_id = j.business_id and i.job_id = j.id)
  and not exists (select 1 from public.payments p where p.business_id = j.business_id and p.job_id = j.id);

-- Seed charts and journal entries for existing financial records.
do $$ declare business_record record; begin
  for business_record in select id from public.businesses loop
    perform private.ensure_default_ledger_accounts(business_record.id);
  end loop;
end $$;

update public.expenses
set tax_category = category,
    amount = amount;
update public.payments set amount = amount;

-- Hide privileged implementation functions from the exposed API while preserving RPC names.
alter function public.create_business(text) rename to create_business_legacy_implementation;
alter function public.accept_business_invitation(uuid, text) rename to accept_business_invitation_legacy_implementation;
alter function public.platform_setup_available() rename to platform_setup_available_legacy_implementation;
alter function public.create_business_legacy_implementation(text) set schema private;
alter function public.accept_business_invitation_legacy_implementation(uuid, text) set schema private;
alter function public.platform_setup_available_legacy_implementation() set schema private;

revoke all on function private.create_business_legacy_implementation(text) from public, anon;
revoke all on function private.accept_business_invitation_legacy_implementation(uuid, text) from public, anon;
revoke all on function private.platform_setup_available_legacy_implementation() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.create_business_legacy_implementation(text) to authenticated;
grant execute on function private.accept_business_invitation_legacy_implementation(uuid, text) to authenticated;
grant execute on function private.platform_setup_available_legacy_implementation() to anon, authenticated;

create function public.create_business(business_name text)
returns bigint language sql security invoker set search_path = '' as $$
  select private.create_business_legacy_implementation(business_name);
$$;
create function public.accept_business_invitation(invitation_id uuid, member_full_name text default null)
returns bigint language sql security invoker set search_path = '' as $$
  select private.accept_business_invitation_legacy_implementation(invitation_id, member_full_name);
$$;
create function public.platform_setup_available()
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.platform_setup_available_legacy_implementation();
$$;

revoke all on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;
revoke all on function public.accept_business_invitation(uuid, text) from public, anon;
grant execute on function public.accept_business_invitation(uuid, text) to authenticated;
revoke all on function public.platform_setup_available() from public;
grant execute on function public.platform_setup_available() to anon, authenticated;
