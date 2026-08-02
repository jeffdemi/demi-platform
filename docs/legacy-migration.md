# Legacy SQLite Migration

## Safety Model

The original SQLite database is read-only during migration. The tool:

1. Runs SQLite integrity and foreign-key checks.
2. Computes a SHA-256 fingerprint of the source database.
3. Converts SQLite booleans and floating-point money into PostgreSQL-safe values.
4. Sends one normalized JSON snapshot to a service-role-only PostgreSQL function.
5. Imports all tables in one database transaction.
6. Preserves original primary keys in each table's `legacy_id` column.
7. Records the source fingerprint and imported counts in `legacy_imports`.
8. Verifies destination counts after the transaction.

The source database is never changed, deleted, or renamed.

## Dry Run

From the Next.js project:

```bash
npm run migrate:legacy
```

The default source is `../demi-business-platform/data/demi_business.db`. Pass another SQLite path as the first argument when needed.

## Apply

Complete the owner setup first so exactly one active business exists. Configure the server-only Supabase secret in `.env.local`, then run:

```bash
node --env-file=.env.local scripts/migrate-legacy-sqlite.mjs --apply
```

Do not use `--apply` against a different Supabase project without confirming its environment variables and target business first.
