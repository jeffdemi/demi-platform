# Backup and recovery

The owner is accountable for backup coverage and recovery access; the designated
release operator verifies evidence before risky changes. No backup service,
retention setting, PITR entitlement, or restore drill is proven by this repository.
Actual configuration and last successful restore: **Needs confirmation**.

| Asset | Required external coverage | Restore responsibility |
| --- | --- | --- |
| Supabase PostgreSQL | Verify project backup/PITR settings, retention, latest recoverable point; encrypted independent exports where required | Owner/operator restores to an isolated compatible Supabase project first |
| Private Storage | Independently copy `expense-receipts` and `quote-photos` object bytes, paths, metadata and checksums to access-controlled versioned storage | Operator restores objects and verifies row/path consistency and private access |
| Vercel configuration | Secure inventory of project/team IDs, domains, build settings, Git branch, Auth redirect URLs and variable scopes for Production/Preview/Development | Owner restores configuration and redeploys matching code |
| Source code | Git remote plus a separate protected mirror/export including refs and required release artifacts | Maintainer verifies commit identity and lockfile, then runs CI |
| Encryption keys/secrets | Encrypted secrets manager with restricted recovery access and key-version history | Owner restores matching key versions or rotates/reconnects credentials |
| Migration history | Immutable Git SQL plus protected export of actual remote history and reviewed mapping for each release | Operator compares restored schema, applied history and release manifest before any migration |

Database backups include Storage metadata, **not Storage object bytes**. Database
backup availability and retention depend on the actual project setup; verify them
in the dashboard instead of assuming this repository enables them.
See [Supabase backup documentation](https://supabase.com/docs/guides/platform/backups).

Not in Git: production rows, Auth users/session data, private uploads, `.env.local`,
Vercel sensitive variable values, `.vercel` project links, database passwords,
Supabase secret/service keys, OpenAI keys, SimpleFIN Access URLs/Setup Tokens,
`BANK_CONNECTION_ENCRYPTION_KEY`, backup archives, and recovery credentials.
Never paste these into PRs, CI logs, tickets, or this document. Encrypted bank
connection ciphertext cannot be recovered without its matching encryption key;
rotating that key alone does not re-encrypt existing ciphertext.

Required external setup and evidence:

1. Owner sets acceptable data loss (RPO) and recovery time (RTO), retention and
   budget. Suggested starting targets for approval: at most 24 hours lost and
   recovery within one business day; these are not current guarantees.
2. Verify the latest backup time/recovery window in Supabase, enable appropriate
   coverage, and record evidence without credentials. Alert the operator if a
   backup exceeds the approved age or a scheduled export fails.
3. Configure separate Storage backups and secure configuration/secret inventories.
   Protect them with encryption, access controls and off-project retention.
4. Quarterly and before risky migrations, restore into an isolated target. Record
   backup ID/time, elapsed recovery time, validation results and responsible owner.

Before a risky migration: record the exact target and release SHA; capture schema
and migration history, verify a fresh recovery point and Storage coverage, rehearse
an upgrade against a representative sanitized restore, estimate locks/downtime,
and identify the previous compatible app deployment. Obtain approval for the
concrete change and its recovery plan. A history repair is also a production
change requiring a saved before-state and approval.

Restore procedure:

1. Contain writes and pause imports/syncs/deployment automation. Preserve incident
   logs, the release manifest and a snapshot of the damaged state where feasible.
2. Select a recovery point preceding the fault. Owner approves downtime/data-loss
   implications and the exact restore target. Prefer a new isolated project;
   never experiment with recovery on the live project.
3. Restore PostgreSQL using the supported Supabase recovery path for that backup.
   Reconcile Auth, grants, RLS, functions, extensions and migration history. Reset
   custom-role passwords and reconfigure external services as needed.
4. Restore private object bytes and metadata consistently with that database
   point. Inventory missing/orphaned objects; compare counts and checksums.
5. Restore matching secrets and environment scopes securely. Disable outbound
   integrations in the restored test environment; verify bank ciphertext with
   the matching key without printing plaintext or initiating a live sync.
6. Deploy the matching application version to the isolated target. Verify login,
   tenant/role restrictions, private receipt/photo access, quote/job links, row
   counts, latest known transactions, balanced journals, report totals, closed
   periods and duplicate-import protection. Run database tests only in a
   disposable copy, then the release smoke checklist.
7. Owner approves cutover only after evidence meets RPO/RTO and integrity targets.
   Account for legitimate writes since the recovery point through reviewed,
   auditable replay, not guessed balances. Monitor errors and reconcile totals.

After an incident, record timeline, impact, lost/replayed data, root cause,
restoration evidence and prevention actions. Rotate compromised credentials,
review access and recovery coverage, update this runbook, and add a regression
test. Do not overwrite ledger history to conceal recovery corrections.
