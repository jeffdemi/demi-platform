-- User-initiated SimpleFIN bank activity sync. Credentials are encrypted by the
-- application before storage and are never granted to authenticated clients.

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  provider text not null default 'simplefin' check (provider in ('simplefin')),
  provider_connection_id text not null,
  institution_name text not null check (nullif(trim(institution_name), '') is not null),
  status text not null default 'active' check (status in ('active', 'disconnected', 'error')),
  last_synced_at timestamptz,
  last_error text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, provider, provider_connection_id)
);

create table public.bank_connection_secrets (
  connection_id uuid primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  encrypted_access_token text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (business_id, connection_id)
    references public.bank_connections(business_id, id) on delete cascade
);

create table public.bank_connection_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  connection_id uuid not null,
  provider_institution_connection_id text not null,
  provider_account_id text not null,
  provider_account_name text not null,
  provider_account_type text not null,
  provider_account_subtype text not null,
  institution_id text,
  institution_name text not null,
  last_four text check (last_four is null or last_four ~ '^[0-9]{4}$'),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  provider_status text not null default 'open',
  bank_account_id bigint,
  selected boolean not null default false,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, connection_id, provider_institution_connection_id, provider_account_id),
  foreign key (business_id, connection_id)
    references public.bank_connections(business_id, id) on delete cascade,
  foreign key (business_id, bank_account_id)
    references public.bank_accounts(business_id, id),
  check (not selected or bank_account_id is not null)
);

create unique index bank_connection_accounts_selected_bank_idx
  on public.bank_connection_accounts (business_id, bank_account_id)
  where selected and bank_account_id is not null;

create table public.bank_sync_runs (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  provider text not null default 'simplefin' check (provider in ('simplefin')),
  status text not null default 'previewed' check (status in ('previewed', 'confirmed', 'failed')),
  preview jsonb not null,
  summary jsonb not null default '{}'::jsonb,
  result jsonb,
  error_message text,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  check (jsonb_typeof(preview) = 'object'),
  check (jsonb_typeof(summary) = 'object')
);

alter table public.bank_transactions
  add column provider text,
  add column provider_transaction_id text,
  add column provider_status text,
  add column provider_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(provider_metadata) = 'object'),
  add constraint bank_transactions_provider_fields_check check (
    (provider is null and provider_transaction_id is null and provider_status is null)
    or (provider = 'simplefin' and nullif(trim(provider_transaction_id), '') is not null
      and provider_status = 'posted')
  );

create unique index bank_transactions_provider_id_idx
  on public.bank_transactions (business_id, account_id, provider, provider_transaction_id)
  where provider is not null and provider_transaction_id is not null;

create index bank_connections_business_status_idx
  on public.bank_connections (business_id, status, institution_name);
create index bank_connections_created_by_idx on public.bank_connections (created_by);
create index bank_connection_secrets_business_idx on public.bank_connection_secrets (business_id);
create index bank_connection_accounts_connection_idx
  on public.bank_connection_accounts (business_id, connection_id, selected);
create index bank_connection_accounts_bank_idx
  on public.bank_connection_accounts (business_id, bank_account_id)
  where bank_account_id is not null;
create index bank_sync_runs_business_created_idx
  on public.bank_sync_runs (business_id, created_at desc);
create index bank_sync_runs_created_by_idx on public.bank_sync_runs (created_by);

create trigger bank_connections_set_updated_at before update on public.bank_connections
  for each row execute function private.set_updated_at();
create trigger bank_connection_secrets_set_updated_at before update on public.bank_connection_secrets
  for each row execute function private.set_updated_at();
create trigger bank_connection_accounts_set_updated_at before update on public.bank_connection_accounts
  for each row execute function private.set_updated_at();
create trigger bank_sync_runs_set_updated_at before update on public.bank_sync_runs
  for each row execute function private.set_updated_at();

alter table public.bank_connections enable row level security;
alter table public.bank_connection_secrets enable row level security;
alter table public.bank_connection_accounts enable row level security;
alter table public.bank_sync_runs enable row level security;

create policy bank_connections_member_select on public.bank_connections
  for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy bank_connections_admin_insert on public.bank_connections
  for insert to authenticated
  with check ((select private.is_business_admin(business_id)) and created_by = (select auth.uid()));
create policy bank_connections_admin_update on public.bank_connections
  for update to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy bank_connections_admin_delete on public.bank_connections
  for delete to authenticated
  using ((select private.is_business_admin(business_id)));

