create table public.record_deletion_audit (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  record_type text not null check (record_type in ('job', 'quote', 'invoice', 'expense')),
  record_id bigint not null,
  reason text not null check (nullif(trim(reason), '') is not null),
  deleted_by uuid not null references auth.users(id) on delete restrict,
  deleted_at timestamptz not null default now()
);

alter table public.record_deletion_audit enable row level security;

create policy record_deletion_audit_admin_access
on public.record_deletion_audit for all to authenticated
using ((select private.is_business_admin(business_id)))
with check ((select private.is_business_admin(business_id)));

grant select, insert on public.record_deletion_audit to authenticated;
grant usage, select on sequence public.record_deletion_audit_id_seq to authenticated;

create index record_deletion_audit_business_date_idx
  on public.record_deletion_audit (business_id, deleted_at desc, id desc);

create or replace function public.force_delete_business_record(
  target_business_id bigint,
  target_record_type text,
  target_record_id bigint,
  deletion_reason text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  record_exists boolean;
  direct_expense_ids bigint[] := array[]::bigint[];
  expense_ids bigint[] := array[]::bigint[];
  invoice_ids bigint[] := array[]::bigint[];
  payment_ids bigint[] := array[]::bigint[];
  bank_transaction_ids bigint[] := array[]::bigint[];
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;
  if target_record_type not in ('job', 'quote', 'invoice', 'expense') then raise exception 'Unsupported record type.'; end if;
  if nullif(trim(deletion_reason), '') is null then raise exception 'A deletion reason is required.'; end if;

  case target_record_type
    when 'quote' then select exists(select 1 from public.quotes where business_id = target_business_id and id = target_record_id) into record_exists;
    when 'job' then select exists(select 1 from public.jobs where business_id = target_business_id and id = target_record_id) into record_exists;
    when 'invoice' then select exists(select 1 from public.invoices where business_id = target_business_id and id = target_record_id) into record_exists;
    when 'expense' then select exists(select 1 from public.expenses where business_id = target_business_id and id = target_record_id) into record_exists;
  end case;
  if not record_exists then raise exception 'That record no longer exists.'; end if;

  insert into public.record_deletion_audit (business_id, record_type, record_id, reason, deleted_by)
  values (target_business_id, target_record_type, target_record_id, trim(deletion_reason), auth.uid());

  if target_record_type = 'quote' then
    update public.jobs set quote_id = null where business_id = target_business_id and quote_id = target_record_id;
    update public.quotes set job_id = null where business_id = target_business_id and id = target_record_id;
    delete from public.quotes where business_id = target_business_id and id = target_record_id;

  elsif target_record_type = 'expense' then
    select coalesce(array_agg(id), array[]::bigint[]) into expense_ids
    from public.expenses
    where business_id = target_business_id and (id = target_record_id or refund_of_expense_id = target_record_id);
    select coalesce(array_agg(distinct bank_transaction_id), array[]::bigint[]) into bank_transaction_ids
    from public.expenses where business_id = target_business_id and id = any(expense_ids) and bank_transaction_id is not null;
    delete from public.journal_entries
    where business_id = target_business_id and source_type = 'expense' and source_id = any(expense_ids);
    delete from public.expenses where business_id = target_business_id and id = any(expense_ids);

  elsif target_record_type = 'invoice' then
    invoice_ids := array[target_record_id];
    select coalesce(array_agg(id), array[]::bigint[]) into payment_ids
    from public.payments where business_id = target_business_id and invoice_id = target_record_id;
    select coalesce(array_agg(distinct bank_transaction_id), array[]::bigint[]) into bank_transaction_ids
    from public.payments where business_id = target_business_id and id = any(payment_ids) and bank_transaction_id is not null;
    delete from public.journal_entries
    where business_id = target_business_id and source_type = 'payment' and source_id = any(payment_ids);
    delete from public.payments where business_id = target_business_id and id = any(payment_ids);
    delete from public.invoices where business_id = target_business_id and id = target_record_id;

  else
    select coalesce(array_agg(id), array[]::bigint[]) into invoice_ids
    from public.invoices where business_id = target_business_id and job_id = target_record_id;
    select coalesce(array_agg(id), array[]::bigint[]) into direct_expense_ids
    from public.expenses where business_id = target_business_id and job_id = target_record_id;
    select coalesce(array_agg(id), array[]::bigint[]) into expense_ids
    from public.expenses
    where business_id = target_business_id
      and (id = any(direct_expense_ids) or refund_of_expense_id = any(direct_expense_ids));
    select coalesce(array_agg(id), array[]::bigint[]) into payment_ids
    from public.payments
    where business_id = target_business_id
      and (job_id = target_record_id or invoice_id = any(invoice_ids));
    select coalesce(array_agg(distinct bank_transaction_id), array[]::bigint[]) into bank_transaction_ids
    from (
      select bank_transaction_id from public.expenses
      where business_id = target_business_id and id = any(expense_ids) and bank_transaction_id is not null
      union
      select bank_transaction_id from public.payments
      where business_id = target_business_id and id = any(payment_ids) and bank_transaction_id is not null
    ) affected_banks;
    delete from public.journal_entries
    where business_id = target_business_id
      and ((source_type = 'expense' and source_id = any(expense_ids))
        or (source_type = 'payment' and source_id = any(payment_ids)));
    delete from public.payments where business_id = target_business_id and id = any(payment_ids);
    delete from public.invoices where business_id = target_business_id and id = any(invoice_ids);
    delete from public.expenses where business_id = target_business_id and id = any(expense_ids);
    delete from public.labor_entries where business_id = target_business_id and job_id = target_record_id;
    update public.quotes set job_id = null where business_id = target_business_id and job_id = target_record_id;
    delete from public.jobs where business_id = target_business_id and id = target_record_id;
  end if;

  if cardinality(bank_transaction_ids) > 0 then
    update public.bank_transactions
    set status = 'unreviewed', reviewed_at = null, reviewed_by = null, excluded_reason = null
    where business_id = target_business_id and id = any(bank_transaction_ids);
  end if;
end;
$$;

revoke all on function public.force_delete_business_record(bigint, text, bigint, text) from public, anon;
grant execute on function public.force_delete_business_record(bigint, text, bigint, text) to authenticated;
