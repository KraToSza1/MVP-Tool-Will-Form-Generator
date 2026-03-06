# Solicitor Workflow Rollout

## What this release adds

- Secure solicitor authentication using Supabase Auth.
- Protected solicitor routes:
  - `/solicitor/login`
  - `/solicitor`
  - `/solicitor/matters/:matterId`
  - `/solicitor/matters/:matterId/form`
- Separate matter tracking layer in Supabase:
  - `profiles`
  - `matters`
  - `matter_activity`
- Public questionnaire submission now creates or updates a matter via `submit_will_matter(...)`.
- Solicitor editing saves to `matters.solicitor_payload`, not back into the public anonymous draft model.

## Required Supabase setup

Run this migration after the existing `will_sessions` migration:

- `supabase/migrations/20260306000000_matters_and_auth.sql`

This migration:

- creates `profiles`, `matters`, and `matter_activity`
- backfills `profiles` from existing `auth.users`
- creates a trigger so new Supabase Auth users receive a `profiles` row automatically
- adds RLS policies for staff-only matter access
- adds `submit_will_matter(...)` RPC for client-side submission
- grants the existing `will_sessions` RPCs to `authenticated` users as well as `anon`

## Required solicitor account setup

1. In Supabase Auth, create solicitor accounts using the Users area or invite flow.
2. After the user exists, verify a `profiles` row exists.
3. Set the role for each staff user:

```sql
update public.profiles
set role = 'solicitor'
where email = 'name@aristonesolicitors.co.uk';
```

For admins:

```sql
update public.profiles
set role = 'admin'
where email = 'name@aristonesolicitors.co.uk';
```

4. Optional display name:

```sql
update public.profiles
set display_name = 'Jane Doe'
where email = 'name@aristonesolicitors.co.uk';
```

## Workflow model

### Public draft

- Stored in `will_sessions`
- Access controlled by `ref + secret`
- Intended for anonymous, in-progress, cross-device draft continuity

### Submitted matter

- Stored in `matters`
- Created by the public form on final submit
- `client_payload` is the client-safe submitted intake payload
- `solicitor_payload` stores solicitor-side edits and solicitor-only continuation data
- `client_snapshot` stores the lightweight contact snapshot used for dashboard search and triage

### Activity log

- `matter_activity` records submission and solicitor actions
- Use this table for audit and timeline display

## Security notes

- Production no longer trusts `?solicitor=1` as an access control mechanism.
- `isSolicitorMode()` only honors `/solicitor` routes in production; query-param solicitor mode is now dev-only.
- Nested identity verification data is removed from the cloud payload builder before draft persistence.
- Client PDF clause generation is limited to client-visible sections to prevent solicitor-only clause leakage.

## Recommended next operational steps

1. Run the new migration in Supabase.
2. Create at least one solicitor user in Supabase Auth.
3. Assign the profile role.
4. Sign into `/solicitor/login`.
5. Submit a client questionnaire from `/`.
6. Confirm that the matter appears on `/solicitor`.
