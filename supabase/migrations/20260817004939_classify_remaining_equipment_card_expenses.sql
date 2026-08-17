-- Convert the final two equipment-card allocations after the owner identified
-- the purchased items: trailer hardware and a grease gun.

do $$
declare
  target_business_id bigint;
  equipment_card_id bigint;
  stump_line_id bigint;
  trailer_id bigint;
  target_transaction_id bigint;
  correction_time timestamptz := now();
  item record;
begin
  select settings.business_id
  into target_business_id
  from public.business_identity_settings settings
  where settings.legal_name = 'Demi Solutions LLC';

  if target_business_id is null then
    return;
  end if;

  select account.id
  into strict equipment_card_id
  from public.bank_accounts account
  where account.business_id = target_business_id
    and account.name = 'Equipment Credit Card';

  select line.id
  into strict stump_line_id
  from public.business_lines line
  where line.business_id = target_business_id
    and line.code = 'stump_grinding';

  select equipment.id
  into strict trailer_id
  from public.equipment equipment
  where equipment.business_id = target_business_id
    and equipment.name = '4x8 Trailer';

  for item in
    select *
    from (values
      (date '2026-04-11', 'THE HOME DEPOT #4180', 14.37::numeric,
        'Home Depot', 'Trailer hardware', 'Trailer',
        'Repairs and maintenance', true),
      (date '2026-04-15', 'AMAZON MKTPL*BS7B35OI2', 38.15::numeric,
        'Amazon', 'Grease gun', 'Tools', 'Tools', false)
    ) as known(transaction_date, statement_description, amount,
      vendor, description, category, tax_category, link_to_trailer)
  loop
    select transaction.id
    into strict target_transaction_id
    from public.bank_transactions transaction
    where transaction.business_id = target_business_id
      and transaction.account_id = equipment_card_id
      and transaction.transaction_date = item.transaction_date
      and transaction.description = item.statement_description
      and transaction.amount = -item.amount;

    if not exists (
      select 1
      from public.bank_transaction_allocations allocation
      where allocation.business_id = target_business_id
        and allocation.bank_transaction_id = target_transaction_id
        and allocation.voided_at is null
    ) and not exists (
      select 1
      from public.expenses expense
      where expense.business_id = target_business_id
        and expense.bank_transaction_id = target_transaction_id
        and expense.voided_at is null
    ) then
      raise exception 'Expected an active allocation or linked expense for bank transaction %.',
        target_transaction_id;
    end if;

    update public.bank_transaction_allocations allocation
    set voided_at = correction_time,
        void_reason = 'Replaced by the owner-confirmed operational expense linked to this statement row.'
    where allocation.business_id = target_business_id
      and allocation.bank_transaction_id = target_transaction_id
      and allocation.voided_at is null;

    update public.journal_entries entry
    set status = 'void'
    where entry.business_id = target_business_id
      and entry.source_type = 'allocation'
      and entry.status = 'posted'
      and exists (
        select 1
        from public.bank_transaction_allocations allocation
        where allocation.business_id = entry.business_id
          and allocation.id = entry.source_id
          and allocation.bank_transaction_id = target_transaction_id
          and allocation.voided_at = correction_time
      );

    if not exists (
      select 1
      from public.expenses expense
      where expense.business_id = target_business_id
        and expense.bank_transaction_id = target_transaction_id
        and expense.voided_at is null
    ) then
      insert into public.expenses (
        business_id,
        business_line_id,
        expense_date,
        vendor,
        description,
        category,
        amount,
        transaction_type,
        financial_classification,
        financial_classification_reviewed,
        bank_transaction_id,
        equipment_id,
        tax_category,
        deductible_percent,
        payment_method,
        notes
      ) values (
        target_business_id,
        stump_line_id,
        item.transaction_date,
        item.vendor,
        item.description,
        item.category,
        item.amount,
        'expense',
        'operating',
        true,
        target_transaction_id,
        case when item.link_to_trailer then trailer_id else null end,
        item.tax_category,
        100,
        'Bank of America equipment credit card',
        'Created from the verified Bank of America equipment-card statement after owner item confirmation.'
      );
    end if;
  end loop;
end;
$$;
