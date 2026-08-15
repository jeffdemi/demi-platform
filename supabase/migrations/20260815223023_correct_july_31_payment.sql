-- The original job ledger confirms that Jim Donohue paid $150 by check on
-- July 31 even though the related invoice was issued for $100. Preserve the
-- quoted/invoiced amount and correct the actual cash receipt and revenue.
do $$
declare
  target_payment_id bigint;
begin
  select p.id into strict target_payment_id
  from public.payments p
  join public.jobs j on j.id = p.job_id
  join public.customers c on c.id = j.customer_id
  join public.business_identity_settings i on i.business_id = p.business_id
  where i.legal_name = 'Demi Solutions LLC'
    and c.first_name = 'Jim'
    and c.last_name = 'Donohue'
    and j.job_date = date '2026-07-31'
    and j.amount_paid = 150
    and p.voided_at is null
    and p.amount = 100;

  update public.payments
  set amount = 150,
      payment_date = date '2026-07-31',
      method = 'check',
      notes = 'Corrected from original job ledger: $150 check received for $100 quoted/invoiced job.',
      updated_at = now()
  where id = target_payment_id;
end;
$$;
