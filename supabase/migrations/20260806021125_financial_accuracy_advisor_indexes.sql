create index expenses_voided_by_idx
  on public.expenses (voided_by)
  where voided_by is not null;
