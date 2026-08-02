create index business_invitations_accepted_by_idx
  on public.business_invitations (accepted_by)
  where accepted_by is not null;

drop policy business_invitations_select on public.business_invitations;
create policy business_invitations_select on public.business_invitations
  for select to authenticated
  using (
    (select private.is_business_admin(business_id))
    or lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', ''))
  );
