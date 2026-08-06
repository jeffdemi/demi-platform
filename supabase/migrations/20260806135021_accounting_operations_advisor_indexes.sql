create index bank_transactions_import_idx
  on public.bank_transactions (business_id, import_id);

create index journal_entries_created_by_idx
  on public.journal_entries (created_by)
  where created_by is not null;

create index payments_customer_idx
  on public.payments (business_id, customer_id)
  where customer_id is not null;
