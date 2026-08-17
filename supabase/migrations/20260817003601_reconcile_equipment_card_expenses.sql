-- Promote unambiguous Bank of America equipment-card allocations into the
-- operational expense register without leaving a second ledger posting.
--
-- Amazon ($38.15) and Home Depot ($14.37) remain allocation-only until the
-- purchased items are identified; their statement descriptions are not enough
-- to choose a defensible expense category.

do $$
declare
  target_business_id bigint;
  equipment_card_id bigint;
  stump_line_id bigint;
  target_transaction_id bigint;
  target_expense_id bigint;
  correction_time timestamptz := now();
  item record;
begin
  select settings.business_id
  into target_business_id
  from public.business_identity_settings settings
  where settings.legal_name = 'Demi Solutions LLC';

  -- Keep this production-specific cleanup harmless in an empty, staging, or
  -- unrelated tenant database.
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

  -- These three insurance expenses already exist in the expense register.
  -- Link each one to its statement row, normalize its tax category, and void
  -- the earlier allocation journal so the premium remains in the books once.
  for item in
    select *
    from (values
      (date '2026-06-04', date '2026-06-04', 'HIS*HISCOX INC', 37.13::numeric),
      (date '2026-07-04', date '2026-07-04', 'HIS*HISCOX INC', 37.13::numeric),
      (date '2026-08-04', date '2026-08-04', 'HIS*HISCOX INC', 37.13::numeric)
    ) as known(expense_date, transaction_date, statement_description, amount)
  loop
    select transaction.id
    into strict target_transaction_id
    from public.bank_transactions transaction
    where transaction.business_id = target_business_id
      and transaction.account_id = equipment_card_id
      and transaction.transaction_date = item.transaction_date
      and transaction.description = item.statement_description
      and transaction.amount = -item.amount;

    select expense.id
    into strict target_expense_id
    from public.expenses expense
    where expense.business_id = target_business_id
      and expense.voided_at is null
      and expense.expense_date = item.expense_date
      and lower(expense.vendor) = 'hiscox'
      and expense.amount = item.amount;

    update public.bank_transaction_allocations allocation
    set voided_at = correction_time,
        void_reason = 'Replaced by the linked Hiscox expense record; prevents duplicate insurance expense.'
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

    update public.expenses
    set bank_transaction_id = target_transaction_id,
        business_line_id = stump_line_id,
        category = 'Insurance',
        tax_category = 'Business insurance',
        payment_method = 'Bank of America equipment credit card',
        notes = concat_ws(' ', notes,
          'Reconciled to the Bank of America equipment-card statement.'),
        updated_at = correction_time
    where business_id = target_business_id and id = target_expense_id;
  end loop;

  -- These statement rows are unambiguous fuel or business-insurance charges.
  -- Create the missing operational expense, then let the normal expense
  -- triggers create the replacement journal and retain the bank match.
  for item in
    select *
    from (values
      (date '2026-04-24', 'LUKOIL 69701', 22.98::numeric,
        'Lukoil', 'Fuel purchase', 'Fuel', 'Fuel'),
      (date '2026-05-18', 'STATE FARM  INSURANCE', 273.32::numeric,
        'State Farm', 'Business insurance', 'Insurance', 'Business insurance'),
      (date '2026-07-31', 'LUKOIL 69701', 29.83::numeric,
        'Lukoil', 'Fuel purchase', 'Fuel', 'Fuel')
    ) as known(transaction_date, statement_description, amount,
      vendor, description, category, tax_category)
  loop
    select transaction.id
    into strict target_transaction_id
    from public.bank_transactions transaction
    where transaction.business_id = target_business_id
      and transaction.account_id = equipment_card_id
      and transaction.transaction_date = item.transaction_date
      and transaction.description = item.statement_description
      and transaction.amount = -item.amount;

    update public.bank_transaction_allocations allocation
    set voided_at = correction_time,
        void_reason = 'Replaced by an operational expense linked to the same statement row.'
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
        item.tax_category,
        100,
        'Bank of America equipment credit card',
        'Created from the verified Bank of America equipment-card statement.'
      );
    end if;
  end loop;
end;
$$;
