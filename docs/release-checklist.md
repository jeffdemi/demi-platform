# Production release and smoke checks

Use one release record: date/operator, source commit, PR/check URLs, target
Supabase and Vercel project/environment, migration versions actually applied,
deployment URL, results below, and rollback decision. Never infer the target
from a remembered project name or a local link.

Before release:

- Require both Platform CI gates and a successful disposable database run.
- Resolve the [migration-history review](migration-history.md); a dry run alone
  cannot prove an old migration was applied correctly.
- Confirm a recoverable backup and compatible previous application deployment.
- Obtain owner approval for the exact migration/deployment plan. Apply the new
  additive RPC before deploying code that calls it. The old RPC remains available
  so the prior application can still operate during rollout or app rollback.
- Verify Vercel Git integration, production branch and preview environment scopes.
  Do not point preview deployments at production Supabase. CI does not deploy.
- Run migrations as a separate reviewed operation. Never put database push in
  Vercel's build command. Automatic main deployments must not outrun migrations;
  hold promotion until the database prerequisite is proven.

After deployment, record pass/fail (or reason for not run) for each row:

| Check | Expected result | Data impact |
| --- | --- | --- |
| Login | Existing user signs in and lands in correct business | Auth session/audit only |
| Dashboard | Renders totals and date controls without server errors | Read-only |
| Business switcher | Two authorized businesses show their own records; switching back works | Preference/session change |
| Customers | List and one detail page load | Read-only |
| Quotes and PDF | List/detail and PDF open with correct business/customer | Read-only |
| Quote → job | In designated test business, accept fixture quote, edit date/scope/amount, save; one linked job retains edits; repeat conversion rejected | Creates quote/job; updates status |
| Jobs | List/detail/edit form render | Read-only until saved |
| Invoices | List/detail/PDF render | Read-only |
| Expenses | List/detail and an authorized private receipt open | Read-only |
| Transaction review | Queue/detail show existing match/review state | Read-only; do not approve/classify |
| Finance | Accounts and reconciliation pages render | Read-only; do not sync/import/close |
| Reports | Monthly financial reports and books load with selected business/date | Read-only |
| Team/permissions | Owner sees memberships; intern reads an operational page and cannot save through a direct action | Denied write attempt, no business data change |

Run data-creating checks in staging first. Production writes need the owner's
explicitly designated test business and fixtures; never use real customer quotes
or change accounting records merely to pass a smoke check. Do not delete fixtures
through SQL; use approved application cleanup and retain their IDs in the record.
If no production test business is approved, mark the write check “Not run” and
attach staging evidence. Do not call a read-only smoke run full workflow coverage.

Inspect Vercel runtime errors and Supabase errors after these checks. Stop release
promotion on a failure, capture sanitized evidence, and use the
[recovery procedure](backup-recovery.md). Prefer reverting the application to a
compatible deployment; never automatically undo migrations or restore live data.
