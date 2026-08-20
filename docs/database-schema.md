# Proposed database schema

This is a proposal for review, not an applied migration. PostgreSQL UUID primary
keys use `gen_random_uuid()`. Mutable tables include `created_at` and
`updated_at` (`timestamptz`, UTC); only exceptions are noted below.

## Enums

```sql
create type membership_role as enum ('admin', 'member');
create type content_status as enum
  ('idea', 'draft', 'ready', 'scheduled', 'posted');
create type media_kind as enum ('image', 'video');
```

The status transition rules belong in the application for V1. Database enum
values prevent invalid states; introducing a complex workflow engine would be
premature.

## Tables

### `organizations`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `name` | `text` | required |
| `slug` | `text` | required, unique |
| `created_at` | `timestamptz` | required, defaults to `now()` |
| `updated_at` | `timestamptz` | required, defaults to `now()` |

### `profiles`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key, references `auth.users(id)` on delete cascade |
| `display_name` | `text` | required |
| `avatar_url` | `text` | nullable |
| `created_at` | `timestamptz` | required, defaults to `now()` |
| `updated_at` | `timestamptz` | required, defaults to `now()` |

Email remains in Supabase Auth and is not duplicated in `profiles`.

### `organization_memberships`

| Column | Type | Rules |
| --- | --- | --- |
| `organization_id` | `uuid` | references `organizations(id)` on delete cascade |
| `profile_id` | `uuid` | references `profiles(id)` on delete cascade |
| `role` | `membership_role` | required, defaults to `member` |
| `created_at` | `timestamptz` | required, defaults to `now()` |

Primary key: (`organization_id`, `profile_id`). This small join table is required
for future organizations; it is not a broader permissions system.

### `campaigns`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `organization_id` | `uuid` | required, references `organizations(id)` |
| `name` | `text` | required |
| `location` | `text` | nullable |
| `starts_on` | `date` | nullable |
| `ends_on` | `date` | nullable; not before `starts_on` |
| `message` | `text` | nullable |
| `selling_points` | `text[]` | required, defaults to empty array |
| `ai_guidelines` | `text` | nullable campaign-specific additions |
| `created_at` | `timestamptz` | required, defaults to `now()` |
| `updated_at` | `timestamptz` | required, defaults to `now()` |

Index `campaigns(organization_id, starts_on)`. Campaign facts are structured;
the longer message and guidance remain plain text because V1 only edits and
passes them as context.

### `platforms`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `smallint generated always as identity` | primary key |
| `key` | `text` | required, unique |
| `name` | `text` | required |

Seed three rows: `facebook`, `instagram`, and `facebook_group`. This lookup table
supports more platforms later without tenant-specific configuration in V1.

### `content_items`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `campaign_id` | `uuid` | required, references `campaigns(id)` on delete cascade |
| `title` | `text` | required |
| `brief` | `text` | nullable idea/context |
| `status` | `content_status` | required, defaults to `idea` |
| `created_by` | `uuid` | required, references `profiles(id)` |
| `created_at` | `timestamptz` | required, defaults to `now()` |
| `updated_at` | `timestamptz` | required, defaults to `now()` |

Index `content_items(campaign_id, status, updated_at desc)` for the queue.

### `content_platforms`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `content_item_id` | `uuid` | required, references `content_items(id)` on delete cascade |
| `platform_id` | `smallint` | required, references `platforms(id)` |
| `body` | `text` | required, defaults to empty string |
| `scheduled_for` | `timestamptz` | nullable |
| `posted_at` | `timestamptz` | nullable |
| `external_url` | `text` | nullable link entered after manual posting |
| `created_at` | `timestamptz` | required, defaults to `now()` |
| `updated_at` | `timestamptz` | required, defaults to `now()` |

Unique (`content_item_id`, `platform_id`). Index `scheduled_for` for the
calendar. Platform-specific status is deliberately omitted in V1: the content
item moves through one shared workflow, while each variant can have its own
schedule and posting timestamp.

### `assignments`

| Column | Type | Rules |
| --- | --- | --- |
| `content_item_id` | `uuid` | primary key, references `content_items(id)` on delete cascade |
| `profile_id` | `uuid` | required, references `profiles(id)` |
| `assigned_by` | `uuid` | required, references `profiles(id)` |
| `assigned_at` | `timestamptz` | required, defaults to `now()` |

A primary key on `content_item_id` intentionally gives V1 one current assignee,
not assignment history or multiple collaborators.

### `media_assets`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `content_item_id` | `uuid` | required, references `content_items(id)` on delete cascade |
| `uploaded_by` | `uuid` | required, references `profiles(id)` |
| `kind` | `media_kind` | required |
| `storage_path` | `text` | required, unique |
| `file_name` | `text` | required |
| `mime_type` | `text` | required |
| `size_bytes` | `bigint` | required, non-negative |
| `alt_text` | `text` | nullable |
| `created_at` | `timestamptz` | required, defaults to `now()` |

Store files in a private `campaign-media` bucket under
`{organization_id}/{campaign_id}/{content_item_id}/{uuid}-{safe_filename}`.

### `results`

| Column | Type | Rules |
| --- | --- | --- |
| `id` | `uuid` | primary key |
| `content_platform_id` | `uuid` | required, references `content_platforms(id)` on delete cascade |
| `recorded_by` | `uuid` | required, references `profiles(id)` |
| `recorded_at` | `timestamptz` | required, defaults to `now()` |
| `views` | `integer` | required, defaults to 0, non-negative |
| `shares` | `integer` | required, defaults to 0, non-negative |
| `clicks` | `integer` | required, defaults to 0, non-negative |
| `registrations` | `integer` | required, defaults to 0, non-negative |

Index `results(content_platform_id, recorded_at desc)`. Each row is a cumulative
manual snapshot; the latest row is the current value and older rows provide a
minimal audit trail.

## Tenant integrity and RLS

All public tables enable and force RLS. A stable security-definer helper such as
`is_organization_member(organization_id uuid)` checks
`organization_memberships.profile_id = auth.uid()`; its `search_path` is fixed
and execute privileges are narrowly granted.

- Members may select their organization, its memberships, campaigns, content,
  variants, assignments, media metadata, and results.
- Members may create and update campaign content and results within their own
  organizations.
- Only admins may update organization/campaign settings and memberships.
- Insert/update policies use both `using` and `with check` so a row cannot be
  moved into another tenant.
- Assignment policies additionally ensure the assignee and assigner belong to
  the same organization as the content item.
- Media Storage policies derive the organization UUID from the first path
  segment and require matching membership. The bucket remains private.

Foreign keys alone cannot prove that referenced profiles belong to the same
organization. The migration will add constraint triggers or carefully scoped
write functions for assignment and attribution invariants, with tests for
cross-tenant attempts.

## Initial seed

Development seed data will create:

- organization: **Valley Creek Church**;
- campaign: **Bridge Fall 2026**;
- location: **Malvern, Pennsylvania**;
- start date: **2026-09-09**;
- selling points: free dinner, free childcare, questions welcome, no pressure,
  and a 10-week course; and
- the three platform rows listed above.

Auth users and memberships are not committed as production seed credentials.
A local-only seed user may be documented during the authentication phase.
