create table public.job_imports (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  file_name text not null check (nullif(trim(file_name), '') is not null),
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  row_count integer not null check (row_count >= 0),
  customers_created integer not null default 0 check (customers_created >= 0),
  customers_updated integer not null default 0 check (customers_updated >= 0),
  jobs_created integer not null default 0 check (jobs_created >= 0),
  duplicates_skipped integer not null default 0 check (duplicates_skipped >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (business_id, source_sha256)
);

create index job_imports_business_created_idx
  on public.job_imports (business_id, created_at desc);

alter table public.job_imports enable row level security;

create policy job_imports_business_access on public.job_imports for all to authenticated
  using ((select private.is_business_member(business_id)))
  with check ((select private.is_business_member(business_id)) and created_by = (select auth.uid()));

grant select, insert on public.job_imports to authenticated;
grant usage, select on sequence public.job_imports_id_seq to authenticated;

create or replace function public.convert_quote_to_job(target_quote_id bigint)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  quote_record public.quotes%rowtype;
  new_job_id bigint;
begin
  select * into quote_record
  from public.quotes
  where id = target_quote_id
  for update;

  if not found then
    raise exception 'Quote was not found.' using errcode = 'P0002';
  end if;
  if quote_record.status <> 'accepted' then
    raise exception 'Only accepted quotes may be converted to jobs.' using errcode = '23514';
  end if;
  if quote_record.job_id is not null then
    raise exception 'This quote has already been converted.' using errcode = '23505';
  end if;

  insert into public.jobs (
    business_id, customer_id, quote_id, status, service_address, municipality,
    property_location, location_description, referral_source, work_description,
    hazard_notes, amount_quoted, pro_bono, pa811_required, notes
  ) values (
    quote_record.business_id, quote_record.customer_id, quote_record.id, 'quoted',
    quote_record.service_address, quote_record.municipality,
    quote_record.property_location, quote_record.location_description,
    quote_record.referral_source, quote_record.customer_scope,
    quote_record.hazard_notes, quote_record.quoted_price,
    quote_record.pro_bono, quote_record.pa811_required, quote_record.acceptance_notes
  ) returning id into new_job_id;

  update public.quotes
  set status = 'converted', job_id = new_job_id, updated_at = now()
  where id = quote_record.id and job_id is null;

  return new_job_id;
end;
$$;

revoke all on function public.convert_quote_to_job(bigint) from public, anon;
grant execute on function public.convert_quote_to_job(bigint) to authenticated;

create or replace function public.create_invoice_record(
  target_business_id bigint,
  target_customer_id bigint,
  target_job_id bigint,
  invoice_amount numeric,
  invoice_on date,
  due_on date,
  terms text,
  invoice_status text,
  paid_on date,
  invoice_notes text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_number integer;
  generated_number text;
  new_invoice_id bigint;
begin
  if invoice_status not in ('draft', 'unpaid', 'paid', 'void') then
    raise exception 'Unsupported invoice status.' using errcode = '22023';
  end if;
  if invoice_amount < 0 then
    raise exception 'Invoice amount cannot be negative.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.customers
    where business_id = target_business_id and id = target_customer_id
  ) then
    raise exception 'Customer was not found.' using errcode = '23503';
  end if;
  if target_job_id is not null and not exists (
    select 1 from public.jobs
    where business_id = target_business_id and id = target_job_id
      and customer_id = target_customer_id
  ) then
    raise exception 'Job was not found for this customer.' using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_business_id::text || ':' || extract(year from invoice_on)::text, 0));
  select coalesce(max(substring(invoice_number from '[0-9]+$')::integer), 0) + 1
  into next_number
  from public.invoices
  where business_id = target_business_id
    and invoice_number like 'INV-' || extract(year from invoice_on)::integer || '-%';
  generated_number := 'INV-' || extract(year from invoice_on)::integer || '-' || lpad(next_number::text, 4, '0');

  insert into public.invoices (
    business_id, customer_id, job_id, invoice_number, amount, invoice_date,
    due_date, payment_terms, status, paid_date, notes
  ) values (
    target_business_id, target_customer_id, target_job_id, generated_number,
    invoice_amount, invoice_on, due_on, nullif(trim(terms), ''), invoice_status,
    paid_on, nullif(trim(invoice_notes), '')
  ) returning id into new_invoice_id;

  if target_job_id is not null and invoice_status <> 'void' then
    update public.jobs
    set status = case when invoice_status = 'paid' then 'paid' else 'invoiced' end,
        amount_paid = case when invoice_status = 'paid' then invoice_amount else amount_paid end,
        paid_date = case when invoice_status = 'paid' then coalesce(paid_on, invoice_on) else paid_date end,
        updated_at = now()
    where business_id = target_business_id and id = target_job_id
      and status <> 'cancelled';
  end if;

  return new_invoice_id;
