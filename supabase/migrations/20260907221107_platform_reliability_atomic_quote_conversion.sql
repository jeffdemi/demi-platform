-- Additive RPC; historical migration files remain immutable.
create function public.convert_quote_to_job_with_values(
  target_business_id bigint, target_quote_id bigint, job_values jsonb
) returns bigint
language plpgsql security invoker set search_path = '' as $$
declare
  q public.quotes%rowtype;
  j public.jobs%rowtype;
  new_id bigint;
begin
  if not coalesce(private.is_business_writer(target_business_id), false) then
    raise exception 'Business write access required.' using errcode = '42501';
  end if;
  select * into q from public.quotes
    where business_id = target_business_id and id = target_quote_id for update;
  if not found then
    raise exception 'Quote was not found.' using errcode = 'P0002';
  end if;
  if q.job_id is not null or q.status = 'converted' then
    raise exception 'This quote has already been converted.' using errcode = '23505';
  end if;
  if q.status <> 'accepted' or q.archived_at is not null then
    raise exception 'Only active accepted quotes may be converted.' using errcode = '23514';
  end if;
  if job_values is null or jsonb_typeof(job_values) <> 'object' then
    raise exception 'Job values must be an object.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(job_values) k where k <> all(array[
    'customer_id', 'status', 'job_date', 'scheduled_date', 'scheduled_start_time', 'estimated_duration_minutes', 'completed_date', 'service_address', 'municipality', 'property_location', 'location_description', 'referral_source', 'work_description', 'hazard_notes', 'amount_quoted', 'amount_paid', 'payment_method', 'paid_date', 'travel_minutes', 'grinding_minutes', 'cleanup_minutes', 'machine_hours', 'pro_bono', 'pa811_required', 'notes'
  ])) then
    raise exception 'Unsupported job field.' using errcode = '22023';
  end if;
  if job_values ? 'customer_id' and
    (job_values->>'customer_id')::bigint is distinct from q.customer_id then
    raise exception 'Job customer must match the quote.' using errcode = '23514';
  end if;
  j := jsonb_populate_record(null::public.jobs, jsonb_build_object(
    'status', 'quoted', 'service_address', q.service_address,
    'municipality', q.municipality, 'property_location', q.property_location,
    'location_description', q.location_description, 'referral_source', q.referral_source,
    'work_description', q.customer_scope, 'hazard_notes', q.hazard_notes,
    'amount_quoted', q.quoted_price, 'pro_bono', q.pro_bono,
    'pa811_required', q.pa811_required, 'notes', q.acceptance_notes
  ) || job_values);
  insert into public.jobs (business_id, customer_id, quote_id,
    status, job_date, scheduled_date, scheduled_start_time, estimated_duration_minutes, completed_date, service_address, municipality, property_location, location_description, referral_source, work_description, hazard_notes, amount_quoted, amount_paid, payment_method, paid_date, travel_minutes, grinding_minutes, cleanup_minutes, machine_hours, pro_bono, pa811_required, notes
  ) values (q.business_id, q.customer_id, q.id,
    j.status, j.job_date, j.scheduled_date, j.scheduled_start_time, j.estimated_duration_minutes, j.completed_date, j.service_address, j.municipality, j.property_location, j.location_description, j.referral_source, j.work_description, j.hazard_notes, j.amount_quoted, j.amount_paid, j.payment_method, j.paid_date, j.travel_minutes, j.grinding_minutes, j.cleanup_minutes, j.machine_hours, j.pro_bono, j.pa811_required, j.notes
  ) returning id into new_id;
  update public.quotes set job_id = new_id, status = 'converted', updated_at = now()
    where business_id = target_business_id and id = q.id and job_id is null;
  if not found then
    raise exception 'Quote link could not be saved.' using errcode = '40001';
  end if;
  return new_id;
end;
$$;
revoke all on function public.convert_quote_to_job_with_values(bigint, bigint, jsonb) from public, anon;
grant execute on function public.convert_quote_to_job_with_values(bigint, bigint, jsonb) to authenticated;

-- Preserve older clients while sharing the same transaction and authorization.
create or replace function public.convert_quote_to_job(target_quote_id bigint)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare b bigint;
begin
  select business_id into b from public.quotes where id = target_quote_id;
  if not found then
    raise exception 'Quote was not found.' using errcode = 'P0002';
  end if;
  return public.convert_quote_to_job_with_values(b, target_quote_id, '{}'::jsonb);
end;
$$;
revoke all on function public.convert_quote_to_job(bigint) from public, anon;
grant execute on function public.convert_quote_to_job(bigint) to authenticated;
