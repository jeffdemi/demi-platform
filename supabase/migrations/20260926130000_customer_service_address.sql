-- Customers gained no address fields before this — quotes and jobs had to have
-- the service address retyped every time. Nullable, additive; nothing backfilled.
alter table public.customers
  add column street_address text,
  add column city text,
  add column state text,
  add column zip text;
