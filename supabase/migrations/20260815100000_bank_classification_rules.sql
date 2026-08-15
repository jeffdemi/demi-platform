create table public.bank_classification_rules (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  match_text text not null check (length(trim(match_text)) >= 3),
  ledger_account_id bigint not null,
  tax_category text,
  deductible_percent numeric(5,2) not null default 100 check (deductible_percent between 0 and 100),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, match_text),
  foreign key (business_id, ledger_account_id) references public.ledger_accounts(business_id, id)
);

alter table public.bank_classification_rules enable row level security;
create policy bank_classification_rules_admin_access on public.bank_classification_rules for all to authenticated
  using ((select private.is_business_admin(business_id)))
  with check ((select private.is_business_admin(business_id)));
grant select, insert, update, delete on public.bank_classification_rules to authenticated;
grant usage, select on sequence public.bank_classification_rules_id_seq to authenticated;
create index bank_classification_rules_account_idx on public.bank_classification_rules (business_id, ledger_account_id) where active;

create trigger bank_classification_rules_set_updated_at before update on public.bank_classification_rules
for each row execute function private.set_updated_at();
