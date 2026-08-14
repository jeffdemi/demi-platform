-- Crabtree-inspired management reporting foundation.
-- All changes are additive and preserve existing operational and accounting records.

alter table public.expenses
  add column financial_classification text not null default 'operating'
    check (financial_classification in ('cogs', 'operating', 'labor', 'asset', 'owner_distribution')),
  add column labor_class text,
  add column financial_classification_reviewed boolean not null default false;

update public.expenses
set financial_classification = 'asset',
    financial_classification_reviewed = true
where transaction_type = 'asset';

update public.expenses refund
set financial_classification = source.financial_classification,
    labor_class = source.labor_class,
    financial_classification_reviewed = source.financial_classification_reviewed
from public.expenses source
where refund.business_id = source.business_id
  and refund.refund_of_expense_id = source.id
  and refund.transaction_type = 'refund';

alter table public.expenses
  add constraint expenses_asset_classification_check check (
    (transaction_type <> 'asset' or financial_classification = 'asset')
    and (financial_classification <> 'asset' or transaction_type in ('asset', 'refund'))
  ),
  add constraint expenses_labor_class_check check (
    (financial_classification = 'labor' and labor_class in ('direct', 'management', 'sales'))
    or (financial_classification <> 'labor' and labor_class is null)
  );

create index expenses_business_financial_classification_idx
  on public.expenses (business_id, financial_classification, expense_date desc)
  where voided_at is null;
create index expenses_business_classification_review_idx
  on public.expenses (business_id, financial_classification_reviewed, expense_date desc)
  where voided_at is null;

alter table public.equipment
  add column purchase_date date,
  add column in_service_date date,
  add column purchase_cost numeric(12, 2) check (purchase_cost is null or purchase_cost >= 0),
  add column salvage_value numeric(12, 2) check (salvage_value is null or salvage_value >= 0),
  add column useful_life_months integer check (useful_life_months is null or useful_life_months > 0),
  add column depreciation_method text check (depreciation_method is null or depreciation_method = 'straight_line'),
  add column loan_lender text,
  add column loan_original_amount numeric(12, 2) check (loan_original_amount is null or loan_original_amount >= 0),
  add column loan_balance numeric(12, 2) check (loan_balance is null or loan_balance >= 0),
  add column loan_interest_rate numeric(7, 4) check (loan_interest_rate is null or loan_interest_rate between 0 and 100),
  add column loan_maturity_date date,
  add constraint equipment_salvage_not_above_cost_check check (
    purchase_cost is null or salvage_value is null or salvage_value <= purchase_cost
  );

create table public.financial_settings (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  owner_market_salary_annual numeric(12, 2) check (owner_market_salary_annual is null or owner_market_salary_annual >= 0),
  owner_labor_class text not null default 'management'
    check (owner_labor_class in ('direct', 'management', 'sales')),
  has_non_owner_labor boolean not null default false,
  reporting_basis text not null default 'cash' check (reporting_basis in ('cash', 'accrual')),
  target_total_ler numeric(6, 3) not null default 2.000 check (target_total_ler > 0),
  minimum_profit_to_gross_margin numeric(6, 4) not null default 0.1500
    check (minimum_profit_to_gross_margin between 0 and 1),
  target_profit_to_gross_margin numeric(6, 4) not null default 0.2000
    check (target_profit_to_gross_margin between 0 and 1),
  stretch_profit_to_gross_margin numeric(6, 4) not null default 0.2500
    check (stretch_profit_to_gross_margin between 0 and 1),
  core_capital_months numeric(5, 2) not null default 2.00 check (core_capital_months > 0),
  minimum_roic numeric(6, 4) not null default 0.5000 check (minimum_roic >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  unique (business_id, id),
  check (minimum_profit_to_gross_margin <= target_profit_to_gross_margin),
  check (target_profit_to_gross_margin <= stretch_profit_to_gross_margin)
);

create table public.owner_compensation_periods (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  period_month date not null,
  market_salary_amount numeric(12, 2) not null default 0 check (market_salary_amount >= 0),
  actual_wages numeric(12, 2) not null default 0 check (actual_wages >= 0),
  distributions numeric(12, 2) not null default 0 check (distributions >= 0),
  contributions numeric(12, 2) not null default 0 check (contributions >= 0),
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, period_month),
  unique (business_id, id),
  check (period_month = date_trunc('month', period_month)::date)
);

create table public.labor_entries (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  job_id bigint,
  worker_name text not null check (nullif(trim(worker_name), '') is not null),
  worker_type text not null default 'employee'
    check (worker_type in ('employee', 'owner', 'contractor')),
  labor_class text not null check (labor_class in ('direct', 'management', 'sales')),
  period_start date not null,
  period_end date not null,
  paid_date date,
  regular_hours numeric(8, 2) not null default 0 check (regular_hours >= 0),
  overtime_hours numeric(8, 2) not null default 0 check (overtime_hours >= 0),
  gross_wages numeric(12, 2) not null default 0 check (gross_wages >= 0),
  employer_payroll_taxes numeric(12, 2) not null default 0 check (employer_payroll_taxes >= 0),
  benefits numeric(12, 2) not null default 0 check (benefits >= 0),
  source text not null default 'manual' check (source in ('manual', 'import')),
  notes text,
  voided_at timestamptz,
  voided_by uuid references auth.users(id) on delete set null,
  void_reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  foreign key (business_id, job_id) references public.jobs(business_id, id),
  check (period_end >= period_start),
  check (gross_wages > 0 or employer_payroll_taxes > 0 or benefits > 0),
  check (voided_at is null or nullif(trim(void_reason), '') is not null)
);

