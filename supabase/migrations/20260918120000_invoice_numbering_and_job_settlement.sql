-- Invoice numbers carry a two-digit job suffix: INV-2026-0004-37 is the fourth
-- invoice of 2026, raised against the thirty-seventh job this business ever
-- created. The suffix is meaningless without a job, so a job is now required.

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
  job_ordinal integer;
  generated_number text;
  new_invoice_id bigint;
begin
  if invoice_status not in ('draft', 'unpaid', 'paid', 'void') then
    raise exception 'Unsupported invoice status.' using errcode = '22023';
  end if;
  if invoice_amount < 0 then
    raise exception 'Invoice amount cannot be negative.' using errcode = '22023';
  end if;
  if target_job_id is null then
    raise exception 'An invoice must be linked to a job.' using errcode = '23502';
  end if;
  if not exists (select 1 from public.customers where business_id = target_business_id and id = target_customer_id) then
    raise exception 'Customer was not found.' using errcode = '23503';
  end if;
  if not exists (
    select 1 from public.jobs where business_id = target_business_id
      and id = target_job_id and customer_id = target_customer_id
  ) then
    raise exception 'Job was not found for this customer.' using errcode = '23503';
  end if;

  -- The job's place in this business's own creation order, which is what the
  -- owner means by "my thirty-seventh job". jobs.id is a platform-wide identity
  -- shared with every other business, so it cannot stand in for that count.
  select count(*) into job_ordinal from public.jobs
  where business_id = target_business_id and id <= target_job_id;

  perform pg_advisory_xact_lock(hashtextextended(target_business_id::text || ':' || extract(year from invoice_on)::text, 0));
  -- Match the four-digit sequence group by position. Numbers issued before this
  -- migration have no suffix, so both shapes read correctly here, while the old
  -- trailing-digit match would now pick up the job suffix instead.
  select coalesce(max(substring(invoice_number from 'INV-[0-9]{4}-([0-9]{4})')::integer), 0) + 1
  into next_number from public.invoices
  where business_id = target_business_id
    and invoice_number like 'INV-' || extract(year from invoice_on)::integer || '-%';
  generated_number := 'INV-' || extract(year from invoice_on)::integer || '-'
    || lpad(next_number::text, 4, '0') || '-' || lpad((job_ordinal % 100)::text, 2, '0');

  insert into public.invoices (
    business_id, customer_id, job_id, invoice_number, amount, invoice_date,
    due_date, payment_terms, status, paid_date, notes
  ) values (
    target_business_id, target_customer_id, target_job_id, generated_number,
    invoice_amount, invoice_on, due_on, nullif(trim(terms), ''), invoice_status,
    paid_on, nullif(trim(invoice_notes), '')
  ) returning id into new_invoice_id;

  if invoice_status <> 'void' then
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

revoke all on function public.create_invoice_record(bigint, bigint, bigint, numeric, date, date, text, text, date, text) from public, anon;
grant execute on function public.create_invoice_record(bigint, bigint, bigint, numeric, date, date, text, text, date, text) to authenticated;

-- A job paid without an invoice only ever had amount_paid and paid_date written, so its
-- status stayed 'completed' and it sat in the "Ready for invoicing" queue forever. That
-- is the normal path for work settled by text. Settle the job the way the invoice path
-- already does, once payments cover what the work was worth.
create or replace function public.record_payment(
  target_business_id bigint,
  target_invoice_id bigint,
  target_job_id bigint,
  payment_on date,
  payment_amount numeric,
  payment_method text,
  payment_reference text,
  target_bank_transaction_id bigint,
  payment_notes text
)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  payment_id bigint;
  target_customer_id bigint;
  invoice_amount numeric;
  bank_amount numeric;
  paid_total numeric;
