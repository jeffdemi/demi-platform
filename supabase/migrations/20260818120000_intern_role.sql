-- Adds a strictly read-only "intern" team role.
--
-- Every table below previously granted any active business member (owner,
-- admin, or employee) full read/write access through a single policy keyed
-- on private.is_business_member(). Making "intern" a fourth member role
-- without further changes would have handed interns the same write access
-- as an employee, so each of those policies is split into a select policy
-- (still open to every active member, interns included) and a write policy
-- gated by the new private.is_business_writer(), which excludes interns.
--
-- Tables that were already admin-only (financial_settings, labor_entries,
-- digital_asset_*, bank_connections, etc.) are untouched: they already
-- exclude anyone who isn't an owner/admin, so they exclude interns too.
-- Every public RPC that writes business data runs security invoker (see
-- 20260815104000_harden_bookkeeping_helper_permissions.sql), so it inherits
-- these table policies automatically without needing its own changes.

alter table public.business_members
  drop constraint business_members_role_check,
  add constraint business_members_role_check
    check (role in ('owner', 'admin', 'employee', 'intern'));

alter table public.business_invitations
  drop constraint business_invitations_role_check,
  add constraint business_invitations_role_check
    check (role in ('admin', 'employee', 'intern'));

create or replace function private.is_business_writer(requested_business_id bigint)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.business_members
    where business_id = requested_business_id
      and user_id = (select auth.uid())
      and role in ('owner', 'admin', 'employee')
      and active
  );
$$;

revoke all on function private.is_business_writer(bigint) from public, anon;
grant execute on function private.is_business_writer(bigint) to authenticated;

-- Core operational records (initial_platform.sql)

drop policy customers_business_access on public.customers;
create policy customers_select_business_member on public.customers for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy customers_write_business_member on public.customers for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy quotes_business_access on public.quotes;
create policy quotes_select_business_member on public.quotes for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy quotes_write_business_member on public.quotes for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy jobs_business_access on public.jobs;
create policy jobs_select_business_member on public.jobs for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy jobs_write_business_member on public.jobs for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy invoices_business_access on public.invoices;
create policy invoices_select_business_member on public.invoices for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy invoices_write_business_member on public.invoices for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy equipment_business_access on public.equipment;
create policy equipment_select_business_member on public.equipment for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy equipment_write_business_member on public.equipment for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy maintenance_business_access on public.maintenance;
create policy maintenance_select_business_member on public.maintenance for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy maintenance_write_business_member on public.maintenance for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy expenses_business_access on public.expenses;
create policy expenses_select_business_member on public.expenses for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy expenses_write_business_member on public.expenses for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

-- Job spreadsheet imports (full_feature_parity.sql)

drop policy job_imports_business_access on public.job_imports;
create policy job_imports_select_business_member on public.job_imports for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy job_imports_write_business_member on public.job_imports for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)) and created_by = (select auth.uid()));

-- Banking and payments (accounting_operations.sql)

drop policy bank_accounts_business_access on public.bank_accounts;
create policy bank_accounts_select_business_member on public.bank_accounts for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy bank_accounts_write_business_member on public.bank_accounts for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy bank_imports_business_access on public.bank_imports;
create policy bank_imports_select_business_member on public.bank_imports for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy bank_imports_write_business_member on public.bank_imports for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy bank_transactions_business_access on public.bank_transactions;
create policy bank_transactions_select_business_member on public.bank_transactions for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy bank_transactions_write_business_member on public.bank_transactions for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

drop policy payments_business_access on public.payments;
create policy payments_select_business_member on public.payments for select to authenticated
  using ((select private.is_business_member(business_id)));
create policy payments_write_business_member on public.payments for all to authenticated
  using ((select private.is_business_writer(business_id)))
  with check ((select private.is_business_writer(business_id)));

-- Expense receipts (financial_accuracy.sql) — select policy is unchanged.

drop policy expense_receipts_insert_business_member on storage.objects;
create policy expense_receipts_insert_business_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'expense-receipts'
  and private.is_business_writer(((storage.foldername(name))[1])::bigint)
);

drop policy expense_receipts_delete_business_member on storage.objects;
create policy expense_receipts_delete_business_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'expense-receipts'
  and private.is_business_writer(((storage.foldername(name))[1])::bigint)
);

-- Quote AI workbench (quote_ai_workbench.sql) — select policies are unchanged.

drop policy quote_photos_insert_business_member on public.quote_photos;
create policy quote_photos_insert_business_member
on public.quote_photos for insert to authenticated
with check (
  (select private.is_business_writer(business_id))
  and uploaded_by = (select auth.uid())
);

drop policy quote_photos_delete_business_member on public.quote_photos;
create policy quote_photos_delete_business_member
on public.quote_photos for delete to authenticated
using ((select private.is_business_writer(business_id)));

drop policy quote_ai_threads_insert_business_member on public.quote_ai_threads;
create policy quote_ai_threads_insert_business_member
on public.quote_ai_threads for insert to authenticated
with check ((select private.is_business_writer(business_id)) and created_by = (select auth.uid()));

drop policy quote_ai_threads_update_business_member on public.quote_ai_threads;
create policy quote_ai_threads_update_business_member
on public.quote_ai_threads for update to authenticated
using ((select private.is_business_writer(business_id)))
with check ((select private.is_business_writer(business_id)));

drop policy quote_ai_recommendations_insert_business_member on public.quote_ai_recommendations;
create policy quote_ai_recommendations_insert_business_member
on public.quote_ai_recommendations for insert to authenticated
with check ((select private.is_business_writer(business_id)) and created_by = (select auth.uid()));

drop policy quote_ai_recommendations_update_business_member on public.quote_ai_recommendations;
create policy quote_ai_recommendations_update_business_member
on public.quote_ai_recommendations for update to authenticated
using ((select private.is_business_writer(business_id)) and applied_at is null)
with check (
  (select private.is_business_writer(business_id))
  and applied_at is not null
  and applied_by = (select auth.uid())
);

drop policy quote_ai_messages_insert_business_member on public.quote_ai_messages;
create policy quote_ai_messages_insert_business_member
on public.quote_ai_messages for insert to authenticated
with check ((select private.is_business_writer(business_id)) and created_by = (select auth.uid()));

drop policy quote_photos_storage_insert_business_member on storage.objects;
create policy quote_photos_storage_insert_business_member
on storage.objects for insert to authenticated
with check (
  bucket_id = 'quote-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9]+$'
      and (storage.foldername(name))[2] ~ '^[0-9]+$'
      then exists (
        select 1
        from public.quotes quote_record
        where quote_record.business_id = ((storage.foldername(name))[1])::bigint
          and quote_record.id = ((storage.foldername(name))[2])::bigint
          and quote_record.status = 'draft'
          and private.is_business_writer(quote_record.business_id)
      )
    else false
  end
);

drop policy quote_photos_storage_delete_business_member on storage.objects;
create policy quote_photos_storage_delete_business_member
on storage.objects for delete to authenticated
using (
  bucket_id = 'quote-photos'
  and case
    when (storage.foldername(name))[1] ~ '^[0-9]+$'
      then private.is_business_writer(((storage.foldername(name))[1])::bigint)
    else false
  end
);
