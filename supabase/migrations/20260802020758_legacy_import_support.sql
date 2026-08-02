create table public.legacy_imports (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  source_name text not null,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  row_counts jsonb not null,
  imported_at timestamptz not null default now(),
  unique (business_id, source_sha256)
);

alter table public.legacy_imports enable row level security;

create policy legacy_imports_select_owner on public.legacy_imports
  for select to authenticated
  using ((select private.is_business_owner(business_id)));

create or replace function public.import_legacy_snapshot(
  target_business_id bigint,
  import_source_name text,
  import_source_sha256 text,
  import_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  counts jsonb;
begin
  if auth.role() <> 'service_role' then
    raise exception 'Service role is required.' using errcode = '42501';
  end if;

  if import_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid source fingerprint.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.businesses where id = target_business_id) then
    raise exception 'Target business not found.' using errcode = '23503';
  end if;

  if exists (
    select 1 from public.legacy_imports
    where business_id = target_business_id and legacy_imports.source_sha256 = import_source_sha256
  ) then
    select row_counts into counts
    from public.legacy_imports
    where business_id = target_business_id and legacy_imports.source_sha256 = import_source_sha256;
    return jsonb_build_object('already_imported', true, 'counts', counts);
  end if;

  insert into public.customers (
    business_id, legacy_id, customer_type, company_name, first_name, last_name,
    phone, email, notes, active, created_at, updated_at
  )
  select target_business_id, r.id, r.customer_type, r.company_name, r.first_name,
    r.last_name, r.phone, r.email, r.notes, r.active, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(import_payload -> 'customers', '[]'::jsonb)) as r(
    id bigint, customer_type text, company_name text, first_name text, last_name text,
    phone text, email text, notes text, active boolean, created_at timestamptz, updated_at timestamptz
  )
  on conflict (business_id, legacy_id) do update set
    customer_type = excluded.customer_type, company_name = excluded.company_name,
    first_name = excluded.first_name, last_name = excluded.last_name,
    phone = excluded.phone, email = excluded.email, notes = excluded.notes,
    active = excluded.active, created_at = excluded.created_at, updated_at = excluded.updated_at;

  insert into public.quotes (
    business_id, legacy_id, customer_id, quote_number, status, quote_date,
    expiration_date, sent_date, response_date, contact_method, referral_source,
    service_address, municipality, property_location, location_description,
    hazard_notes, customer_scope, internal_notes, normal_price, quoted_price,
    discount_reason, pro_bono, accepted_method, acceptance_notes, pa811_required,
    created_at, updated_at
  )
  select target_business_id, r.id, c.id, r.quote_number, r.status, r.quote_date,
    r.expiration_date, r.sent_date, r.response_date, r.contact_method, r.referral_source,
    r.service_address, r.municipality, r.property_location, r.location_description,
    r.hazard_notes, r.customer_scope, r.internal_notes, r.normal_price, r.quoted_price,
    r.discount_reason, r.pro_bono, r.accepted_method, r.acceptance_notes, r.pa811_required,
    r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(import_payload -> 'quotes', '[]'::jsonb)) as r(
    id bigint, customer_id bigint, quote_number text, status text, quote_date date,
    expiration_date date, sent_date date, response_date date, contact_method text,
    referral_source text, service_address text, municipality text, property_location text,
    location_description text, hazard_notes text, customer_scope text, internal_notes text,
    normal_price numeric, quoted_price numeric, discount_reason text, pro_bono boolean,
    accepted_method text, acceptance_notes text, pa811_required boolean,
    created_at timestamptz, updated_at timestamptz, job_id bigint
  )
  join public.customers c
    on c.business_id = target_business_id and c.legacy_id = r.customer_id
  on conflict (business_id, legacy_id) do update set
    customer_id = excluded.customer_id, quote_number = excluded.quote_number,
    status = excluded.status, quote_date = excluded.quote_date,
    expiration_date = excluded.expiration_date, sent_date = excluded.sent_date,
    response_date = excluded.response_date, contact_method = excluded.contact_method,
    referral_source = excluded.referral_source, service_address = excluded.service_address,
    municipality = excluded.municipality, property_location = excluded.property_location,
    location_description = excluded.location_description, hazard_notes = excluded.hazard_notes,
    customer_scope = excluded.customer_scope, internal_notes = excluded.internal_notes,
    normal_price = excluded.normal_price, quoted_price = excluded.quoted_price,
    discount_reason = excluded.discount_reason, pro_bono = excluded.pro_bono,
    accepted_method = excluded.accepted_method, acceptance_notes = excluded.acceptance_notes,
    pa811_required = excluded.pa811_required, created_at = excluded.created_at,
    updated_at = excluded.updated_at;

  insert into public.jobs (
    business_id, legacy_id, customer_id, quote_id, source_job_number, status,
    job_date, scheduled_date, scheduled_start_time, estimated_duration_minutes,
    completed_date, service_address, municipality, property_location,
    location_description, referral_source, work_description, hazard_notes,
    amount_quoted, amount_paid, payment_method, paid_date, travel_minutes,
    grinding_minutes, cleanup_minutes, machine_hours, pro_bono, pa811_required,
    notes, import_fingerprint, created_at, updated_at
  )
  select target_business_id, r.id, c.id, q.id, r.source_job_number, r.status,
    r.job_date, r.scheduled_date, r.scheduled_start_time, r.estimated_duration_minutes,
    r.completed_date, r.address, r.municipality, r.property_location,
    r.location_description, r.referral_source, r.work_description, r.hazard_notes,
    r.amount_quoted, r.amount_paid, r.payment_method, r.paid_date, r.travel_minutes,
    r.grinding_minutes, r.cleanup_minutes, r.machine_hours, r.pro_bono, r.pa811_required,
    r.notes, r.import_fingerprint, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(import_payload -> 'jobs', '[]'::jsonb)) as r(
    id bigint, customer_id bigint, quote_id bigint, source_job_number text, status text,
    job_date date, scheduled_date date, scheduled_start_time time,
    estimated_duration_minutes integer, completed_date date, address text,
    municipality text, property_location text, location_description text,
    referral_source text, work_description text, hazard_notes text,
    amount_quoted numeric, amount_paid numeric, payment_method text, paid_date date,
    travel_minutes integer, grinding_minutes integer, cleanup_minutes integer,
    machine_hours numeric, pro_bono boolean, pa811_required boolean, notes text,
    import_fingerprint text, created_at timestamptz, updated_at timestamptz
  )
  join public.customers c
    on c.business_id = target_business_id and c.legacy_id = r.customer_id
  left join public.quotes q
    on q.business_id = target_business_id and q.legacy_id = r.quote_id
  on conflict (business_id, legacy_id) do update set
    customer_id = excluded.customer_id, quote_id = excluded.quote_id,
    source_job_number = excluded.source_job_number, status = excluded.status,
    job_date = excluded.job_date, scheduled_date = excluded.scheduled_date,
    scheduled_start_time = excluded.scheduled_start_time,
    estimated_duration_minutes = excluded.estimated_duration_minutes,
    completed_date = excluded.completed_date, service_address = excluded.service_address,
    municipality = excluded.municipality, property_location = excluded.property_location,
    location_description = excluded.location_description, referral_source = excluded.referral_source,
    work_description = excluded.work_description, hazard_notes = excluded.hazard_notes,
    amount_quoted = excluded.amount_quoted, amount_paid = excluded.amount_paid,
    payment_method = excluded.payment_method, paid_date = excluded.paid_date,
    travel_minutes = excluded.travel_minutes, grinding_minutes = excluded.grinding_minutes,
    cleanup_minutes = excluded.cleanup_minutes, machine_hours = excluded.machine_hours,
    pro_bono = excluded.pro_bono, pa811_required = excluded.pa811_required,
    notes = excluded.notes, import_fingerprint = excluded.import_fingerprint,
    created_at = excluded.created_at, updated_at = excluded.updated_at;

  update public.quotes q
  set job_id = (
    select j.id from public.jobs j
    where j.business_id = target_business_id and j.legacy_id = r.job_id
  )
  from jsonb_to_recordset(coalesce(import_payload -> 'quotes', '[]'::jsonb)) as r(id bigint, job_id bigint)
  where q.business_id = target_business_id and q.legacy_id = r.id;

  insert into public.invoices (
    business_id, legacy_id, customer_id, job_id, invoice_number, amount,
    invoice_date, due_date, payment_terms, status, paid_date, notes, created_at, updated_at
  )
  select target_business_id, r.id, c.id, j.id, r.invoice_number, r.amount,
    r.invoice_date, r.due_date, r.payment_terms, r.status, r.paid_date, r.notes,
    r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(import_payload -> 'invoices', '[]'::jsonb)) as r(
    id bigint, customer_id bigint, job_id bigint, invoice_number text, amount numeric,
    invoice_date date, due_date date, payment_terms text, status text, paid_date date,
    notes text, created_at timestamptz, updated_at timestamptz
  )
  join public.customers c
    on c.business_id = target_business_id and c.legacy_id = r.customer_id
  left join public.jobs j
    on j.business_id = target_business_id and j.legacy_id = r.job_id
  on conflict (business_id, legacy_id) do update set
    customer_id = excluded.customer_id, job_id = excluded.job_id,
    invoice_number = excluded.invoice_number, amount = excluded.amount,
    invoice_date = excluded.invoice_date, due_date = excluded.due_date,
    payment_terms = excluded.payment_terms, status = excluded.status,
    paid_date = excluded.paid_date, notes = excluded.notes,
    created_at = excluded.created_at, updated_at = excluded.updated_at;

  insert into public.equipment (
    business_id, legacy_id, name, equipment_type, make_model, serial_number,
    hour_meter, active, notes, created_at, updated_at
  )
  select target_business_id, r.id, r.name, r.equipment_type, r.make_model,
    r.serial_number, r.hour_meter, r.active, r.notes, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(import_payload -> 'equipment', '[]'::jsonb)) as r(
    id bigint, name text, equipment_type text, make_model text, serial_number text,
    hour_meter numeric, active boolean, notes text, created_at timestamptz, updated_at timestamptz
  )
  on conflict (business_id, legacy_id) do update set
    name = excluded.name, equipment_type = excluded.equipment_type,
    make_model = excluded.make_model, serial_number = excluded.serial_number,
    hour_meter = excluded.hour_meter, active = excluded.active, notes = excluded.notes,
    created_at = excluded.created_at, updated_at = excluded.updated_at;

  insert into public.maintenance (
    business_id, legacy_id, equipment_id, service_date, service_type, hour_meter,
    cost, next_due_date, next_due_hours, notes, created_at, updated_at
  )
  select target_business_id, r.id, e.id, r.service_date, r.service_type,
    r.hour_meter, r.cost, r.next_due_date, r.next_due_hours, r.notes,
    r.created_at, coalesce(r.updated_at, r.created_at)
  from jsonb_to_recordset(coalesce(import_payload -> 'maintenance', '[]'::jsonb)) as r(
    id bigint, equipment_id bigint, service_date date, service_type text,
    hour_meter numeric, cost numeric, next_due_date date, next_due_hours numeric,
    notes text, created_at timestamptz, updated_at timestamptz
  )
  join public.equipment e
    on e.business_id = target_business_id and e.legacy_id = r.equipment_id
  on conflict (business_id, legacy_id) do update set
    equipment_id = excluded.equipment_id, service_date = excluded.service_date,
    service_type = excluded.service_type, hour_meter = excluded.hour_meter,
    cost = excluded.cost, next_due_date = excluded.next_due_date,
    next_due_hours = excluded.next_due_hours, notes = excluded.notes,
    created_at = excluded.created_at, updated_at = excluded.updated_at;

  insert into public.expenses (
    business_id, legacy_id, job_id, equipment_id, expense_date, category,
    vendor, description, amount, payment_method, notes, created_at, updated_at
  )
  select target_business_id, r.id, j.id, e.id, r.expense_date, r.category,
    r.vendor, r.description, r.amount, r.payment_method, r.notes, r.created_at, r.updated_at
  from jsonb_to_recordset(coalesce(import_payload -> 'expenses', '[]'::jsonb)) as r(
    id bigint, job_id bigint, equipment_id bigint, expense_date date, category text,
    vendor text, description text, amount numeric, payment_method text, notes text,
    created_at timestamptz, updated_at timestamptz
  )
  left join public.jobs j
    on j.business_id = target_business_id and j.legacy_id = r.job_id
  left join public.equipment e
    on e.business_id = target_business_id and e.legacy_id = r.equipment_id
  on conflict (business_id, legacy_id) do update set
    job_id = excluded.job_id, equipment_id = excluded.equipment_id,
    expense_date = excluded.expense_date, category = excluded.category,
    vendor = excluded.vendor, description = excluded.description,
    amount = excluded.amount, payment_method = excluded.payment_method,
    notes = excluded.notes, created_at = excluded.created_at,
    updated_at = excluded.updated_at;

  counts = jsonb_build_object(
    'customers', jsonb_array_length(coalesce(import_payload -> 'customers', '[]'::jsonb)),
    'jobs', jsonb_array_length(coalesce(import_payload -> 'jobs', '[]'::jsonb)),
    'quotes', jsonb_array_length(coalesce(import_payload -> 'quotes', '[]'::jsonb)),
    'invoices', jsonb_array_length(coalesce(import_payload -> 'invoices', '[]'::jsonb)),
    'equipment', jsonb_array_length(coalesce(import_payload -> 'equipment', '[]'::jsonb)),
    'maintenance', jsonb_array_length(coalesce(import_payload -> 'maintenance', '[]'::jsonb)),
    'expenses', jsonb_array_length(coalesce(import_payload -> 'expenses', '[]'::jsonb))
  );

  insert into public.legacy_imports (business_id, source_name, source_sha256, row_counts)
  values (target_business_id, import_source_name, import_source_sha256, counts);

  return jsonb_build_object('already_imported', false, 'counts', counts);
end;
$$;

revoke all on function public.import_legacy_snapshot(bigint, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.import_legacy_snapshot(bigint, text, text, jsonb)
  to service_role;
