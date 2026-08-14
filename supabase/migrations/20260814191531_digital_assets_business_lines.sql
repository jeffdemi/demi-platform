-- Digital assets, operating segments, owner capital, identity, and historical cleanup.
-- Additive only: existing records and posted journals are preserved.

create table public.business_lines (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  name text not null check (nullif(trim(name), '') is not null),
  code text not null check (code ~ '^[a-z0-9_]+$'),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, code)
);

create table public.business_identity_settings (
  business_id bigint primary key references public.businesses(id) on delete cascade,
  legal_name text not null check (nullif(trim(legal_name), '') is not null),
  public_brand text not null check (nullif(trim(public_brand), '') is not null),
  tax_treatment text not null default 'single_member_disregarded'
    check (tax_treatment in ('single_member_disregarded', 's_corporation', 'c_corporation', 'partnership', 'other')),
  fictitious_name_status text not null default 'not_required'
    check (fictitious_name_status in ('not_required', 'needs_review', 'planned', 'filed')),
  fictitious_name_jurisdiction text,
  notes text,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bank_accounts
  add column business_line_id bigint,
  add column purpose text,
  add column opened_on date,
  add column minimum_balance_target numeric(12, 2) check (minimum_balance_target is null or minimum_balance_target >= 0),
  add column minimum_balance_days integer check (minimum_balance_days is null or minimum_balance_days > 0),
  add column target_through date,
  add column promotion_amount numeric(12, 2) check (promotion_amount is null or promotion_amount >= 0),
  add constraint bank_accounts_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);

alter table public.jobs add column business_line_id bigint,
  add constraint jobs_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.invoices add column business_line_id bigint,
  add constraint invoices_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.expenses add column business_line_id bigint,
  add constraint expenses_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.equipment add column business_line_id bigint,
  add constraint equipment_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.labor_entries add column business_line_id bigint,
  add constraint labor_entries_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.payments add column business_line_id bigint,
  add constraint payments_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.bank_transaction_allocations add column business_line_id bigint,
  add constraint bank_transaction_allocations_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);
alter table public.journal_entries add column business_line_id bigint,
  add constraint journal_entries_business_line_fkey foreign key (business_id, business_line_id)
    references public.business_lines(business_id, id);

alter table public.journal_entries drop constraint journal_entries_source_type_check;
alter table public.journal_entries add constraint journal_entries_source_type_check
  check (source_type in ('expense', 'payment', 'adjustment', 'allocation', 'transfer', 'digital_asset', 'capital', 'opening_balance'));

create table public.digital_asset_accounts (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  name text not null check (nullif(trim(name), '') is not null),
  provider text,
  account_type text not null default 'exchange' check (account_type in ('exchange', 'wallet', 'custodian', 'other')),
  external_reference text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, name)
);

create table public.digital_asset_imports (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  file_name text not null check (nullif(trim(file_name), '') is not null),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  imported_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, account_id, source_sha256),
  foreign key (business_id, account_id) references public.digital_asset_accounts(business_id, id)
);

create table public.digital_asset_transactions (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  import_id uuid,
  business_line_id bigint,
  occurred_at timestamptz not null,
  transaction_type text not null check (transaction_type in ('buy', 'sell', 'transfer_in', 'transfer_out', 'fee', 'reward', 'opening_balance', 'adjustment')),
  asset_symbol text not null check (asset_symbol ~ '^[A-Z0-9]{2,12}$'),
  units numeric(30, 12) not null check (units > 0),
  unit_price_usd numeric(20, 8) check (unit_price_usd is null or unit_price_usd >= 0),
  gross_amount_usd numeric(14, 2) not null default 0 check (gross_amount_usd >= 0),
  fee_usd numeric(14, 2) not null default 0 check (fee_usd >= 0),
  external_id text,
  transfer_reference text,
  memo text,
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  status text not null default 'unreviewed' check (status in ('unreviewed', 'reconciled', 'excluded')),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, account_id, fingerprint),
  foreign key (business_id, account_id) references public.digital_asset_accounts(business_id, id),
  foreign key (business_id, import_id) references public.digital_asset_imports(business_id, id),
  foreign key (business_id, business_line_id) references public.business_lines(business_id, id)
);

