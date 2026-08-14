-- Preserve actual paid totals recorded directly on jobs by adding only missing
-- payment-ledger rows. Existing jobs, invoices, and payments are not rewritten.
insert into public.payments
  (business_id, customer_id, job_id, payment_date, amount, method, source, notes)
select
  j.business_id,
  j.customer_id,
  j.id,
  coalesce(j.paid_date, j.job_date, j.created_at::date),
  j.amount_paid,
  j.payment_method,
  'legacy',
  'Backfilled from a job paid total recorded after accounting setup'
from public.jobs j
where coalesce(j.amount_paid, 0) > 0
  and not exists (
    select 1
    from public.payments p
    left join public.invoices i
      on i.business_id = p.business_id
     and i.id = p.invoice_id
    where p.business_id = j.business_id
      and coalesce(p.job_id, i.job_id) = j.id
  );