create policy bank_connection_accounts_member_select on public.bank_connection_accounts
  for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy bank_connection_accounts_admin_insert on public.bank_connection_accounts
  for insert to authenticated
  with check ((select private.is_business_admin(business_id)));
create policy bank_connection_accounts_admin_update on public.bank_connection_accounts
  for update to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
create policy bank_connection_accounts_admin_delete on public.bank_connection_accounts
  for delete to authenticated
  using ((select private.is_business_admin(business_id)));

create policy bank_sync_runs_member_select on public.bank_sync_runs
  for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy bank_sync_runs_admin_insert on public.bank_sync_runs
  for insert to authenticated
  with check ((select private.is_business_admin(business_id)) and created_by = (select auth.uid()));
create policy bank_sync_runs_admin_update on public.bank_sync_runs
  for update to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));

grant select, insert, update, delete on public.bank_connections,
  public.bank_connection_accounts to authenticated;
grant select, insert, update on public.bank_sync_runs to authenticated;

revoke all on public.bank_connection_secrets from public, anon, authenticated;
grant select, insert, update, delete on public.bank_connection_secrets to service_role;

create or replace function public.confirm_bank_sync_run(
  target_business_id bigint,
  target_run_id uuid
)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  run_record public.bank_sync_runs%rowtype;
  account_data jsonb;
  row_data jsonb;
  account_record public.bank_connection_accounts%rowtype;
  import_record_id uuid;
  import_new_count integer;
  linked_count integer := 0;
  created_count integer := 0;
  skipped_count integer := 0;
  result_value jsonb;
begin
  if not private.is_business_admin(target_business_id) then
    raise exception 'Only an owner or administrator can confirm bank activity.' using errcode = '42501';
  end if;

  select * into run_record
  from public.bank_sync_runs
  where business_id = target_business_id and id = target_run_id
  for update;

  if not found then raise exception 'Bank sync preview not found.' using errcode = '22023'; end if;
  if run_record.status = 'confirmed' then return coalesce(run_record.result, '{}'::jsonb); end if;
  if run_record.status <> 'previewed' then
    raise exception 'Only a current bank sync preview can be confirmed.' using errcode = '22023';
  end if;
  if jsonb_typeof(run_record.preview -> 'accounts') <> 'array' then
    raise exception 'The bank sync preview is invalid.' using errcode = '22023';
  end if;

  for account_data in select value from jsonb_array_elements(run_record.preview -> 'accounts') loop
    select * into account_record
    from public.bank_connection_accounts
    where business_id = target_business_id
      and id = (account_data ->> 'connectionAccountId')::uuid
      and provider_account_id = account_data ->> 'providerAccountId'
      and provider_institution_connection_id = account_data ->> 'providerInstitutionConnectionId'
      and bank_account_id = (account_data ->> 'bankAccountId')::bigint
      and selected;
    if not found then
      skipped_count := skipped_count + coalesce(jsonb_array_length(account_data -> 'rows'), 0);
      continue;
    end if;

    select count(*) into import_new_count
    from jsonb_array_elements(account_data -> 'rows') item
    where item ->> 'outcome' = 'new';

    import_record_id := null;
    if import_new_count > 0 then
      insert into public.bank_imports
        (business_id, account_id, file_name, source_sha256, row_count, imported_by)
      values
        (target_business_id, account_record.bank_account_id,
         left(account_data ->> 'importName', 500),
         account_data ->> 'importSha256', import_new_count, auth.uid())
      on conflict (business_id, account_id, source_sha256) do update
        set file_name = excluded.file_name
      returning id into import_record_id;
    end if;

    for row_data in select value from jsonb_array_elements(account_data -> 'rows') loop
      if row_data ->> 'outcome' = 'existing' then
        update public.bank_transactions
        set provider = run_record.provider,
            provider_transaction_id = row_data ->> 'providerTransactionId',
            provider_status = 'posted',
            provider_metadata = coalesce(row_data -> 'metadata', '{}'::jsonb)
        where business_id = target_business_id
          and account_id = account_record.bank_account_id
          and id = (row_data ->> 'existingTransactionId')::bigint
          and (provider_transaction_id is null
            or (provider = run_record.provider and provider_transaction_id = row_data ->> 'providerTransactionId'));
        if found then linked_count := linked_count + 1; else skipped_count := skipped_count + 1; end if;
      elsif row_data ->> 'outcome' = 'new' and import_record_id is not null then
        insert into public.bank_transactions
          (business_id, account_id, import_id, transaction_date, posted_date,
           description, amount, currency, external_id, fingerprint, provider,
           provider_transaction_id, provider_status, provider_metadata)
        values
          (target_business_id, account_record.bank_account_id, import_record_id,
           (row_data ->> 'transactionDate')::date,
           coalesce(nullif(row_data ->> 'postedDate', '')::date, (row_data ->> 'transactionDate')::date),
           left(row_data ->> 'description', 2000),
           (row_data ->> 'amount')::numeric,
           coalesce(nullif(row_data ->> 'currency', ''), 'USD'),
           row_data ->> 'providerTransactionId',
           row_data ->> 'fingerprint', run_record.provider,
           row_data ->> 'providerTransactionId', 'posted',
           coalesce(row_data -> 'metadata', '{}'::jsonb))
        on conflict (business_id, account_id, fingerprint) do update
          set provider = run_record.provider,
              provider_transaction_id = excluded.provider_transaction_id,
              provider_status = excluded.provider_status,
              provider_metadata = excluded.provider_metadata
          where public.bank_transactions.provider_transaction_id is null
             or public.bank_transactions.provider_transaction_id = excluded.provider_transaction_id;
        if found then created_count := created_count + 1; else skipped_count := skipped_count + 1; end if;
      else
        skipped_count := skipped_count + 1;
      end if;
    end loop;

    update public.bank_connection_accounts
    set last_synced_at = now(), provider_status = 'open'
    where business_id = target_business_id and id = account_record.id;
    update public.bank_connections
    set last_synced_at = now(), last_error = null, status = 'active'
    where business_id = target_business_id and id = account_record.connection_id;
  end loop;

  result_value := jsonb_build_object(
    'linked', linked_count,
    'imported', created_count,
    'skipped', skipped_count
  );
  update public.bank_sync_runs
  set status = 'confirmed', result = result_value, confirmed_at = now()
  where business_id = target_business_id and id = target_run_id;
  return result_value;