create table public.digital_asset_lots (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  acquisition_transaction_id bigint,
  asset_symbol text not null check (asset_symbol ~ '^[A-Z0-9]{2,12}$'),
  acquired_at timestamptz not null,
  units_acquired numeric(30, 12) not null check (units_acquired > 0),
  units_remaining numeric(30, 12) not null check (units_remaining >= 0 and units_remaining <= units_acquired),
  cost_basis_usd numeric(14, 2) not null check (cost_basis_usd >= 0),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, account_id) references public.digital_asset_accounts(business_id, id),
  foreign key (business_id, acquisition_transaction_id) references public.digital_asset_transactions(business_id, id)
);

create table public.digital_asset_disposals (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  sale_transaction_id bigint not null,
  lot_id bigint not null,
  units numeric(30, 12) not null check (units > 0),
  proceeds_usd numeric(14, 2) not null check (proceeds_usd >= 0),
  cost_basis_usd numeric(14, 2) not null check (cost_basis_usd >= 0),
  realized_gain_loss_usd numeric(14, 2) generated always as (proceeds_usd - cost_basis_usd) stored,
  created_at timestamptz not null default now(),
  unique (business_id, sale_transaction_id, lot_id),
  foreign key (business_id, sale_transaction_id) references public.digital_asset_transactions(business_id, id),
  foreign key (business_id, lot_id) references public.digital_asset_lots(business_id, id)
);

create table public.digital_asset_reconciliations (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  account_id bigint not null,
  as_of_date date not null,
  reported_balances jsonb not null default '{}'::jsonb,
  reported_cash_usd numeric(14, 2) not null default 0,
  notes text,
  status text not null default 'draft' check (status in ('draft', 'reconciled')),
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, account_id, as_of_date),
  foreign key (business_id, account_id) references public.digital_asset_accounts(business_id, id)
);

create table public.capital_transactions (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  business_line_id bigint,
  bank_account_id bigint,
  transaction_date date not null,
  transaction_type text not null check (transaction_type in ('owner_contribution', 'owner_loan', 'loan_repayment', 'owner_draw', 'estimated_tax')),
  amount numeric(12, 2) not null check (amount > 0),
  counterparty text,
  memo text not null check (nullif(trim(memo), '') is not null),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, business_line_id) references public.business_lines(business_id, id),
  foreign key (business_id, bank_account_id) references public.bank_accounts(business_id, id)
);

create table public.bookkeeping_cleanup_items (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  business_line_id bigint,
  item_type text not null check (item_type in ('opening_balance', 'owner_advance', 'venmo_history', 'uncategorized', 'other')),
  effective_date date not null,
  description text not null check (nullif(trim(description), '') is not null),
  amount numeric(12, 2),
  debit_account_id bigint,
  credit_account_id bigint,
  status text not null default 'open' check (status in ('open', 'ready', 'posted', 'dismissed')),
  resolution_notes text,
  posted_journal_entry_id bigint,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, business_line_id) references public.business_lines(business_id, id),
  foreign key (business_id, debit_account_id) references public.ledger_accounts(business_id, id),
  foreign key (business_id, credit_account_id) references public.ledger_accounts(business_id, id),
  foreign key (business_id, posted_journal_entry_id) references public.journal_entries(business_id, id),
  check (debit_account_id is null or credit_account_id is null or debit_account_id <> credit_account_id)
);

create trigger business_lines_set_updated_at before update on public.business_lines
  for each row execute function private.set_updated_at();
create trigger business_identity_settings_set_updated_at before update on public.business_identity_settings
  for each row execute function private.set_updated_at();
create trigger digital_asset_accounts_set_updated_at before update on public.digital_asset_accounts
  for each row execute function private.set_updated_at();
create trigger bookkeeping_cleanup_items_set_updated_at before update on public.bookkeeping_cleanup_items
  for each row execute function private.set_updated_at();