end;
$$;

revoke all on function public.create_invoice_record(bigint, bigint, bigint, numeric, date, date, text, text, date, text) from public, anon;
grant execute on function public.create_invoice_record(bigint, bigint, bigint, numeric, date, date, text, text, date, text) to authenticated;

create or replace function public.add_maintenance_record(
  target_business_id bigint,
  target_equipment_id bigint,
  serviced_on date,
  maintenance_type text,
  meter_hours numeric,
  maintenance_cost numeric,
  due_on date,
  due_hours numeric,
  maintenance_notes text
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_maintenance_id bigint;
begin
  if nullif(trim(maintenance_type), '') is null then
    raise exception 'Service type is required.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.equipment
    where business_id = target_business_id and id = target_equipment_id
  ) then
    raise exception 'Equipment was not found.' using errcode = '23503';
  end if;

  insert into public.maintenance (
    business_id, equipment_id, service_date, service_type, hour_meter,
    cost, next_due_date, next_due_hours, notes
  ) values (
    target_business_id, target_equipment_id, serviced_on, trim(maintenance_type),
    meter_hours, maintenance_cost, due_on, due_hours, nullif(trim(maintenance_notes), '')
  ) returning id into new_maintenance_id;

  if meter_hours is not null then
    update public.equipment
    set hour_meter = greatest(coalesce(hour_meter, 0), meter_hours), updated_at = now()
    where business_id = target_business_id and id = target_equipment_id;
  end if;

  return new_maintenance_id;
end;
$$;

revoke all on function public.add_maintenance_record(bigint, bigint, date, text, numeric, numeric, date, numeric, text) from public, anon;
grant execute on function public.add_maintenance_record(bigint, bigint, date, text, numeric, numeric, date, numeric, text) to authenticated;

