-- Public bookkeeping RPCs run as the signed-in user and call this private
-- closed-period guard. Restore the narrow helper permission without exposing
-- the private schema or bypassing RLS.
revoke all on function private.assert_accounting_period_open(bigint, date)
  from public, anon;
grant execute on function private.assert_accounting_period_open(bigint, date)
  to authenticated;
