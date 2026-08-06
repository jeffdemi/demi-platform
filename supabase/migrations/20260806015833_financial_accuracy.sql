alter table public.expenses
  add column transaction_type text not null default 'expense',
  add column refund_of_expense_id bigint,
  add column receipt_path text,
  add column voided_at timestamptz,
  add column voided_by uuid references auth.users(id) on delete set null,
  add column void_reason text;

alter table public.expenses
  add constraint expenses_transaction_type_check
    check (transaction_type in ('expense', 'asset', 'refund')),
  add constraint expenses_refund_source_fkey
    foreign key (business_id, refund_of_expense_id)
    references public.expenses(business_id, id),
  add constraint expenses_refund_source_check
    check (
      (transaction_type = 'refund' and refund_of_expense_id is not null)
      or (transaction_type <> 'refund' and refund_of_expense_id is null)
    ),
  add constraint expenses_void_reason_check
    check (voided_at is null or nullif(trim(void_reason), '') is not null);

update public.expenses
set transaction_type = 'asset'
where notes like 'Imported from Stump Grinding Books.xlsx; source type: asset;%';

update public.expenses refund
set transaction_type = 'refund',
    refund_of_expense_id = source.id
from public.expenses source
where refund.business_id = source.business_id
  and refund.notes like 'Imported from Stump Grinding Books.xlsx; source type: expense; original amount: 79.24.%'
  and source.notes like 'Imported from Stump Grinding Books.xlsx; source type: expense; original amount: -99.41.%'
  and refund.vendor = source.vendor;

create index expenses_business_active_date_idx
  on public.expenses (business_id, expense_date desc, id desc)
  where voided_at is null;

create index expenses_business_active_type_idx
  on public.expenses (business_id, transaction_type, expense_date desc)
  where voided_at is null;

create index expenses_refund_source_idx
  on public.expenses (business_id, refund_of_expense_id)
  where refund_of_expense_id is not null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts',
  'expense-receipts',
  false,
  4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy expense_receipts_select_business_member
on storage.objects for select to authenticated
using (
  bucket_id = 'expense-receipts'
  and private.is_business_member(((storage.foldername(name))[1])::bigint)
);

create policy expense_receipts_insert_business_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and private.is_business_member(((storage.foldername(name))[1])::bigint)
);

create policy expense_receipts_delete_business_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and private.is_business_member(((storage.foldername(name))[1])::bigint)
);
