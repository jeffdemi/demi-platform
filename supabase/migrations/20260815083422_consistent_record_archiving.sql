alter table public.jobs
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add column archive_reason text,
  add constraint jobs_archive_reason_check check (archived_at is null or nullif(trim(archive_reason), '') is not null);

alter table public.quotes
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add column archive_reason text,
  add constraint quotes_archive_reason_check check (archived_at is null or nullif(trim(archive_reason), '') is not null);

alter table public.invoices
  add column archived_at timestamptz,
  add column archived_by uuid references auth.users(id) on delete set null,
  add column archive_reason text,
  add constraint invoices_archive_reason_check check (archived_at is null or nullif(trim(archive_reason), '') is not null);

create index jobs_business_active_idx on public.jobs (business_id, id desc) where archived_at is null;
create index quotes_business_active_idx on public.quotes (business_id, quote_date desc, id desc) where archived_at is null;
create index invoices_business_active_idx on public.invoices (business_id, invoice_date desc, id desc) where archived_at is null;

create index jobs_archived_by_idx on public.jobs (archived_by) where archived_by is not null;
create index quotes_archived_by_idx on public.quotes (archived_by) where archived_by is not null;
create index invoices_archived_by_idx on public.invoices (archived_by) where archived_by is not null;
