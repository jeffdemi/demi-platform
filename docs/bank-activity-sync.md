# Bank Activity Sync

The pending bank-sync release adds a user-driven SimpleFIN Bridge transaction
feed without replacing statement reconciliation. One SimpleFIN App connection
can expose every authorized account across Chase and Bank of America. The UI
discovers the full account list dynamically; it does not assume a fixed count.

The expected provider-side list currently has four accounts, including Chase
business checking, a Chase business credit card, and Bank of America accounts.
Each account must be mapped independently to an existing Finance account. Leave
personal or unrelated accounts set to **Do not import**.

## User workflow

1. Sign into SimpleFIN Bridge and connect the institutions under **My Account**.
2. Open `https://bridge.simplefin.org/simplefin/create`, name the app “Demi
   Platform,” and create a one-time Setup Token.
3. Paste that token only into `/finance/bank-sync`. Never send it in chat, email,
   a screenshot, or a source file.
4. The server immediately claims the token, encrypts the resulting Access URL,
   fetches every available account, and discards the one-time token.
5. Map each business account. Leave personal accounts unmapped.
6. Click **Import latest bank activity**. Review the durable preview, then
   confirm it. No transaction is written before confirmation.

The preview labels rows `existing`, `new`, `ambiguous`, or `pending`.
Confirmation links existing rows to their stable provider IDs and inserts new
posted rows once. Ambiguous and pending rows stay out of Finance.

SimpleFIN refreshes institution data roughly daily, and new bank activity can
take several days to appear. CSV import remains the fallback.

## Deployment configuration

SimpleFIN does not require a public application ID, client certificate, or API
key. Demi Platform needs one server-only encryption key:

```text
BANK_CONNECTION_ENCRYPTION_KEY=<32 random bytes encoded as base64 or 64 hex characters>
```

Generate it once and retain it in the deployment secret store:

```bash
openssl rand -base64 32
```

Changing or losing this key makes the stored SimpleFIN Access URL unreadable;
create a new Setup Token to reconnect. Never commit the encryption key, a Setup
Token, or an Access URL.

## Security boundaries

- The Setup Token is a one-time Base64-encoded claim URL. The server accepts
  only HTTPS claim URLs on the official SimpleFIN Bridge hosts and blocks
  redirects.
- A claimed Access URL is validated, encrypted with AES-256-GCM, and stored in
  `bank_connection_secrets`. That table has RLS enabled, no authenticated-user
  grants, and service-role access only.
- Every Server Action rechecks the signed-in business and owner/admin role.
- Provider error text is sanitized before display. A failed 403 claim tells the
  user to disable the potentially compromised token and create another.
- Disconnect removes the local encrypted credential and mappings. The owner
  should also revoke the App under SimpleFIN **My Account**.

## Fetch and duplicate rules

SimpleFIN permits a maximum 90-day request range and recommends roughly five
days of overlap. The service uses 85-day windows with five-day overlap, merges
overlapping results, and stays within the provider's intended daily call rate.

Transaction IDs are unique only within a provider account. Database uniqueness
therefore includes the local Finance account as well as provider and transaction
ID. Matching is conservative and occurs in this order:

1. exact provider transaction ID within the mapped Finance account;
2. exact normalized import fingerprint;
3. one exact amount/date/normalized-description match;
4. one matching description and amount within three days;
5. otherwise hold a same-day/same-amount possibility as ambiguous;
6. otherwise treat a posted item as new.

SimpleFIN already uses the application's sign convention: deposits are positive
and withdrawals are negative.

## Product boundary

The integration retrieves balances only for account discovery and transactions
for import. The current release does not persist provider balances, move money,
download PDFs, create statement periods, reconcile statements, or automatically
classify bookkeeping. Formal month-end reconciliation still uses the bank/card
statement's opening and closing balances.

## Verification and release

Do not test the initial schema against production. In a disposable Supabase
project, branch, or staging environment:

1. Apply `20260817151043_bank_activity_sync.sql`.
2. Configure `BANK_CONNECTION_ENCRYPTION_KEY`.
3. Create a SimpleFIN Setup Token and confirm that all four authorized accounts
   appear, including the Chase credit card.
4. Map only business accounts; verify that unrelated accounts remain unmapped.
5. Preview activity already loaded by CSV and prove it is labeled **already
   present**.
6. Confirm one genuinely new posted row and one pending row; only the posted row
   should be inserted.
7. Run the same preview again and prove no duplicate row appears.
8. Run tests, lint, typecheck, build, and Supabase security/performance advisors.
9. Obtain explicit approval before production migration or deployment.

Protocol references: [SimpleFIN protocol](https://www.simplefin.org/protocol.html)
and [SimpleFIN Bridge developer guide](https://beta-bridge.simplefin.org/info/developers).
