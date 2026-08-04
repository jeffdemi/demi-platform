create or replace function public.create_invoice_record(
  target_business_id bigint, target_customer_id bigint, target_job_id bigint,
  invoice_amount numeric, invoice_on date, due_on date, terms text,
  invoice_status text, paid_on date, invoice_notes text
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
  if not exists (select 1 from public.customers where business_id = target_business_id and id = target_customer_id) then
    raise exception 'Customer was not found.' using errcode = '23503';
  end if;
  if target_job_id is not null and not exists (
    select 1 from public.jobs where business_id = target_business_id
      and id = target_job_id and customer_id = target_customer_id
  ) then
    raise exception 'Job was not found for this customer.' using errcode = '23503';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(target_business_id::text || ':' || extract(year from invoice_on)::text, 0));
  select coalesce(max(substring(invoice_number from '[0-9]+$')::integer), 0) + 1
  into next_number from public.invoices
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
    where business_id = target_business_id and id = target_job_id and status <> 'cancelled';
  end if;
  return new_invoice_id;
end;
$$;

create or replace function public.set_invoice_status(target_invoice_id bigint, invoice_status text, paid_on date)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invoice_record public.invoices%rowtype;
begin
  if invoice_status not in ('draft', 'unpaid', 'paid', 'void') then
    raise exception 'Unsupported invoice status.' using errcode = '22023';
  end if;
  select * into invoice_record from public.invoices where id = target_invoice_id for update;
  if not found then raise exception 'Invoice was not found.' using errcode = 'P0002'; end if;
  update public.invoices
  set status = invoice_status,
      paid_date = case when invoice_status = 'paid' then coalesce(paid_on, current_date) else null end,
      updated_at = now()
  where id = target_invoice_id;
  if invoice_status = 'paid' and invoice_record.job_id is not null then
    update public.jobs
    set status = 'paid', amount_paid = invoice_record.amount,
        paid_date = coalesce(paid_on, current_date), updated_at = now()
    where business_id = invoice_record.business_id and id = invoice_record.job_id
      and status <> 'cancelled';
  end if;
  return target_invoice_id;
end;
$$;

revoke all on function public.set_invoice_status(bigint, text, date) from public, anon;
grant execute on function public.set_invoice_status(bigint, text, date) to authenticated;
