create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.businesses (
  id bigint generated always as identity primary key,
  name text not null check (char_length(trim(name)) between 2 and 120),
  legal_name text,
  phone text,
  email text,
  address_line_1 text,
  address_line_2 text,
  city text,
  region text,
  postal_code text,
  timezone text not null default 'America/New_York',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.business_members (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'employee')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create table public.customers (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  legacy_id bigint,
  customer_type text not null default 'individual' check (customer_type in ('individual', 'company')),
  company_name text,
  first_name text,
  last_name text,
  phone text,
  email text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, legacy_id),
  check (
    (customer_type = 'company' and nullif(trim(company_name), '') is not null)
    or
    (customer_type = 'individual' and (
      nullif(trim(first_name), '') is not null
      or nullif(trim(last_name), '') is not null
    ))
  )
);

create table public.quotes (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  customer_id bigint not null,
  legacy_id bigint,
  quote_number text not null,
  status text not null default 'draft' check (
    status in ('draft', 'sent', 'accepted', 'declined', 'no_response', 'expired', 'converted')
  ),
  quote_date date not null default current_date,
  expiration_date date,
  sent_date date,
  response_date date,
  contact_method text,
  referral_source text,
  service_address text,
  municipality text,
  property_location text,
  location_description text,
  hazard_notes text,
  customer_scope text,
  internal_notes text,
  normal_price numeric(12, 2) check (normal_price is null or normal_price >= 0),
  quoted_price numeric(12, 2) not null default 0 check (quoted_price >= 0),
  discount_reason text,
  pro_bono boolean not null default false,
  accepted_method text,
  acceptance_notes text,
  pa811_required boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, quote_number),
  unique (business_id, legacy_id),
  foreign key (business_id, customer_id)
    references public.customers(business_id, id)
);

create table public.jobs (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  customer_id bigint not null,
  quote_id bigint,
  legacy_id bigint,
  source_job_number text,
  status text not null default 'lead' check (
    status in (
      'lead', 'quoted', 'scheduled', 'in_progress', 'completed',
      'invoiced', 'paid', 'cancelled', 'pending', 'no_response'
    )
  ),
  job_date date,
  scheduled_date date,
  scheduled_start_time time,
  estimated_duration_minutes integer check (
    estimated_duration_minutes is null or estimated_duration_minutes >= 0
  ),
  completed_date date,
  service_address text,
  municipality text,
  property_location text,
  location_description text,
  referral_source text,
  work_description text,
  hazard_notes text,
  amount_quoted numeric(12, 2) check (amount_quoted is null or amount_quoted >= 0),
  amount_paid numeric(12, 2) check (amount_paid is null or amount_paid >= 0),
  payment_method text,
  paid_date date,
  travel_minutes integer check (travel_minutes is null or travel_minutes >= 0),
  grinding_minutes integer check (grinding_minutes is null or grinding_minutes >= 0),
  cleanup_minutes integer check (cleanup_minutes is null or cleanup_minutes >= 0),
  machine_hours numeric(8, 2) check (machine_hours is null or machine_hours >= 0),
  pro_bono boolean not null default false,
  pa811_required boolean not null default false,
  notes text,
  import_fingerprint text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, legacy_id),
  unique (business_id, import_fingerprint),
  foreign key (business_id, customer_id)
    references public.customers(business_id, id),
  foreign key (business_id, quote_id)
    references public.quotes(business_id, id)
);

alter table public.quotes
  add column job_id bigint,
  add constraint quotes_business_job_fkey
    foreign key (business_id, job_id)
    references public.jobs(business_id, id);

create table public.invoices (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  customer_id bigint not null,
  job_id bigint,
  legacy_id bigint,
  invoice_number text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  invoice_date date not null default current_date,
  due_date date,
  payment_terms text,
  status text not null default 'unpaid' check (status in ('draft', 'unpaid', 'paid', 'void')),
  paid_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, invoice_number),
  unique (business_id, legacy_id),
  foreign key (business_id, customer_id)
    references public.customers(business_id, id),
  foreign key (business_id, job_id)
    references public.jobs(business_id, id)
);

create table public.equipment (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  legacy_id bigint,
  name text not null check (nullif(trim(name), '') is not null),
  equipment_type text,
  make_model text,
  serial_number text,
  hour_meter numeric(10, 2) check (hour_meter is null or hour_meter >= 0),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, legacy_id)
);

create table public.maintenance (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  equipment_id bigint not null,
  legacy_id bigint,
  service_date date not null,
  service_type text not null check (nullif(trim(service_type), '') is not null),
  hour_meter numeric(10, 2) check (hour_meter is null or hour_meter >= 0),
  cost numeric(12, 2) check (cost is null or cost >= 0),
  next_due_date date,
  next_due_hours numeric(10, 2) check (next_due_hours is null or next_due_hours >= 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, legacy_id),
  foreign key (business_id, equipment_id)
    references public.equipment(business_id, id)
);

create table public.expenses (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  job_id bigint,
  equipment_id bigint,
  legacy_id bigint,
  expense_date date not null default current_date,
  category text not null check (nullif(trim(category), '') is not null),
  vendor text,
  description text,
  amount numeric(12, 2) not null check (amount >= 0),
  payment_method text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, legacy_id),
  foreign key (business_id, job_id)
    references public.jobs(business_id, id),
  foreign key (business_id, equipment_id)
    references public.equipment(business_id, id)
);

