create or replace function private.sync_expense_journal()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  source_type text;
  source_classification text;
  expense_account text;
  funding_account text;
begin
  if new.voided_at is not null then
    update public.journal_entries set status = 'void'
    where business_id = new.business_id and source_type = 'expense'
      and source_id = new.id and status = 'posted';
    return new;
  end if;

  expense_account := case new.financial_classification
    when 'cogs' then 'cogs'
    when 'labor' then 'labor_expense'
    when 'asset' then 'fixed_assets'
    when 'owner_distribution' then 'owner_equity'
    else 'operating_expense'
  end;

  funding_account := case new.payment_method
    when 'owner_paid_contribution' then 'owner_contributions'
    when 'owner_paid_reimbursable' then 'loans_payable'
    else 'cash'
  end;

  if new.transaction_type = 'asset' then
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Asset purchase'),
      'fixed_assets', funding_account, new.amount, auth.uid());
  elsif new.transaction_type = 'refund' then
    select transaction_type, financial_classification into source_type, source_classification
    from public.expenses
    where business_id = new.business_id and id = new.refund_of_expense_id;
    expense_account := case source_classification
      when 'cogs' then 'cogs'
      when 'labor' then 'labor_expense'
      when 'asset' then 'fixed_assets'
      when 'owner_distribution' then 'owner_equity'
      else case when source_type = 'asset' then 'fixed_assets' else 'operating_expense' end
    end;
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Purchase refund'),
      funding_account, expense_account, new.amount, auth.uid());
  else
    perform private.replace_source_journal(new.business_id, 'expense', new.id,
      new.expense_date, coalesce(new.vendor || ': ', '') || coalesce(new.description, 'Business outflow'),
      expense_account, funding_account, new.amount, auth.uid());
  end if;
  return new;
end;
$$;

revoke all on function private.sync_expense_journal() from public, anon, authenticated;

drop trigger if exists expenses_sync_journal on public.expenses;
create trigger expenses_sync_journal
after insert or update of expense_date, amount, transaction_type, financial_classification,
  refund_of_expense_id, vendor, description, payment_method, voided_at on public.expenses
for each row execute function private.sync_expense_journal();
