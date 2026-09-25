-- Review edits are committed together; no existing transaction or quote data is backfilled.
alter table public.quotes add column pdf_terms text, add column pdf_notes text;

create function public.save_quote_pdf_review(
  target_business_id bigint, target_quote_id bigint,
  expected_quote_updated_at timestamptz, expected_customer_updated_at timestamptz,
  expected_business_updated_at timestamptz,
  quote_values jsonb, customer_values jsonb, business_values jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  q public.quotes%rowtype;
  c public.customers%rowtype;
  b public.businesses%rowtype;
  nq public.quotes%rowtype;
  nc public.customers%rowtype;
  nb public.businesses%rowtype;
begin
  if not coalesce(private.is_business_writer(target_business_id), false) then
    raise exception 'Quote write access required.' using errcode = '42501';
  end if;
  if quote_values is null or jsonb_typeof(quote_values) <> 'object' then
    raise exception 'Invalid quote values.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(quote_values) k where k <> all(array['quote_number', 'quote_date', 'expiration_date', 'service_address', 'property_location', 'location_description', 'customer_scope', 'quoted_price', 'pro_bono', 'pdf_terms', 'pdf_notes'])) then
    raise exception 'Unsupported quote field.' using errcode = '22023';
  end if;
  if customer_values is null or jsonb_typeof(customer_values) <> 'object' then
    raise exception 'Invalid customer values.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(customer_values) k where k <> all(array['customer_type', 'first_name', 'last_name', 'company_name', 'phone', 'email'])) then
    raise exception 'Unsupported customer field.' using errcode = '22023';
  end if;
  if business_values is null or jsonb_typeof(business_values) <> 'object' then
    raise exception 'Invalid business values.' using errcode = '22023';
  end if;
  if exists (select 1 from jsonb_object_keys(business_values) k where k <> all(array['name', 'legal_name', 'phone', 'email', 'address_line_1', 'address_line_2', 'city', 'region', 'postal_code'])) then
    raise exception 'Unsupported business field.' using errcode = '22023';
  end if;
  select * into q from public.quotes where business_id = target_business_id and id = target_quote_id for update;
  if not found then raise exception 'Quote not found.' using errcode = 'P0002'; end if;
  if q.archived_at is not null or q.job_id is not null or q.status = 'converted' then
    raise exception 'Archived or converted quotes cannot be edited.' using errcode = '23514';
  end if;
  select * into c from public.customers where business_id = target_business_id and id = q.customer_id for update;
  if not found then raise exception 'Customer not found.' using errcode = 'P0002'; end if;
  select * into b from public.businesses where id = target_business_id;
  if not found then raise exception 'Business not found.' using errcode = 'P0002'; end if;
  if q.updated_at is distinct from expected_quote_updated_at
    or c.updated_at is distinct from expected_customer_updated_at
    or b.updated_at is distinct from expected_business_updated_at then
    raise exception 'These records changed. Reload the review page before saving.' using errcode = '40001';
  end if;
  nq := jsonb_populate_record(q, quote_values);
  nc := jsonb_populate_record(c, customer_values);
  nb := jsonb_populate_record(b, business_values);
  if nullif(trim(nq.quote_number), '') is null or nq.quote_date is null
    or nullif(trim(nq.customer_scope), '') is null or nq.pro_bono is null
    or nq.quoted_price is null or nq.quoted_price::text in ('NaN', 'Infinity', '-Infinity')
    or nq.quoted_price < 0 or (not nq.pro_bono and nq.quoted_price <= 0)
    or (nq.expiration_date is not null and nq.expiration_date < nq.quote_date)
    or nullif(trim(nb.name), '') is null then
    raise exception 'Complete the required quote fields and final price.' using errcode = '23514';
  end if;
  if nq.pro_bono then nq.quoted_price := 0; end if;
  if to_jsonb(nb) is distinct from to_jsonb(b) then
    if not coalesce(private.is_business_admin(target_business_id), false) then
      raise exception 'Only owners and administrators can edit business details.' using errcode = '42501';
    end if;
    update public.businesses set name = nb.name, legal_name = nb.legal_name, phone = nb.phone, email = nb.email, address_line_1 = nb.address_line_1, address_line_2 = nb.address_line_2, city = nb.city, region = nb.region, postal_code = nb.postal_code where id = target_business_id and updated_at = expected_business_updated_at;
    if not found then raise exception 'Business details changed. Reload before saving.' using errcode = '40001'; end if;
  end if;
  if to_jsonb(nc) is distinct from to_jsonb(c) then
    update public.customers set customer_type = nc.customer_type, first_name = nc.first_name, last_name = nc.last_name, company_name = nc.company_name, phone = nc.phone, email = nc.email where business_id = target_business_id and id = q.customer_id;
    if not found then raise exception 'Customer update denied.' using errcode = '42501'; end if;
  end if;
  update public.quotes set quote_number = nq.quote_number, quote_date = nq.quote_date, expiration_date = nq.expiration_date, service_address = nq.service_address, property_location = nq.property_location, location_description = nq.location_description, customer_scope = nq.customer_scope, quoted_price = nq.quoted_price, pro_bono = nq.pro_bono, pdf_terms = nq.pdf_terms, pdf_notes = nq.pdf_notes where business_id = target_business_id and id = target_quote_id;
  if not found then raise exception 'Quote update denied.' using errcode = '42501'; end if;
end;
$$;
revoke all on function public.save_quote_pdf_review(bigint,bigint,timestamptz,timestamptz,timestamptz,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_quote_pdf_review(bigint,bigint,timestamptz,timestamptz,timestamptz,jsonb,jsonb,jsonb) to authenticated;
