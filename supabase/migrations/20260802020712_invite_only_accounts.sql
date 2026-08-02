create table public.business_invitations (
  id uuid primary key default gen_random_uuid(),
  business_id bigint not null references public.businesses(id) on delete cascade,
  email text not null check (email = lower(trim(email)) and char_length(email) between 3 and 320),
  role text not null default 'employee' check (role in ('admin', 'employee')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked', 'expired')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_invitations_business_id_id_unique unique (business_id, id)
);

create unique index business_invitations_pending_email_idx
  on public.business_invitations (business_id, lower(email))
  where status = 'pending';
create index business_invitations_business_status_idx
  on public.business_invitations (business_id, status, created_at desc);
create index business_invitations_invited_by_idx
  on public.business_invitations (invited_by);

create trigger business_invitations_set_updated_at
  before update on public.business_invitations
  for each row execute function private.set_updated_at();

alter table public.business_invitations enable row level security;

create policy business_invitations_select on public.business_invitations
  for select to authenticated
  using (
    (select private.is_business_admin(business_id))
    or lower(email) = lower(coalesce((select auth.jwt() ->> 'email'), ''))
  );

create policy business_invitations_insert_admin on public.business_invitations
  for insert to authenticated
  with check (
    (select private.is_business_admin(business_id))
    and invited_by = (select auth.uid())
    and status = 'pending'
    and accepted_by is null
    and accepted_at is null
  );

create policy business_invitations_update_admin on public.business_invitations
  for update to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));

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

  if lower(coalesce((select email from auth.users where id = caller_id), '')) <> 'jeffdemi@gmail.com' then
    raise exception 'Email is not authorized for initial setup' using errcode = '42501';
  end if;

  perform pg_advisory_xact_lock(hashtext('demi-platform-create-business'));

  if exists (select 1 from public.businesses) then
    raise exception 'Workspace creation is closed' using errcode = '42501';
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

  insert into public.profiles (id, full_name)
  select caller_id, nullif(trim(raw_user_meta_data ->> 'full_name'), '')
  from auth.users
  where id = caller_id
  on conflict (id) do nothing;

  return new_business_id;
end;
$$;

create or replace function public.platform_setup_available()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.businesses);
$$;

revoke all on function public.platform_setup_available() from public;
grant execute on function public.platform_setup_available() to anon, authenticated;

create or replace function public.accept_business_invitation(
  invitation_id uuid,
  member_full_name text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  invitation public.business_invitations%rowtype;
begin
  if caller_id is null then
    raise exception 'Authentication is required.';
  end if;

  select lower(email) into caller_email
  from auth.users
  where id = caller_id;

  select * into invitation
  from public.business_invitations
  where id = invitation_id
  for update;

  if invitation.id is null then
    raise exception 'Invitation not found.';
  end if;

  if invitation.status = 'accepted' and invitation.accepted_by = caller_id then
    return invitation.business_id;
  end if;

  if invitation.status <> 'pending' then
    raise exception 'Invitation is no longer available.';
  end if;

  if invitation.expires_at <= now() then
    update public.business_invitations
    set status = 'expired'
    where id = invitation.id;
    raise exception 'Invitation has expired.';
  end if;

  if caller_email is null or caller_email <> lower(invitation.email) then
    raise exception 'Invitation does not belong to this account.';
  end if;

  insert into public.business_members (business_id, user_id, role, active)
  values (invitation.business_id, caller_id, invitation.role, true)
  on conflict (business_id, user_id) do update
  set active = true,
      role = case
        when public.business_members.role = 'owner' then public.business_members.role
        else excluded.role
      end,
      updated_at = now();

  insert into public.profiles (id, full_name)
  values (caller_id, nullif(trim(member_full_name), ''))
  on conflict (id) do update
  set full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name),
      updated_at = now();

  update public.business_invitations
  set status = 'accepted',
      accepted_by = caller_id,
      accepted_at = now()
  where id = invitation.id;

  return invitation.business_id;
end;
$$;

revoke all on function public.accept_business_invitation(uuid, text) from public, anon;
grant execute on function public.accept_business_invitation(uuid, text) to authenticated;
