-- Audited amount correction for fuzzy (tolerance-based) bank/expense matching.
-- Fuzzy matches are always manual-approve; this migration adds the audit table
-- and the single atomic RPC that performs the correction.

create table public.expense_bank_match_corrections (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  expense_id bigint not null,
  bank_transaction_id bigint not null,
  previous_amount numeric(12, 2) not null check (previous_amount >= 0),
  corrected_amount numeric(12, 2) not null check (corrected_amount >= 0),
  corrected_by uuid not null references auth.users(id) on delete restrict,
  corrected_at timestamptz not null default now(),
  note text,
  foreign key (business_id, expense_id)
    references public.expenses(business_id, id),
  foreign key (business_id, bank_transaction_id)
    references public.bank_transactions(business_id, id)
);

alter table public.expense_bank_match_corrections enable row level security;

create policy expense_bank_match_corrections_admin_access
on public.expense_bank_match_corrections for all to authenticated
using ((select private.is_business_admin(business_id)))
with check ((select private.is_business_admin(business_id)));

grant select, insert on public.expense_bank_match_corrections to authenticated;
grant usage, select on sequence public.expense_bank_match_corrections_id_seq to authenticated;

create index expense_bank_match_corrections_expense_idx
  on public.expense_bank_match_corrections (business_id, expense_id, corrected_at desc);
create index expense_bank_match_corrections_business_date_idx
  on public.expense_bank_match_corrections (business_id, corrected_at desc, id desc);

create or replace function public.approve_fuzzy_expense_match(
  target_business_id bigint,
  target_expense_id bigint,
  target_transaction_id bigint
)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  expense_record record;
  transaction_record record;
  prior_amount numeric;
  corrected_amount numeric;
begin
  if not private.is_business_admin(target_business_id) then raise exception 'Not authorized.'; end if;

  select * into expense_record from public.expenses
  where business_id = target_business_id and id = target_expense_id for update;
  if expense_record.id is null then raise exception 'Expense not found.'; end if;
  if expense_record.voided_at is not null then raise exception 'This expense has been archived.'; end if;
  if expense_record.bank_transaction_id is not null then raise exception 'This expense is already matched to a bank transaction.'; end if;

  select * into transaction_record from public.bank_transactions
  where business_id = target_business_id and id = target_transaction_id for update;
  if transaction_record.id is null then raise exception 'Bank transaction not found.'; end if;
  if transaction_record.status <> 'unreviewed' then raise exception 'This bank transaction is no longer unreviewed.'; end if;

  perform private.assert_accounting_period_open(target_business_id, expense_record.expense_date);

  prior_amount := expense_record.amount;
  corrected_amount := abs(transaction_record.amount);

  update public.expenses
  set amount = corrected_amount, bank_transaction_id = target_transaction_id
  where business_id = target_business_id and id = target_expense_id;

  insert into public.expense_bank_match_corrections
    (business_id, expense_id, bank_transaction_id, previous_amount, corrected_amount, corrected_by)
  values (target_business_id, target_expense_id, target_transaction_id, prior_amount, corrected_amount, auth.uid());

  return target_expense_id;
end;
$$;

revoke all on function public.approve_fuzzy_expense_match(bigint, bigint, bigint) from public, anon;
grant execute on function public.approve_fuzzy_expense_match(bigint, bigint, bigint) to authenticated;