end;
$$;

revoke all on function public.confirm_bank_sync_run(bigint, uuid) from public, anon;
grant execute on function public.confirm_bank_sync_run(bigint, uuid) to authenticated;

create or replace function public.save_bank_connection_mappings(
  target_business_id bigint,
  target_connection_id uuid,
  mappings jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  mapping jsonb;
  target_connection_account_id uuid;
  target_bank_account_id bigint;
begin
  if not private.is_business_admin(target_business_id) then
    raise exception 'Only an owner or administrator can map bank accounts.' using errcode = '42501';
  end if;
  if jsonb_typeof(mappings) <> 'array' or not exists (
    select 1 from public.bank_connections
    where business_id = target_business_id and id = target_connection_id
  ) then raise exception 'The bank account mapping is invalid.' using errcode = '22023'; end if;
  if exists (
    select 1 from (
      select value ->> 'bankAccountId' as bank_account_id, count(*)
      from jsonb_array_elements(mappings)
      where value ->> 'bankAccountId' is not null
      group by value ->> 'bankAccountId' having count(*) > 1
    ) duplicates
  ) then raise exception 'Each business account can be mapped only once.' using errcode = '22023'; end if;

  update public.bank_connection_accounts
  set bank_account_id = null, selected = false
  where business_id = target_business_id and connection_id = target_connection_id;

  for mapping in select value from jsonb_array_elements(mappings) loop
    target_connection_account_id := (mapping ->> 'connectionAccountId')::uuid;
    target_bank_account_id := nullif(mapping ->> 'bankAccountId', '')::bigint;
    if target_bank_account_id is null then continue; end if;
    if not exists (
      select 1 from public.bank_accounts
      where business_id = target_business_id and id = target_bank_account_id and active
    ) then raise exception 'Select an active business account.' using errcode = '22023'; end if;
    update public.bank_connection_accounts
    set bank_account_id = target_bank_account_id, selected = true
    where business_id = target_business_id and connection_id = target_connection_id
      and id = target_connection_account_id;
    if not found then raise exception 'A connected account mapping is invalid.' using errcode = '22023'; end if;
  end loop;
end;
$$;

revoke all on function public.save_bank_connection_mappings(bigint, uuid, jsonb) from public, anon;
grant execute on function public.save_bank_connection_mappings(bigint, uuid, jsonb) to authenticated;
