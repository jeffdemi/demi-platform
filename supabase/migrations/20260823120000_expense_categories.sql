-- Growable, per-business expense category list, so the quick-categorize
-- flow on the Transactions page can offer a combobox that remembers
-- categories as they're typed instead of being limited to the fixed
-- expenseCategories list baked into the app.

create table public.expense_categories (
  id bigint generated always as identity primary key,
  business_id bigint not null references public.businesses(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 100),
  created_at timestamptz not null default now(),
  unique (business_id, name)
);

alter table public.expense_categories enable row level security;
create policy expense_categories_select_business_member on public.expense_categories for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy expense_categories_write_business_member on public.expense_categories for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));
grant select, insert, update, delete on public.expense_categories to authenticated;
grant usage, select on sequence public.expense_categories_id_seq to authenticated;
create index expense_categories_business_idx on public.expense_categories (business_id, name);

insert into public.expense_categories (business_id, name)
select b.id, category
from public.businesses b
cross join unnest(array['Fuel', 'Maintenance', 'Repairs', 'Parts', 'Tools', 'Trailer', 'Insurance', 'Advertising', 'Office', 'Subcontractor', 'General', 'Other']) as category
on conflict (business_id, name) do nothing;