alter table public.business_lines enable row level security;
alter table public.business_identity_settings enable row level security;
alter table public.digital_asset_accounts enable row level security;
alter table public.digital_asset_imports enable row level security;
alter table public.digital_asset_transactions enable row level security;
alter table public.digital_asset_lots enable row level security;
alter table public.digital_asset_disposals enable row level security;
alter table public.digital_asset_reconciliations enable row level security;
alter table public.capital_transactions enable row level security;
alter table public.bookkeeping_cleanup_items enable row level security;

create policy business_lines_member_select on public.business_lines for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy business_lines_admin_write on public.business_lines for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy business_identity_settings_member_select on public.business_identity_settings for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy business_identity_settings_admin_write on public.business_identity_settings for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy digital_asset_accounts_admin_access on public.digital_asset_accounts for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy digital_asset_imports_admin_access on public.digital_asset_imports for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy digital_asset_transactions_admin_access on public.digital_asset_transactions for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy digital_asset_lots_admin_access on public.digital_asset_lots for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy digital_asset_disposals_admin_access on public.digital_asset_disposals for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy digital_asset_reconciliations_admin_access on public.digital_asset_reconciliations for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy capital_transactions_admin_access on public.capital_transactions for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));
create policy bookkeeping_cleanup_items_admin_access on public.bookkeeping_cleanup_items for all to authenticated
  using ((select private.is_business_admin(business_id))) with check ((select private.is_business_admin(business_id)));

grant select on public.business_lines, public.business_identity_settings to authenticated;
grant insert, update on public.business_lines, public.business_identity_settings to authenticated;
grant select, insert, update on public.digital_asset_accounts, public.digital_asset_imports,
  public.digital_asset_transactions, public.digital_asset_lots, public.digital_asset_disposals,
  public.digital_asset_reconciliations, public.capital_transactions, public.bookkeeping_cleanup_items to authenticated;
grant usage, select on sequence public.business_lines_id_seq, public.digital_asset_accounts_id_seq,
  public.digital_asset_transactions_id_seq, public.digital_asset_lots_id_seq,
  public.digital_asset_disposals_id_seq, public.digital_asset_reconciliations_id_seq,
  public.capital_transactions_id_seq, public.bookkeeping_cleanup_items_id_seq to authenticated;

create index jobs_business_line_idx on public.jobs (business_id, business_line_id) where business_line_id is not null;
create index invoices_business_line_idx on public.invoices (business_id, business_line_id) where business_line_id is not null;
create index expenses_business_line_date_idx on public.expenses (business_id, business_line_id, expense_date desc) where business_line_id is not null;
create index equipment_business_line_idx on public.equipment (business_id, business_line_id) where business_line_id is not null;
create index labor_entries_business_line_date_idx on public.labor_entries (business_id, business_line_id, period_end desc) where business_line_id is not null;
create index payments_business_line_date_idx on public.payments (business_id, business_line_id, payment_date desc) where business_line_id is not null;
create index journal_entries_business_line_date_idx on public.journal_entries (business_id, business_line_id, entry_date desc) where business_line_id is not null;
create index bank_accounts_business_line_idx on public.bank_accounts (business_id, business_line_id) where business_line_id is not null;
create index digital_asset_transactions_account_date_idx on public.digital_asset_transactions (business_id, account_id, occurred_at desc, id desc);
create index digital_asset_transactions_asset_date_idx on public.digital_asset_transactions (business_id, asset_symbol, occurred_at, id);
create index digital_asset_transactions_import_idx on public.digital_asset_transactions (business_id, import_id) where import_id is not null;
create index digital_asset_lots_available_idx on public.digital_asset_lots (business_id, asset_symbol, acquired_at, id) where units_remaining > 0;
create index digital_asset_disposals_sale_idx on public.digital_asset_disposals (business_id, sale_transaction_id);
create index digital_asset_disposals_lot_idx on public.digital_asset_disposals (business_id, lot_id);
create index digital_asset_reconciliations_account_idx on public.digital_asset_reconciliations (business_id, account_id, as_of_date desc);
create index capital_transactions_date_idx on public.capital_transactions (business_id, transaction_date desc, id desc);
create index capital_transactions_bank_account_idx on public.capital_transactions (business_id, bank_account_id) where bank_account_id is not null;
create index cleanup_items_status_idx on public.bookkeeping_cleanup_items (business_id, status, effective_date, id);
create index business_identity_settings_updated_by_idx on public.business_identity_settings (updated_by) where updated_by is not null;
create index digital_asset_imports_imported_by_idx on public.digital_asset_imports (imported_by);
create index digital_asset_reconciliations_reconciled_by_idx on public.digital_asset_reconciliations (reconciled_by) where reconciled_by is not null;
create index capital_transactions_created_by_idx on public.capital_transactions (created_by) where created_by is not null;
create index cleanup_items_created_by_idx on public.bookkeeping_cleanup_items (created_by) where created_by is not null;

