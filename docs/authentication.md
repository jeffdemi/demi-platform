# Authentication

## Account Model

- The first owner must be `jeffdemi@gmail.com`.
- `/setup` is available only while no business exists.
- PostgreSQL enforces the owner email and one-business bootstrap rule.
- After bootstrap, all new accounts are owner invitations.
- Password recovery returns the same response for known and unknown emails.
- Protected routes validate signed JWT claims with `getClaims()`.
- Row Level Security remains the final authorization boundary.

## Supabase Dashboard

Under Authentication:

1. Keep **Confirm email** enabled.
2. Allow signup only until the first owner finishes `/setup`, then disable it.
3. Set a minimum password length of at least 12 characters.
4. Enable strong character requirements and leaked-password protection when available.
5. Configure production SMTP before relying on invitations or password recovery.
6. Review Auth rate limits and enable CAPTCHA if the public endpoint receives abuse.

Under URL Configuration:

- Set **Site URL** to the production Vercel URL.
- Add `http://localhost:3000/**` for local account-flow testing.
- Add the production and intended Vercel preview URL patterns.

## Invite Template

The **Invite user** email template must use the token hash so Next.js can establish the SSR cookie session:

```html
<h2>Join Demi Platform</h2>
<p>You have been invited to help manage Demi Stump Grinding.</p>
<p><a href="{{ .RedirectTo }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite&next=/account/accept-invite">Accept invitation</a></p>
```

Keep the standard Supabase confirmation and password-recovery templates unless their redirect behavior is intentionally customized.

## Vercel Variables

Configure these for Production, Preview, and Development:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
NEXT_PUBLIC_SITE_URL
SUPABASE_SECRET_KEY
```

`NEXT_PUBLIC_SITE_URL` should be the canonical production URL. `SUPABASE_SECRET_KEY` must never be exposed to the browser, printed, or committed.

## Account Routes

- `/setup` - one-time first-owner registration
- `/login` - password sign-in
- `/forgot-password` - generic recovery request
- `/auth/callback` - PKCE code exchange
- `/auth/confirm` - token-hash confirmation for invitations
- `/account/update-password` - authenticated password update
- `/account/accept-invite` - invitation verification and membership creation
- `/account/team` - owner invitation management