create or replace function public.import_job_spreadsheet(
  target_business_id bigint,
  import_file_name text,
  import_source_sha256 text,
  import_rows jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  row_data jsonb;
  customer_id_value bigint;
  customer_name_value text;
  phone_value text;
  status_value text;
  created_customers integer := 0;
  updated_customers integer := 0;
  created_jobs integer := 0;
  skipped_jobs integer := 0;
  prior_import public.job_imports%rowtype;
  result jsonb;
begin
  if import_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid spreadsheet fingerprint.' using errcode = '22023';
  end if;
  if not (select private.is_business_member(target_business_id)) then
    raise exception 'Business access is required.' using errcode = '42501';
  end if;

  select * into prior_import from public.job_imports
  where business_id = target_business_id and source_sha256 = import_source_sha256;
  if found then
    return jsonb_build_object(
      'already_imported', true, 'customers_created', prior_import.customers_created,
      'customers_updated', prior_import.customers_updated, 'jobs_created', prior_import.jobs_created,
      'duplicates_skipped', prior_import.duplicates_skipped
    );
  end if;

  for row_data in select value from jsonb_array_elements(coalesce(import_rows, '[]'::jsonb)) loop
    if exists (
      select 1 from public.jobs where business_id = target_business_id
        and import_fingerprint = row_data ->> 'fingerprint'
    ) then
      skipped_jobs := skipped_jobs + 1;
      continue;
    end if;

    customer_name_value := trim(row_data ->> 'customerName');
    phone_value := nullif(trim(row_data ->> 'phone'), '');
    select id into customer_id_value from public.customers
    where business_id = target_business_id and (
      lower(trim(coalesce(company_name, ''))) = lower(customer_name_value)
      or lower(trim(concat_ws(' ', first_name, last_name))) = lower(customer_name_value)
      or (phone_value is not null and phone = phone_value)
    ) order by active desc, id limit 1;

    if found then
      if phone_value is not null and not exists (
        select 1 from public.customers where id = customer_id_value and phone is not null
      ) then
        update public.customers set phone = phone_value, updated_at = now() where id = customer_id_value;
        updated_customers := updated_customers + 1;
      end if;
    else
      if lower(customer_name_value) ~ '\\m(llc|inc|company|corp|corporation|church|landscaping|peak|vcc)\\M' then
        insert into public.customers (business_id, customer_type, company_name, phone)
        values (target_business_id, 'company', customer_name_value, phone_value)
        returning id into customer_id_value;
      elsif position(' ' in customer_name_value) = 0 then
        insert into public.customers (business_id, customer_type, first_name, phone)
        values (target_business_id, 'individual', customer_name_value, phone_value)
        returning id into customer_id_value;
      else
        insert into public.customers (business_id, customer_type, first_name, last_name, phone)
        values (
          target_business_id, 'individual',
          regexp_replace(customer_name_value, '\\s+[^ ]+$', ''),
          substring(customer_name_value from '[^ ]+$'), phone_value
        ) returning id into customer_id_value;
      end if;
      created_customers := created_customers + 1;
    end if;

    status_value := lower(regexp_replace(coalesce(row_data ->> 'status', 'lead'), '\\s+', '_', 'g'));
    if status_value not in ('lead', 'quoted', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid', 'cancelled', 'pending', 'no_response') then
      status_value := 'lead';
    end if;
    insert into public.jobs (
      business_id, customer_id, source_job_number, job_date, service_address,
      referral_source, work_description, amount_quoted, amount_paid, payment_method,
      status, paid_date, notes, import_fingerprint
    ) values (
      target_business_id, customer_id_value, nullif(row_data ->> 'jobNumber', ''),
      nullif(row_data ->> 'jobDate', '')::date, nullif(row_data ->> 'address', ''),
      nullif(row_data ->> 'referralSource', ''), nullif(row_data ->> 'description', ''),
      nullif(row_data ->> 'amountQuoted', '')::numeric, nullif(row_data ->> 'amountPaid', '')::numeric,
      nullif(row_data ->> 'paymentMethod', ''), status_value,
      nullif(row_data ->> 'paidDate', '')::date, nullif(row_data ->> 'notes', ''),
      row_data ->> 'fingerprint'
    );
    created_jobs := created_jobs + 1;
  end loop;

  insert into public.job_imports (
    business_id, file_name, source_sha256, row_count, customers_created,
    customers_updated, jobs_created, duplicates_skipped, created_by
  ) values (
    target_business_id, import_file_name, import_source_sha256,
    jsonb_array_length(coalesce(import_rows, '[]'::jsonb)), created_customers,
    updated_customers, created_jobs, skipped_jobs, auth.uid()
  );

  result := jsonb_build_object(
    'already_imported', false, 'customers_created', created_customers,
    'customers_updated', updated_customers, 'jobs_created', created_jobs,
    'duplicates_skipped', skipped_jobs
  );
  return result;
end;
$$;

revoke all on function public.import_job_spreadsheet(bigint, text, text, jsonb) from public, anon;
grant execute on function public.import_job_spreadsheet(bigint, text, text, jsonb) to authenticated;
