-- Mileage is a memo log, not a bookkeeping posting: nothing here ever touches
-- journal_entries/journal_lines/payments. Trips are suggested from existing job
-- addresses+dates and approved one at a time; approving only marks the trip row
-- itself, never any financial record.

create table public.mileage_settings (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  home_base_address text,
  irs_standard_mileage_rate numeric(6, 3) check (irs_standard_mileage_rate is null or irs_standard_mileage_rate >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id),
  unique (business_id, id)
);

create table public.mileage_trips (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  trip_date date not null,
  kind text not null check (kind in ('job_suggested', 'manual')),
  -- Snapshots, not live references: history shouldn't rewrite itself if home base changes later.
  home_base_address text not null,
  destination_address text not null,
  purpose text not null check (char_length(trim(purpose)) > 0),
  -- [{seq:int, from:text, to:text, miles:numeric|null, job_id:bigint|null}, ...]
  legs jsonb not null,
  total_miles numeric(8, 2) not null check (total_miles >= 0),
  needs_manual_distance boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id)
);

-- DB-enforced dedupe guard: a job can only ever appear on one trip. No grants to
-- authenticated at all -- the only way to write here is through
-- create_mileage_trip(), so the invariant can't be bypassed by a direct insert.
create table public.mileage_trip_jobs (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  trip_id bigint not null,
  job_id bigint not null,
  created_at timestamptz not null default now(),
  unique (business_id, job_id),
  foreign key (business_id, trip_id) references public.mileage_trips (business_id, id) on delete cascade,
  foreign key (business_id, job_id) references public.jobs (business_id, id) on delete cascade
);

create table public.mileage_geocode_cache (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  normalized_query text not null,
  address_text text not null,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  lookup_status text not null check (lookup_status in ('ok', 'failed')),
  provider text not null default 'nominatim',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, normalized_query)
);

-- Directional on purpose: real driving distance isn't symmetric, and OSRM itself
-- is directional. A manual correction (distance_source = 'manual_correction') is
-- what future lookups for this exact pair return instead of calling OSRM again --
-- this is the "learning" the feature requires.
create table public.mileage_distance_cache (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  origin_query text not null,
  destination_query text not null,
  miles numeric(8, 2),
  distance_source text not null check (distance_source in ('osrm', 'manual_correction')),
  corrected_by uuid references auth.users(id) on delete set null,
  corrected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, origin_query, destination_query)
);

create index mileage_trips_business_date_idx on public.mileage_trips (business_id, trip_date);
create index mileage_trips_pending_idx on public.mileage_trips (business_id, approved_at) where approved_at is null;
create index mileage_trip_jobs_trip_idx on public.mileage_trip_jobs (business_id, trip_id);

create trigger mileage_settings_set_updated_at before update on public.mileage_settings
  for each row execute function private.set_updated_at();
create trigger mileage_trips_set_updated_at before update on public.mileage_trips
  for each row execute function private.set_updated_at();
create trigger mileage_geocode_cache_set_updated_at before update on public.mileage_geocode_cache
  for each row execute function private.set_updated_at();
create trigger mileage_distance_cache_set_updated_at before update on public.mileage_distance_cache
  for each row execute function private.set_updated_at();

alter table public.mileage_settings enable row level security;
alter table public.mileage_trips enable row level security;
alter table public.mileage_trip_jobs enable row level security;
alter table public.mileage_geocode_cache enable row level security;
alter table public.mileage_distance_cache enable row level security;

-- Owner/admin-only, like financial_settings: the IRS rate and home base feed a tax report.
create policy mileage_settings_admin_access on public.mileage_settings for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));

create policy mileage_trips_select_business_member on public.mileage_trips for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy mileage_trips_insert_business_member on public.mileage_trips for insert to authenticated
  with check ((select private.is_business_member(business_id)));
create policy mileage_trips_update_business_member on public.mileage_trips for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

create policy mileage_trip_jobs_select_business_member on public.mileage_trip_jobs for select to authenticated
  using ((select private.is_business_member(business_id)));

create policy mileage_geocode_cache_select_business_member on public.mileage_geocode_cache for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy mileage_geocode_cache_insert_business_member on public.mileage_geocode_cache for insert to authenticated
  with check ((select private.is_business_member(business_id)));
create policy mileage_geocode_cache_update_business_member on public.mileage_geocode_cache for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

create policy mileage_distance_cache_select_business_member on public.mileage_distance_cache for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy mileage_distance_cache_insert_business_member on public.mileage_distance_cache for insert to authenticated
  with check ((select private.is_business_member(business_id)));
create policy mileage_distance_cache_update_business_member on public.mileage_distance_cache for update to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)));

grant select, insert, update on public.mileage_settings to authenticated;
grant select, insert, update on public.mileage_trips to authenticated;
grant select on public.mileage_trip_jobs to authenticated;
grant select, insert, update on public.mileage_geocode_cache to authenticated;
grant select, insert, update on public.mileage_distance_cache to authenticated;

grant usage, select on sequence public.mileage_settings_id_seq to authenticated;
grant usage, select on sequence public.mileage_trips_id_seq to authenticated;
grant usage, select on sequence public.mileage_geocode_cache_id_seq to authenticated;
grant usage, select on sequence public.mileage_distance_cache_id_seq to authenticated;
-- No sequence grant for mileage_trip_jobs: authenticated never inserts it directly.

-- security definer is required here (not the invoker style most write RPCs use)
-- specifically because mileage_trip_jobs intentionally has no grants to
-- authenticated -- this function is the only path that can write to it. The
-- explicit is_business_writer() check below is what replaces the authorization
-- RLS would otherwise provide.
create function public.create_mileage_trip(
  target_business_id bigint,
  target_trip_date date,
  target_kind text,
  target_home_base_address text,
  target_destination_address text,
  target_purpose text,
  target_legs jsonb,
  target_total_miles numeric,
  target_needs_manual_distance boolean,
  target_job_ids bigint[],
  target_created_by uuid
) returns bigint language plpgsql security definer set search_path = '' as $$
declare
  new_trip_id bigint;
  linked_count int;
begin
  if not coalesce(private.is_business_writer(target_business_id), false) then
    raise exception 'Mileage write access required.' using errcode = '42501';
  end if;
  if target_kind not in ('job_suggested', 'manual') then
    raise exception 'Invalid trip kind.' using errcode = '22023';
  end if;

  insert into public.mileage_trips (
    business_id, trip_date, kind, home_base_address, destination_address,
    purpose, legs, total_miles, needs_manual_distance, created_by
  ) values (
    target_business_id, target_trip_date, target_kind, target_home_base_address,
    target_destination_address, target_purpose, target_legs, target_total_miles,
    target_needs_manual_distance, target_created_by
  ) returning id into new_trip_id;

  if target_job_ids is not null and array_length(target_job_ids, 1) > 0 then
    insert into public.mileage_trip_jobs (business_id, trip_id, job_id)
    select target_business_id, new_trip_id, job_id
    from unnest(target_job_ids) as job_id
    on conflict (business_id, job_id) do nothing;
    get diagnostics linked_count = row_count;
    if linked_count < array_length(target_job_ids, 1) then
      raise exception 'One or more jobs already have a mileage trip.' using errcode = '23505';
    end if;
  end if;

  return new_trip_id;
end;
$$;

revoke all on function public.create_mileage_trip(bigint, date, text, text, text, text, jsonb, numeric, boolean, bigint[], uuid) from public, anon;
grant execute on function public.create_mileage_trip(bigint, date, text, text, text, text, jsonb, numeric, boolean, bigint[], uuid) to authenticated;
