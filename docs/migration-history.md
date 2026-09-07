# Migration history review — 2026-09-07

Production history is **Needs confirmation**. No production query, history repair,
linked push, migration, or deployment was performed for this release.

The old README/development notes claimed 36 names present on 2026-08-16; the old
status document claimed 41 on 2026-08-20 and left intern/tolerance/correction
migrations uncertain. Neither records exact production version timestamps.
These are historical claims, not evidence that local versions equal remote ones.
The checkout contains 43 historical SQL files plus the new hardening migration.
Multi-business and expense-category migrations also lack verified production
application evidence in those notes. Every exact remote mapping remains unresolved.

## Local inventory

Run `npm run db:inventory` for current versions, names and SHA-256 values. The
following is the inventory reviewed for this release. Production version for
**every row: Needs confirmation**. The final hardening migration is newly authored
and has not been applied to production in this task.

| Local version | Name |
| --- | --- |
| 20260802005213 | initial_platform |
| 20260802020712 | invite_only_accounts |
| 20260802020758 | legacy_import_support |
| 20260802021227 | harden_invitation_indexes |
| 20260804001500 | full_feature_parity |
| 20260804002000 | job_import_creator_index |
| 20260804002500 | invoice_workflow_hardening |
| 20260806015833 | financial_accuracy |
| 20260806021125 | financial_accuracy_advisor_indexes |
| 20260806120000 | accounting_operations |
| 20260806135021 | accounting_operations_advisor_indexes |
| 20260808120000 | quote_ai_workbench |
| 20260809205108 | crabtree_management_reporting |
| 20260814134601 | backfill_unlinked_job_payments |
| 20260814143427 | bookkeeping_month_end_close |
| 20260814170939 | bookkeeping_advisor_indexes |
| 20260814191531 | digital_assets_business_lines |
| 20260814215205 | correct_demi_identity_and_seed |
| 20260814215900 | bulk_business_line_classification |
| 20260815083422 | consistent_record_archiving |
| 20260815085257 | record_deletion_override |
| 20260815100000 | bank_classification_rules |
| 20260815102000 | bank_classification_rules_creator_index |
| 20260815103000 | restore_accounting_period_check_execute |
| 20260815104000 | harden_bookkeeping_helper_permissions |
| 20260815105000 | bank_allocation_rls_writes |
| 20260815191435 | owner_funded_expenses |
| 20260815205544 | bookkeeping_data_cleanup |
| 20260815223023 | correct_july_31_payment |
| 20260815234608 | monthly_bookkeeping_integrity_cleanup |
| 20260815235900 | bookkeeping_integrity_advisor_indexes |
| 20260816000200 | complete_known_equipment_financial_settings |
| 20260816002237 | reconcile_april_venmo_card_transfer |
| 20260816011043 | reconcile_may_venmo_bofa_crypto_funding |
| 20260817003601 | reconcile_equipment_card_expenses |
| 20260817004939 | classify_remaining_equipment_card_expenses |
| 20260817151043 | bank_activity_sync |
| 20260817195800 | bank_connection_secret_fk_index |
| 20260818120000 | intern_role |
| 20260818130000 | expense_match_tolerance_settings |
| 20260818140000 | fuzzy_expense_match_corrections |
| 20260821120000 | multi_business_support |
| 20260823120000 | expense_categories |
| 20260907221107 | platform_reliability_atomic_quote_conversion |

## Safe reconciliation procedure

1. Freeze migration changes for the review; preserve every historical filename and
   SQL byte. Capture `npm run db:inventory`, release SHA and intended project ref.
2. With authorized read-only production access, export the following query to a
   protected operator record (not Git; historical statements may contain data):

   ```sql
   begin read only;
   select version, name, statements
   from supabase_migrations.schema_migrations
   order by version;
   commit;
   ```

   Verify the project identity in the dashboard. The CLI equivalent history view
   is `npx --yes supabase@2.117.0 migration list --linked` from a separately verified
   operator checkout; it is read-only. Never link `.supabase-local` to any remote.
3. Build a per-migration mapping: local version/hash, actual remote version/name,
   SQL equivalence, schema/constraint/function evidence, data-correction evidence,
   and reviewer. Names or similar timestamps alone do not prove equivalence.
   Missing, duplicated, reordered, partially applied or ambiguous rows remain
   **Needs confirmation**. Compare schema-only exports as supporting evidence;
   schema equality cannot prove historical data corrections were executed.
