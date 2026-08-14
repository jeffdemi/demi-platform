-- Add a transactional bulk classifier and apply the user-confirmed historical
-- classification: all existing operating records belong to stump grinding.

create or replace function public.assign_unclassified_business_line(
  target_business_id bigint,
  target_business_line_id bigint
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  jobs_count integer := 0;
  invoices_count integer := 0;
  expenses_count integer := 0;
  equipment_count integer := 0;
  labor_count integer := 0;
  payments_count integer := 0;
  journals_count integer := 0;
begin
  if not private.is_business_admin(target_business_id) then
    raise exception 'Not authorized.';
  end if;

  if not exists (
    select 1
    from public.business_lines
    where business_id = target_business_id
      and id = target_business_line_id
      and active
  ) then
    raise exception 'Business line not found.';
  end if;

  update public.jobs
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null;
  get diagnostics jobs_count = row_count;

  update public.invoices
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null;
  get diagnostics invoices_count = row_count;

  update public.expenses
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null and voided_at is null;
  get diagnostics expenses_count = row_count;

  update public.equipment
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null and active;
  get diagnostics equipment_count = row_count;

  update public.labor_entries
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null and voided_at is null;
  get diagnostics labor_count = row_count;

  update public.payments
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null and voided_at is null;
  get diagnostics payments_count = row_count;

  update public.journal_entries
  set business_line_id = target_business_line_id
  where business_id = target_business_id and business_line_id is null and status = 'posted';
  get diagnostics journals_count = row_count;

  return jsonb_build_object(
    'jobs', jobs_count,
    'invoices', invoices_count,
    'expenses', expenses_count,
    'equipment', equipment_count,
    'labor', labor_count,
    'payments', payments_count,
    'journals', journals_count,
    'total', jobs_count + invoices_count + expenses_count + equipment_count + labor_count + payments_count + journals_count
  );
end;
$$;

revoke all on function public.assign_unclassified_business_line(bigint, bigint) from public, anon;
grant execute on function public.assign_unclassified_business_line(bigint, bigint) to authenticated;

do $$
declare
  demi_id bigint;
  stump_line_id bigint;
begin
  select id into strict demi_id
  from public.businesses
  where active and lower(trim(legal_name)) = 'demi solutions llc';

  select id into strict stump_line_id
  from public.business_lines
  where business_id = demi_id and code = 'stump_grinding' and active;

  update public.jobs set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null;
  update public.invoices set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null;
  update public.expenses set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null and voided_at is null;
  update public.equipment set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null and active;
  update public.labor_entries set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null and voided_at is null;
  update public.payments set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null and voided_at is null;
  update public.journal_entries set business_line_id = stump_line_id
  where business_id = demi_id and business_line_id is null and status = 'posted';
end;
$$;