begin
  if not private.is_business_member(target_business_id) then
    raise exception 'Business access is required.' using errcode = '42501';
  end if;
  if payment_amount <= 0 then raise exception 'Payment amount must be greater than zero.'; end if;
  if target_invoice_id is not null then
    select customer_id, amount, coalesce(target_job_id, job_id)
    into target_customer_id, invoice_amount, target_job_id
    from public.invoices where business_id = target_business_id and id = target_invoice_id for update;
    if target_customer_id is null then raise exception 'Invoice not found.'; end if;
  elsif target_job_id is not null then
    select customer_id into target_customer_id from public.jobs
    where business_id = target_business_id and id = target_job_id;
    if target_customer_id is null then raise exception 'Job not found.'; end if;
  else
    raise exception 'Select an invoice or job.';
  end if;
  if target_bank_transaction_id is not null then
    select amount into bank_amount from public.bank_transactions
    where business_id = target_business_id and id = target_bank_transaction_id for update;
    if bank_amount is null or bank_amount <= 0 or bank_amount <> payment_amount then
      raise exception 'The bank deposit must equal the payment amount.';
    end if;
  end if;
  insert into public.payments
    (business_id, customer_id, invoice_id, job_id, bank_transaction_id, payment_date,
     amount, method, reference, source, notes)
  values
    (target_business_id, target_customer_id, target_invoice_id, target_job_id,
     target_bank_transaction_id, payment_on, payment_amount, nullif(trim(payment_method), ''),
     nullif(trim(payment_reference), ''), case when target_bank_transaction_id is null then 'manual' else 'bank_import' end,
     nullif(trim(payment_notes), ''))
  returning id into payment_id;
  if target_bank_transaction_id is not null then
    update public.bank_transactions set status = 'matched', reviewed_at = now(), reviewed_by = auth.uid()
    where business_id = target_business_id and id = target_bank_transaction_id;
  end if;
  if target_invoice_id is not null then
    select coalesce(sum(amount), 0) into paid_total from public.payments
    where business_id = target_business_id and invoice_id = target_invoice_id and voided_at is null;
    update public.invoices set status = case when paid_total >= invoice_amount then 'paid' else 'unpaid' end,
      paid_date = case when paid_total >= invoice_amount then payment_on else null end
    where business_id = target_business_id and id = target_invoice_id;
  end if;
  if target_job_id is not null then
    select coalesce(sum(amount), 0) into paid_total from public.payments
    where business_id = target_business_id and job_id = target_job_id and voided_at is null;
    -- Yardstick: the invoice when one drove this payment, else what the job was quoted.
    -- With neither, any payment settles it, since nothing says the work is worth more.
    update public.jobs set amount_paid = paid_total,
      paid_date = case when paid_total > 0 then payment_on else paid_date end,
      status = case
        when status <> 'cancelled' and paid_total > 0
          and paid_total >= coalesce(invoice_amount, amount_quoted, paid_total) then 'paid'
        else status end
    where business_id = target_business_id and id = target_job_id;
  end if;
  return payment_id;
end;
$$;

revoke all on function public.record_payment(bigint, bigint, bigint, date, numeric, text, text, bigint, text) from public, anon;
grant execute on function public.record_payment(bigint, bigint, bigint, date, numeric, text, text, bigint, text) to authenticated;

-- Marking an invoice paid captures a payment, which posts a revenue journal entry. Moving
-- the invoice back off 'paid' cleared only the invoice's own paid_date: the captured
-- payment stayed live, its journal entry stayed posted, and the job stayed settled, so a
-- voided invoice kept contributing revenue forever. Reverse the capture with the status.
create or replace function public.set_invoice_status(target_invoice_id bigint, invoice_status text, paid_on date)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  invoice_record public.invoices%rowtype;
  remaining_paid numeric;
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

  if invoice_status = 'paid' then
    if invoice_record.job_id is not null then
      update public.jobs
      set status = 'paid', amount_paid = invoice_record.amount,
          paid_date = coalesce(paid_on, current_date), updated_at = now()
      where business_id = invoice_record.business_id and id = invoice_record.job_id
        and status <> 'cancelled';
    end if;
    return target_invoice_id;
  end if;

  -- Only the capture is undone. A payment entered in its own right — typed in by hand or
  -- matched from a bank import — records money that actually arrived, and voiding the
  -- invoice is not a statement that it did not. Those stay, and keep their revenue.
  update public.payments
  set voided_at = now(),
      void_reason = 'Invoice ' || invoice_record.invoice_number || ' was set to ' || invoice_status || '.'
  where business_id = invoice_record.business_id and invoice_id = target_invoice_id
    and source = 'legacy' and voided_at is null;

  if invoice_record.job_id is not null then
    select coalesce(sum(amount), 0) into remaining_paid from public.payments
    where business_id = invoice_record.business_id and job_id = invoice_record.job_id
      and voided_at is null;
    update public.jobs
    set amount_paid = remaining_paid,
        paid_date = case when remaining_paid > 0 then paid_date else null end,
        status = case
          when status = 'cancelled' then status
          when remaining_paid > 0 and remaining_paid >= coalesce(amount_quoted, remaining_paid) then 'paid'
          when invoice_status = 'void' then 'completed'
          else 'invoiced' end,
        updated_at = now()
    where business_id = invoice_record.business_id and id = invoice_record.job_id;
  end if;
  return target_invoice_id;
end;
$$;

revoke all on function public.set_invoice_status(bigint, text, date) from public, anon;
grant execute on function public.set_invoice_status(bigint, text, date) to authenticated;