4. Rehearse against a disposable clone containing the relevant history and
   representative sanitized data. Do not replay an apparently missing historical
   migration until its actual effects have been established.
5. If only history labels differ, propose exact remote history operations that
   remove the obsolete version marker and record the matching local version as
   applied. `migration repair --status reverted/applied` changes history, not
   schema; it is not a rollback. Review CLI `migration repair --help`, save the
   complete before-state, and rehearse the exact mapping and reversal. No repair
   commands with guessed versions are provided or automated here.
6. Obtain owner approval for the concrete mapping, backup, target and exact
   history-only operations. Unresolved rows block production reconciliation.
7. After approved repair, re-export history and compare it to the reviewed map.
   Only then inspect `db push --linked --dry-run` in that operator checkout.
   It must list exactly the reviewed new migrations, with no historical replay.
   An unexpected migration is a stop condition. A clean dry run is necessary,
   not authorization to push. Production application requires separate approval.

**A blind linked push is never safe.** Do not rename or rewrite applied local
migrations to conceal the mismatch. Future releases should use one reviewed
versioned migration path and record exact applied versions in the release log.

## Empty database replay limitation

Seven historical migrations contain unguarded tenant-existence checks or
`SELECT INTO STRICT` lookups of specific production financial records. A raw reset of `supabase/migrations`
cannot succeed on an empty database. An additive later migration cannot repair
an earlier replay failure.

`supabase/local-replay-exceptions.json` identifies exact checksums and retained
prefix lengths. `npm run db:prepare` copies migrations into an ignored isolated
project, replacing five data-only corrections with explanatory comments and
retaining all schema/trigger/RPC changes before the final data-only blocks of
`20260814215900_bulk_business_line_classification.sql` and
`20260815234608_monthly_bookkeeping_integrity_cleanup.sql`. Other migrations are
copied byte-for-byte. Source migrations are never modified, and changes to an
exception's checksum fail preparation for explicit review.

This projection validates schema/RLS and new RPC behavior, **not historical
production cleanup results or a full production upgrade**. Never publish, link,
or push it. A representative restored-data rehearsal of the original history
remains required before production reconciliation. Future data corrections must
have explicit empty-database guards or separate operator-run data procedures.

### Projection integrity controls

The canonical source is always `supabase/migrations`. The generated project is
ignored by Git and rejects linked-project metadata. The helper accepts only
fixed local commands, verifies a Unix-socket Docker endpoint, and refuses extra
migration files, duplicate versions, missing exception sources, and modified
exception checksums. New canonical SQL files are automatically included in the
next preparation/reset; there is no separate allowlist for schema migrations.

A successful reset records a digest of all canonical migration checksums and the
exception rules. Tests/history refuse to run if that digest changes, reset fails,
or generated SQL differs from its expected projection. Preparation alone never
counts as a successful replay. This prevents a stale local schema from being
silently presented as validation of a new migration. Eight application tests
exercise these guards without connecting to any database.

The seven exceptions preserve these exact boundaries:

| Migration | Why its data block cannot replay empty | Schema retained |
| --- | --- | --- |
| `20260814215205` | Requires exactly one existing Demi tenant | Data-only file; no schema omitted |
| `20260814215900` | Requires Demi tenant and stump business line | Entire classification RPC and grants before the final DO block |
| `20260815205544` | Requires known bank accounts, ledger accounts and payments | Data-only file; no schema omitted |
| `20260815223023` | Requires the specific July 31 payment | Data-only file; no schema omitted |
| `20260815234608` | Requires identified expenses, transactions, equipment and payment | All function/trigger definitions and preceding general backfills |
| `20260816002237` | Requires the April transfer pair and allocation | Data-only file; no schema omitted |
| `20260816011043` | Requires May Venmo/crypto funding records | Data-only file; no schema omitted |

The retained boundaries are character offsets into checksum-verified UTF-8 text.
These controls prevent accidental divergence through the supported workflow;
they cannot prevent a developer from deliberately bypassing the helper and
running arbitrary CLI commands. Never link/push the generated project. Its local
history is a disposable test artifact and must never be used as production
history evidence or exported as a replacement migration baseline.
