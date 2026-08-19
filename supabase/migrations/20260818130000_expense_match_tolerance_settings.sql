-- Configurable tolerance for fuzzy bank-transaction/expense matching.
-- Additive columns on financial_settings, already RLS-restricted to owner/admin
-- and already granted select/insert/update to authenticated.

alter table public.financial_settings
  add column expense_match_tolerance_percent numeric(5, 2) not null default 2.00
    check (expense_match_tolerance_percent between 0 and 20),
  add column expense_match_day_window integer not null default 10
    check (expense_match_day_window between 0 and 60);