create or replace function public.import_digital_asset_transactions(
  target_business_id bigint, target_account_id bigint, import_file_name text,
  import_source_sha256 text, import_rows jsonb
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  existing_import public.digital_asset_imports%rowtype;
  new_import_id uuid;
  row_data jsonb;
  created_count integer := 0;
  skipped_count integer := 0;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if not exists (select 1 from public.digital_asset_accounts where business_id = target_business_id and id = target_account_id and active) then
    raise exception 'Digital asset account not found.';
  end if;
  select * into existing_import from public.digital_asset_imports
  where business_id = target_business_id and account_id = target_account_id and source_sha256 = import_source_sha256;
  if existing_import.id is not null then
    return jsonb_build_object('already_imported', true, 'created', 0, 'skipped', existing_import.row_count);
  end if;
  insert into public.digital_asset_imports (business_id, account_id, file_name, source_sha256, row_count, imported_by)
  values (target_business_id, target_account_id, trim(import_file_name), import_source_sha256,
    jsonb_array_length(import_rows), auth.uid()) returning id into new_import_id;
  for row_data in select value from jsonb_array_elements(import_rows) loop
    insert into public.digital_asset_transactions
      (business_id, account_id, import_id, occurred_at, transaction_type, asset_symbol, units,
       unit_price_usd, gross_amount_usd, fee_usd, external_id, transfer_reference, memo, fingerprint)
    values
      (target_business_id, target_account_id, new_import_id, (row_data ->> 'occurredAt')::timestamptz,
       row_data ->> 'transactionType', upper(row_data ->> 'assetSymbol'), (row_data ->> 'units')::numeric,
       nullif(row_data ->> 'unitPriceUsd', '')::numeric, coalesce((row_data ->> 'grossAmountUsd')::numeric, 0),
       coalesce((row_data ->> 'feeUsd')::numeric, 0), nullif(row_data ->> 'externalId', ''),
       nullif(row_data ->> 'transferReference', ''), nullif(row_data ->> 'memo', ''), row_data ->> 'fingerprint')
    on conflict (business_id, account_id, fingerprint) do nothing;
    if found then created_count := created_count + 1; else skipped_count := skipped_count + 1; end if;
  end loop;
  return jsonb_build_object('already_imported', false, 'created', created_count, 'skipped', skipped_count);
end;
$$;

create or replace function public.assign_business_line(
  target_business_id bigint, target_record_type text, target_record_id bigint, target_business_line_id bigint
)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if not exists (select 1 from public.business_lines where business_id = target_business_id and id = target_business_line_id and active) then
    raise exception 'Business line not found.';
  end if;
  case target_record_type
    when 'job' then update public.jobs set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    when 'invoice' then update public.invoices set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    when 'expense' then update public.expenses set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    when 'equipment' then update public.equipment set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    when 'labor' then update public.labor_entries set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    when 'payment' then update public.payments set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    when 'journal_entry' then update public.journal_entries set business_line_id = target_business_line_id where business_id = target_business_id and id = target_record_id;
    else raise exception 'Unsupported classification record type.';
  end case;
  if not found then raise exception 'Record not found.'; end if;
  if target_record_type = 'expense' then
    update public.journal_entries set business_line_id = target_business_line_id
    where business_id = target_business_id and source_type = 'expense' and source_id = target_record_id and status = 'posted';
  elsif target_record_type = 'payment' then
    update public.journal_entries set business_line_id = target_business_line_id
    where business_id = target_business_id and source_type = 'payment' and source_id = target_record_id and status = 'posted';
  end if;
end;
$$;

create or replace function public.record_capital_transaction(
  target_business_id bigint, target_business_line_id bigint, target_bank_account_id bigint,
  target_date date, target_type text, target_amount numeric, target_counterparty text, target_memo text
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  capital_id bigint;
  journal_id bigint;
  debit_key text;
  credit_key text;
  debit_id bigint;
  credit_id bigint;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  perform private.assert_accounting_period_open(target_business_id, target_date);
  if target_amount <= 0 or nullif(trim(target_memo), '') is null then raise exception 'Enter a positive amount and memo.'; end if;
  if target_type = 'owner_contribution' then debit_key := 'cash'; credit_key := 'owner_contributions';
  elsif target_type = 'owner_loan' then debit_key := 'cash'; credit_key := 'loans_payable';
  elsif target_type = 'loan_repayment' then debit_key := 'loans_payable'; credit_key := 'cash';
  elsif target_type in ('owner_draw', 'estimated_tax') then debit_key := 'owner_distributions'; credit_key := 'cash';
  else raise exception 'Unsupported capital transaction type.';
  end if;
  select id into debit_id from public.ledger_accounts where business_id = target_business_id and system_key = debit_key and active;
  select id into credit_id from public.ledger_accounts where business_id = target_business_id and system_key = credit_key and active;
  if debit_id is null or credit_id is null then raise exception 'Required ledger accounts are missing.'; end if;
  insert into public.capital_transactions
    (business_id, business_line_id, bank_account_id, transaction_date, transaction_type, amount, counterparty, memo, created_by)
  values (target_business_id, target_business_line_id, target_bank_account_id, target_date, target_type,
    target_amount, nullif(trim(target_counterparty), ''), trim(target_memo), auth.uid()) returning id into capital_id;
  insert into public.journal_entries (business_id, business_line_id, entry_date, description, source_type, source_id, created_by)
  values (target_business_id, target_business_line_id, target_date, trim(target_memo), 'capital', capital_id, auth.uid()) returning id into journal_id;
  insert into public.journal_lines (business_id, journal_entry_id, account_id, debit, credit, memo, bank_account_id)
  values
    (target_business_id, journal_id, debit_id, target_amount, 0, trim(target_memo), case when debit_key = 'cash' then target_bank_account_id else null end),
    (target_business_id, journal_id, credit_id, 0, target_amount, trim(target_memo), case when credit_key = 'cash' then target_bank_account_id else null end);
  return capital_id;
end;
$$;

create or replace function public.post_bookkeeping_cleanup_item(target_business_id bigint, target_item_id bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  cleanup_record public.bookkeeping_cleanup_items%rowtype;
  journal_id bigint;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  select * into cleanup_record from public.bookkeeping_cleanup_items
  where business_id = target_business_id and id = target_item_id for update;
  if cleanup_record.id is null then raise exception 'Cleanup item not found.'; end if;
  if cleanup_record.status = 'posted' then return cleanup_record.posted_journal_entry_id; end if;
  if cleanup_record.amount is null or cleanup_record.amount <= 0
    or cleanup_record.debit_account_id is null or cleanup_record.credit_account_id is null then
    raise exception 'A positive amount and both ledger accounts are required before posting.';
  end if;
  perform private.assert_accounting_period_open(target_business_id, cleanup_record.effective_date);
  insert into public.journal_entries (business_id, business_line_id, entry_date, description, source_type, source_id, created_by)
  values (target_business_id, cleanup_record.business_line_id, cleanup_record.effective_date,
    cleanup_record.description, 'opening_balance', cleanup_record.id, auth.uid()) returning id into journal_id;
  insert into public.journal_lines (business_id, journal_entry_id, account_id, debit, credit, memo)
  values
    (target_business_id, journal_id, cleanup_record.debit_account_id, cleanup_record.amount, 0, cleanup_record.resolution_notes),
    (target_business_id, journal_id, cleanup_record.credit_account_id, 0, cleanup_record.amount, cleanup_record.resolution_notes);
  update public.bookkeeping_cleanup_items set status = 'posted', posted_journal_entry_id = journal_id
  where business_id = target_business_id and id = target_item_id;
  return journal_id;
end;
$$;

revoke all on function public.import_digital_asset_transactions(bigint, bigint, text, text, jsonb) from public, anon;
revoke all on function public.assign_business_line(bigint, text, bigint, bigint) from public, anon;
revoke all on function public.record_capital_transaction(bigint, bigint, bigint, date, text, numeric, text, text) from public, anon;
revoke all on function public.post_bookkeeping_cleanup_item(bigint, bigint) from public, anon;
grant execute on function public.import_digital_asset_transactions(bigint, bigint, text, text, jsonb) to authenticated;
grant execute on function public.assign_business_line(bigint, text, bigint, bigint) to authenticated;
grant execute on function public.record_capital_transaction(bigint, bigint, bigint, date, text, numeric, text, text) to authenticated;
grant execute on function public.post_bookkeeping_cleanup_item(bigint, bigint) to authenticated;

-- Seed only the known Demi Solutions entity; no other tenant receives business-specific data.
do $$
declare
  demi_id bigint;
  it_line_id bigint;
  stump_line_id bigint;
begin
  select id into demi_id from public.businesses
  where lower(coalesce(legal_name, name)) = 'demi solutions llc' order by id limit 1;
  if demi_id is null then return; end if;
  insert into public.business_lines (business_id, name, code, description) values
    (demi_id, 'Federal IT Contracting', 'federal_it', 'FedUnited hourly IT-contracting activity'),
    (demi_id, 'Demi Stump Grinding', 'stump_grinding', 'Stump-grinding operations')
  on conflict (business_id, code) do nothing;
  select id into it_line_id from public.business_lines where business_id = demi_id and code = 'federal_it';
  select id into stump_line_id from public.business_lines where business_id = demi_id and code = 'stump_grinding';
  insert into public.business_identity_settings
    (business_id, legal_name, public_brand, tax_treatment, fictitious_name_status, fictitious_name_jurisdiction, notes)
  values (demi_id, 'Demi Solutions LLC', 'Demi Solutions', 'single_member_disregarded', 'needs_review', 'Pennsylvania',
    'Confirm whether Demi Stump Grinding requires Pennsylvania fictitious-name registration.')
  on conflict (business_id) do nothing;
  insert into public.bank_accounts
    (business_id, name, institution, account_type, purpose, minimum_balance_target, promotion_amount, active)
  select demi_id, seed.name, seed.institution, seed.account_type, seed.purpose, seed.minimum_balance_target, seed.promotion_amount, true
  from (values
    ('Chase Business Complete Checking', 'Chase', 'checking', 'Receives IT and stump-grinding revenue; preserve $2,000 for 60-day promotion', 2000::numeric, 400::numeric),
    ('Equipment Credit Card', null, 'credit_card', 'Original equipment credit-card debt', null::numeric, null::numeric),
    ('Chase Business Credit Card', 'Chase', 'credit_card', 'New business credit card', null::numeric, null::numeric)
  ) as seed(name, institution, account_type, purpose, minimum_balance_target, promotion_amount)
  where not exists (select 1 from public.bank_accounts existing where existing.business_id = demi_id and lower(existing.name) = lower(seed.name));
  update public.bank_accounts set minimum_balance_days = 60
  where business_id = demi_id and name = 'Chase Business Complete Checking' and minimum_balance_days is null;
  insert into public.digital_asset_accounts (business_id, name, provider, account_type)
  values (demi_id, 'Temporary Crypto Holding', null, 'exchange')
  on conflict (business_id, name) do nothing;
end $$;