create table public.monthly_financial_snapshots (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  period_month date not null,
  cash_book_balance numeric(12, 2) not null default 0,
  cash_bank_balance numeric(12, 2) not null default 0,
  accounts_receivable numeric(12, 2) not null default 0 check (accounts_receivable >= 0),
  accounts_payable numeric(12, 2) not null default 0 check (accounts_payable >= 0),
  inventory numeric(12, 2) not null default 0 check (inventory >= 0),
  taxes_payable numeric(12, 2) not null default 0 check (taxes_payable >= 0),
  credit_card_balance numeric(12, 2) not null default 0 check (credit_card_balance >= 0),
  short_term_debt numeric(12, 2) not null default 0 check (short_term_debt >= 0),
  long_term_debt numeric(12, 2) not null default 0 check (long_term_debt >= 0),
  fixed_assets_net numeric(12, 2) not null default 0 check (fixed_assets_net >= 0),
  notes text,
  reconciled_at timestamptz,
  reconciled_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, period_month),
  unique (business_id, id),
  check (period_month = date_trunc('month', period_month)::date)
);

create index labor_entries_business_period_idx
  on public.labor_entries (business_id, period_end desc, id desc)
  where voided_at is null;
create index labor_entries_business_class_idx
  on public.labor_entries (business_id, labor_class, period_end desc)
  where voided_at is null;
create index labor_entries_job_idx
  on public.labor_entries (business_id, job_id)
  where job_id is not null and voided_at is null;
create index owner_compensation_business_month_idx
  on public.owner_compensation_periods (business_id, period_month desc);
create index monthly_snapshots_business_month_idx
  on public.monthly_financial_snapshots (business_id, period_month desc);

create trigger financial_settings_set_updated_at before update on public.financial_settings
  for each row execute function private.set_updated_at();
create trigger owner_compensation_set_updated_at before update on public.owner_compensation_periods
  for each row execute function private.set_updated_at();
create trigger labor_entries_set_updated_at before update on public.labor_entries
  for each row execute function private.set_updated_at();
create trigger monthly_financial_snapshots_set_updated_at before update on public.monthly_financial_snapshots
  for each row execute function private.set_updated_at();

alter table public.financial_settings enable row level security;
alter table public.owner_compensation_periods enable row level security;
alter table public.labor_entries enable row level security;
alter table public.monthly_financial_snapshots enable row level security;

create policy financial_settings_admin_access on public.financial_settings for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy owner_compensation_admin_access on public.owner_compensation_periods for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy labor_entries_admin_access on public.labor_entries for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy monthly_financial_snapshots_admin_access on public.monthly_financial_snapshots for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));

grant select, insert, update on public.financial_settings,
  public.owner_compensation_periods, public.labor_entries,
  public.monthly_financial_snapshots to authenticated;
grant usage, select on sequence public.financial_settings_id_seq,
  public.owner_compensation_periods_id_seq, public.labor_entries_id_seq,
  public.monthly_financial_snapshots_id_seq to authenticated;

create or replace function private.ensure_default_ledger_accounts(target_business_id bigint)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.ledger_accounts
    (business_id, code, name, account_type, normal_balance, system_key)
  values
    (target_business_id, '1000', 'Cash and bank', 'asset', 'debit', 'cash'),
    (target_business_id, '1500', 'Equipment and fixed assets', 'asset', 'debit', 'fixed_assets'),
    (target_business_id, '3000', 'Owner equity', 'equity', 'credit', 'owner_equity'),
    (target_business_id, '4000', 'Service revenue', 'revenue', 'credit', 'service_revenue'),
    (target_business_id, '5000', 'Cost of goods sold', 'expense', 'debit', 'cogs'),
    (target_business_id, '6100', 'Labor expense', 'expense', 'debit', 'labor_expense'),
    (target_business_id, '6000', 'Operating expenses', 'expense', 'debit', 'operating_expense')
  on conflict (business_id, system_key) do nothing;
end;
$$;

create or replace function private.sync_expense_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_type text;
  source_classification text;
  expense_account text;
begin
  if new.voided_at is not null then
    update public.journal_entries set status = 'void'
    where business_id = new.business_id and source_type = 'expense'
      and source_id = new.id and status = 'posted';
    return new;
  end if;

  expense_account := case new.financial_classification
    when 'cogs' then 'cogs'
    when 'labor' then 'labor_expense'
    when 'asset' then 'fixed_assets'
    when 'owner_distribution' then 'owner_equity'
    else 'operating_expense'
  end;

  if new.transaction_type = 'asset' then
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Asset purchase'),
      'fixed_assets', 'cash', new.amount, auth.uid());
  elsif new.transaction_type = 'refund' then
    select transaction_type, financial_classification into source_type, source_classification
    from public.expenses
    where business_id = new.business_id and id = new.refund_of_expense_id;
    expense_account := case source_classification
      when 'cogs' then 'cogs'
      when 'labor' then 'labor_expense'
      when 'asset' then 'fixed_assets'
      when 'owner_distribution' then 'owner_equity'
      else case when source_type = 'asset' then 'fixed_assets' else 'operating_expense' end
    end;
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Purchase refund'),
      'cash', expense_account, new.amount, auth.uid());
  else
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Business outflow'),
      expense_account, 'cash', new.amount, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.ensure_default_ledger_accounts(bigint) from public, anon, authenticated;
revoke all on function private.sync_expense_journal() from public, anon, authenticated;

drop trigger if exists expenses_sync_journal on public.expenses;
create trigger expenses_sync_journal
after insert or update of expense_date, amount, transaction_type, financial_classification,
  refund_of_expense_id, vendor, description, voided_at on public.expenses
for each row execute function private.sync_expense_journal();
