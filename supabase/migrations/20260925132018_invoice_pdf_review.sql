-- Editable PDF presentation fields stay on the invoice snapshot. Existing invoice
-- numbers, statuses, payments, and production rows are not backfilled or changed.
alter table public.invoices
  add column pdf_description text,
  add column pdf_service_address text,
  add column pdf_message text,
  add column pdf_notes text;

create function public.save_invoice_pdf_review(
  target_business_id bigint, target_invoice_id bigint,
  expected_invoice_updated_at timestamptz, expected_customer_updated_at timestamptz,
  expected_business_updated_at timestamptz,
  invoice_values jsonb, customer_values jsonb, business_values jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
declare
  i public.invoices%rowtype;
  c public.customers%rowtype;
  b public.businesses%rowtype;
  ni public.invoices%rowtype;
  nc public.customers%rowtype;
  nb public.businesses%rowtype;
begin
  if not coalesce(private.is_business_writer(target_business_id), false) then
    raise exception 'Invoice write access required.' using errcode = '42501';
  end if;
  if invoice_values is null or jsonb_typeof(invoice_values) <> 'object' then raise exception 'Invalid invoice values.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_object_keys(invoice_values) k where k <> all(array['invoice_date','due_date','amount','payment_terms','pdf_description','pdf_service_address','pdf_message','pdf_notes'])) then raise exception 'Unsupported invoice field.' using errcode = '22023'; end if;
  if customer_values is null or jsonb_typeof(customer_values) <> 'object' then raise exception 'Invalid customer values.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_object_keys(customer_values) k where k <> all(array['customer_type','first_name','last_name','company_name','phone','email'])) then raise exception 'Unsupported customer field.' using errcode = '22023'; end if;
  if business_values is null or jsonb_typeof(business_values) <> 'object' then raise exception 'Invalid business values.' using errcode = '22023'; end if;
  if exists (select 1 from jsonb_object_keys(business_values) k where k <> all(array['name','legal_name','phone','email','address_line_1','address_line_2','city','region','postal_code'])) then raise exception 'Unsupported business field.' using errcode = '22023'; end if;

  select * into i from public.invoices where business_id = target_business_id and id = target_invoice_id for update;
  if not found then raise exception 'Invoice not found.' using errcode = 'P0002'; end if;
  if i.archived_at is not null then raise exception 'Archived invoices cannot be edited.' using errcode = '23514'; end if;
  select * into c from public.customers where business_id = target_business_id and id = i.customer_id for update;
  if not found then raise exception 'Customer not found.' using errcode = 'P0002'; end if;
  select * into b from public.businesses where id = target_business_id;
  if not found then raise exception 'Business not found.' using errcode = 'P0002'; end if;
  if i.updated_at is distinct from expected_invoice_updated_at or c.updated_at is distinct from expected_customer_updated_at or b.updated_at is distinct from expected_business_updated_at then
    raise exception 'These records changed. Reload the review page before saving.' using errcode = '40001';
  end if;
  ni := jsonb_populate_record(i, invoice_values);
  nc := jsonb_populate_record(c, customer_values);
  nb := jsonb_populate_record(b, business_values);
  if ni.invoice_date is null or ni.amount is null or ni.amount < 0 or nullif(trim(nb.name), '') is null or nullif(trim(ni.pdf_message), '') is null then
    raise exception 'Complete the required invoice fields.' using errcode = '23514';
  end if;
  if ni.due_date is not null and ni.due_date < ni.invoice_date then raise exception 'Due date cannot be before invoice date.' using errcode = '23514'; end if;
  if ni.amount is distinct from i.amount and exists (select 1 from public.payments where business_id = target_business_id and invoice_id = i.id and voided_at is null) then
    raise exception 'Invoices with recorded payments cannot change amount.' using errcode = '23514';
  end if;
  if to_jsonb(nb) is distinct from to_jsonb(b) then
    if not coalesce(private.is_business_admin(target_business_id), false) then raise exception 'Only owners and administrators can edit business details.' using errcode = '42501'; end if;
    update public.businesses set name = nb.name, legal_name = nb.legal_name, phone = nb.phone, email = nb.email, address_line_1 = nb.address_line_1, address_line_2 = nb.address_line_2, city = nb.city, region = nb.region, postal_code = nb.postal_code where id = target_business_id and updated_at = expected_business_updated_at;
    if not found then raise exception 'Business details changed. Reload before saving.' using errcode = '40001'; end if;
  end if;
  if to_jsonb(nc) is distinct from to_jsonb(c) then
    update public.customers set customer_type = nc.customer_type, first_name = nc.first_name, last_name = nc.last_name, company_name = nc.company_name, phone = nc.phone, email = nc.email where business_id = target_business_id and id = i.customer_id;
    if not found then raise exception 'Customer update denied.' using errcode = '42501'; end if;
  end if;
  update public.invoices set invoice_date = ni.invoice_date, due_date = ni.due_date, amount = ni.amount, payment_terms = ni.payment_terms, pdf_description = ni.pdf_description, pdf_service_address = ni.pdf_service_address, pdf_message = ni.pdf_message, pdf_notes = ni.pdf_notes where business_id = target_business_id and id = target_invoice_id and updated_at = expected_invoice_updated_at;
  if not found then raise exception 'Invoice changed. Reload before saving.' using errcode = '40001'; end if;
end;
$$;

revoke all on function public.save_invoice_pdf_review(bigint,bigint,timestamptz,timestamptz,timestamptz,jsonb,jsonb,jsonb) from public, anon;
grant execute on function public.save_invoice_pdf_review(bigint,bigint,timestamptz,timestamptz,timestamptz,jsonb,jsonb,jsonb) to authenticated;
