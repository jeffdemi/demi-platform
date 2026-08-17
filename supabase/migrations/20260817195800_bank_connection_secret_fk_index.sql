-- Cover the composite foreign key used when deleting or validating a bank
-- connection. The narrower business_id index is retained for tenant lookups.

create index if not exists bank_connection_secrets_business_connection_idx
  on public.bank_connection_secrets (business_id, connection_id);
