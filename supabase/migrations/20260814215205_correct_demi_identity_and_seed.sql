-- Correct the existing Demi tenant identity and seed the finance records that
-- the preceding release intentionally skipped when no legal name matched.
-- Additive and idempotent: existing operational records are preserved.

do $$
declare
  demi_id bigint;
  matching_businesses integer;
begin
  select count(*), min(id)
  into matching_businesses, demi_id
  from public.businesses
  where active
    and lower(trim(name)) = 'demi stump grinding'
    and (legal_name is null or lower(trim(legal_name)) = 'demi solutions llc');

  if matching_businesses <> 1 then
    raise exception 'Expected exactly one active Demi Stump Grinding tenant, found %.', matching_businesses;
  end if;

  update public.businesses
  set legal_name = 'Demi Solutions LLC'
  where id = demi_id
    and legal_name is distinct from 'Demi Solutions LLC';

  insert into public.business_lines (business_id, name, code, description)
  values
    (demi_id, 'Federal IT Contracting', 'federal_it', 'FedUnited hourly IT-contracting activity'),
    (demi_id, 'Demi Stump Grinding', 'stump_grinding', 'Stump-grinding operations')
  on conflict (business_id, code) do update
  set name = excluded.name,
      description = excluded.description,
      active = true;

  insert into public.business_identity_settings (
    business_id,
    legal_name,
    public_brand,
    tax_treatment,
    fictitious_name_status,
    fictitious_name_jurisdiction,
    notes
  )
  values (
    demi_id,
    'Demi Solutions LLC',
    'Demi Stump Grinding',
    'single_member_disregarded',
    'needs_review',
    'Pennsylvania',
    'Confirm whether Demi Stump Grinding requires Pennsylvania fictitious-name registration.'
  )
  on conflict (business_id) do update
  set legal_name = excluded.legal_name,
      public_brand = excluded.public_brand,
      tax_treatment = excluded.tax_treatment,
      fictitious_name_status = excluded.fictitious_name_status,
      fictitious_name_jurisdiction = excluded.fictitious_name_jurisdiction,
      notes = excluded.notes;

  insert into public.bank_accounts (
    business_id,
    name,
    institution,
    account_type,
    purpose,
    minimum_balance_target,
    minimum_balance_days,
    promotion_amount,
    active
  )
  select
    demi_id,
    seed.name,
    seed.institution,
    seed.account_type,
    seed.purpose,
    seed.minimum_balance_target,
    seed.minimum_balance_days,
    seed.promotion_amount,
    true
  from (values
    (
      'Chase Business Complete Checking',
      'Chase',
      'checking',
      'Receives IT and stump-grinding revenue; preserve $2,000 for 60-day promotion',
      2000::numeric,
      60,
      400::numeric
    ),
    (
      'Equipment Credit Card',
      null,
      'credit_card',
      'Original equipment credit-card debt',
      null::numeric,
      null::integer,
      null::numeric
    ),
    (
      'Chase Business Credit Card',
      'Chase',
      'credit_card',
      'New business credit card',
      null::numeric,
      null::integer,
      null::numeric
    )
  ) as seed(
    name,
    institution,
    account_type,
    purpose,
    minimum_balance_target,
    minimum_balance_days,
    promotion_amount
  )
  where not exists (
    select 1
    from public.bank_accounts existing
    where existing.business_id = demi_id
      and lower(trim(existing.name)) = lower(trim(seed.name))
  );

  update public.bank_accounts
  set institution = 'Chase',
      purpose = 'Receives IT and stump-grinding revenue; preserve $2,000 for 60-day promotion',
      minimum_balance_target = 2000,
      minimum_balance_days = 60,
      promotion_amount = 400,
      active = true
  where business_id = demi_id
    and lower(trim(name)) = 'chase business complete checking';

  insert into public.digital_asset_accounts (business_id, name, account_type, active)
  values (demi_id, 'Temporary Crypto Holding', 'exchange', true)
  on conflict (business_id, name) do update
  set account_type = excluded.account_type,
      active = true;
end
$$;
