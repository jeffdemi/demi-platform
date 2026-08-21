-- Allows an existing business owner to create additional, fully separate
-- business workspaces (they become the new business's owner too), so one
-- person can run more than one business through the platform.
--
-- The one-time platform bootstrap path (zero businesses, zero memberships,
-- initial owner email only) is unchanged. Members who are not an owner of
-- any business still cannot create one.

create or replace function private.create_business_legacy_implementation(business_name text)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  caller_email text;
  new_business_id bigint;
  normalized_name text := trim(business_name);
  caller_owns_a_business boolean;
  caller_has_any_membership boolean;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(normalized_name) < 2 or char_length(normalized_name) > 120 then
    raise exception 'Business name must contain between 2 and 120 characters'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtext('demi-platform-create-business'));

  select exists (
    select 1 from public.business_members
    where user_id = caller_id and active and role = 'owner'
  ) into caller_owns_a_business;

  if not caller_owns_a_business then
    select exists (
      select 1 from public.business_members
      where user_id = caller_id and active
    ) into caller_has_any_membership;

    if caller_has_any_membership then
      raise exception 'Only business owners can create additional businesses' using errcode = '42501';
    end if;

    select email into caller_email from auth.users where id = caller_id;
    if lower(coalesce(caller_email, '')) <> 'jeffdemi@gmail.com' then
      raise exception 'Email is not authorized for initial setup' using errcode = '42501';
    end if;

    if exists (select 1 from public.businesses) then
      raise exception 'Workspace creation is closed' using errcode = '42501';
    end if;
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
