create index bank_classification_rules_created_by_idx
  on public.bank_classification_rules (created_by)
  where created_by is not null;