create unique index jobs_quote_id_unique_idx
  on public.jobs (business_id, quote_id)
  where quote_id is not null;
create unique index quotes_job_id_unique_idx
  on public.quotes (business_id, job_id)
  where job_id is not null;

create index business_members_user_active_idx
  on public.business_members (user_id, active);
create index customers_business_active_idx
  on public.customers (business_id, active);
create index customers_business_name_idx
  on public.customers (business_id, last_name, first_name);
create index jobs_business_status_idx
  on public.jobs (business_id, status);
create index jobs_business_schedule_idx
  on public.jobs (business_id, scheduled_date, scheduled_start_time);
create index jobs_customer_id_idx
  on public.jobs (business_id, customer_id);
create index quotes_business_status_idx
  on public.quotes (business_id, status);
create index quotes_business_date_idx
  on public.quotes (business_id, quote_date desc);
create index quotes_customer_id_idx
  on public.quotes (business_id, customer_id);
create index invoices_business_status_idx
  on public.invoices (business_id, status);
create index invoices_customer_id_idx
  on public.invoices (business_id, customer_id);
create index invoices_job_id_idx
  on public.invoices (business_id, job_id);
create index equipment_business_active_idx
  on public.equipment (business_id, active);
create index maintenance_equipment_id_idx
  on public.maintenance (business_id, equipment_id);
create index maintenance_business_due_idx
  on public.maintenance (business_id, next_due_date);
create index expenses_business_date_idx
  on public.expenses (business_id, expense_date desc);
create index expenses_job_id_idx
  on public.expenses (business_id, job_id);
create index expenses_equipment_id_idx
  on public.expenses (business_id, equipment_id);

create or replace function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger businesses_set_updated_at before update on public.businesses
  for each row execute function private.set_updated_at();
create trigger business_members_set_updated_at before update on public.business_members
  for each row execute function private.set_updated_at();
create trigger customers_set_updated_at before update on public.customers
  for each row execute function private.set_updated_at();
create trigger quotes_set_updated_at before update on public.quotes
  for each row execute function private.set_updated_at();
create trigger jobs_set_updated_at before update on public.jobs
  for each row execute function private.set_updated_at();
create trigger invoices_set_updated_at before update on public.invoices
  for each row execute function private.set_updated_at();
create trigger equipment_set_updated_at before update on public.equipment
  for each row execute function private.set_updated_at();
create trigger maintenance_set_updated_at before update on public.maintenance
  for each row execute function private.set_updated_at();
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function private.set_updated_at();

create or replace function private.is_business_member(requested_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = requested_business_id
      and user_id = (select auth.uid())
      and active
  );
$$;

create or replace function private.is_business_admin(requested_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = requested_business_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin')
      and active
  );
$$;

create or replace function private.is_business_owner(requested_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = requested_business_id
      and user_id = (select auth.uid())
      and role = 'owner'
      and active
  );
$$;

revoke all on function private.is_business_member(bigint) from public, anon;
revoke all on function private.is_business_admin(bigint) from public, anon;
revoke all on function private.is_business_owner(bigint) from public, anon;
grant execute on function private.is_business_member(bigint) to authenticated;
grant execute on function private.is_business_admin(bigint) to authenticated;
grant execute on function private.is_business_owner(bigint) to authenticated;

create or replace function public.create_business(business_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  new_business_id bigint;
  normalized_name text := trim(business_name);
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'Business name must contain between 2 and 120 characters'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.business_members
    where user_id = caller_id and active
  ) then
    raise exception 'User already belongs to a business' using errcode = '23514';
  end if;

  insert into public.businesses (name)
  values (normalized_name)
  returning id into new_business_id;

  insert into public.business_members (business_id, user_id, role)
  values (new_business_id, caller_id, 'owner');

  return new_business_id;
end;
$$;

revoke all on function public.create_business(text) from public, anon;
grant execute on function public.create_business(text) to authenticated;

alter table public.profiles enable row level security;
alter table public.businesses enable row level security;
alter table public.business_members enable row level security;
alter table public.customers enable row level security;
alter table public.quotes enable row level security;
alter table public.jobs enable row level security;
alter table public.invoices enable row level security;
alter table public.equipment enable row level security;
alter table public.maintenance enable row level security;
alter table public.expenses enable row level security;

create policy profiles_select_own on public.profiles for select to authenticated
  using ((select auth.uid()) = id);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);
create policy profiles_update_own on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

create policy businesses_select_member on public.businesses for select to authenticated
  using ((select private.is_business_member(id)));
create policy businesses_update_admin on public.businesses for update to authenticated
  using ((select private.is_business_admin(id)))
  with check ((select private.is_business_admin(id)));

create policy business_members_select on public.business_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_business_admin(business_id))
  );
create policy business_members_insert_owner on public.business_members for insert to authenticated
  with check ((select private.is_business_owner(business_id)));
create policy business_members_update_owner on public.business_members for update to authenticated
  using ((select private.is_business_owner(business_id)))
  with check ((select private.is_business_owner(business_id)));
create policy business_members_delete_owner on public.business_members for delete to authenticated
  using ((select private.is_business_owner(business_id)));

create policy customers_business_access on public.customers for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy quotes_business_access on public.quotes for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy jobs_business_access on public.jobs for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy invoices_business_access on public.invoices for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy equipment_business_access on public.equipment for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy maintenance_business_access on public.maintenance for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));
create policy expenses_business_access on public.expenses for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public grant usage, select on sequences to authenticated;
