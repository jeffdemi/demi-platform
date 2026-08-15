-- Keep the bookkeeping helpers on caller privileges so RLS remains in force,
-- then grant only signed-in users the ability to invoke them through the
-- business-admin-checked bookkeeping RPCs.
alter function private.assert_accounting_period_open(bigint, date)
  security invoker;
alter function private.ensure_default_ledger_accounts(bigint)
  security invoker;

revoke all on function private.assert_accounting_period_open(bigint, date)
  from public, anon;
revoke all on function private.ensure_default_ledger_accounts(bigint)
  from public, anon;
grant execute on function private.assert_accounting_period_open(bigint, date)
  to authenticated;
grant execute on function private.ensure_default_ledger_accounts(bigint)
  to authenticated;
