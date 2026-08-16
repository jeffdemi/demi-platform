-- Populate only equipment facts already supported by the reconciled asset
-- records, and initialize the existing Greg Crabtree management-reporting
-- defaults. In-service dates and financing terms still require owner evidence.

insert into public.financial_settings (business_id)
select identity.business_id
from public.business_identity_settings identity
where identity.legal_name = 'Demi Solutions LLC'
on conflict (business_id) do nothing;

update public.equipment equipment
set purchase_date = asset.expense_date,
    purchase_cost = asset.amount,
    updated_at = now()
from public.expenses asset
join public.business_identity_settings identity
  on identity.business_id = asset.business_id
where identity.legal_name = 'Demi Solutions LLC'
  and asset.business_id = equipment.business_id
  and asset.equipment_id = equipment.id
  and asset.voided_at is null
  and asset.transaction_type = 'asset'
  and equipment.purchase_date is null
  and equipment.purchase_cost is null;
