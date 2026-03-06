# Immediate Manual Test Script

Use this after running both Supabase migrations and deploying the updated app.

## 1. Public draft persistence

1. Open `/` in a fresh browser session.
2. Confirm the URL updates from `/` to `/?ref=...&s=...` after the form loads.
3. Confirm the top bar shows a reference code.
4. Fill at least:
   - name fields
   - email or phone
   - one or two later-step fields
5. Wait 1-2 seconds.
6. Confirm the UI shows `Saved ...`.

### Expected database result

In Supabase table `will_sessions`:

- a row should exist with:
  - `ref` matching the URL
  - `payload` containing `_step`
  - `payload` containing normal form values
- `payload` must **not** contain:
  - `identityVerification`
  - raw `data:image...` strings
  - signature data URLs

## 2. Cross-device restore

1. Copy the full URL including `?ref=...&s=...`.
2. Open it in another browser or incognito window.
3. Confirm:
   - the form loads previously entered values
   - the current step is restored

### Expected result

- `loadSession(...)` rehydrates `formValues`
- `_step` restores navigation position

## 3. Public submission creates a matter

1. Continue the form until the final step.
2. Complete the required fields.
3. Click `Submit`.
4. Wait for the completion modal.

### Expected database result

In Supabase table `matters`:

- one row should exist with:
  - `session_ref` equal to the public reference
  - `client_reference` equal to the same reference
  - `status = 'submitted'`
  - `submitted_at` populated
  - `client_payload` populated
  - `client_snapshot` populated
- `client_payload` must **not** contain:
  - `identityVerification`
  - signature images
  - solicitor-only dashboard metadata

In table `matter_activity`:

- at least one row should exist for that matter with:
  - `action = 'submitted'`
  - `actor_type = 'client'`

## 4. Solicitor authentication

1. Open `/solicitor/login`.
2. Sign in with a valid Supabase Auth solicitor account.
3. Confirm you are redirected to `/solicitor`.

### Expected result

- you can access dashboard routes only after authentication
- unauthenticated access to `/solicitor` should redirect to `/solicitor/login`

## 5. Dashboard visibility

1. On `/solicitor`, confirm the submitted matter appears.
2. Search by:
   - reference
   - client name
   - email
3. Filter by status.

### Expected result

- the row appears with:
  - correct reference
  - submitted status
  - client summary values
  - last activity timestamp

## 6. Matter detail and assignment

1. Open the matter detail screen.
2. Add solicitor notes and save them.
3. Assign the matter to yourself.
4. Change status to:
   - `verification_pending`
   - then `in_review`

### Expected database result

In `matters`:

- `assigned_solicitor_id` updates
- `solicitor_notes` updates
- `status` updates
- `reviewed_at` populates when marked `in_review`

In `matter_activity`:

- rows are added for:
  - `matter_assigned`
  - `solicitor_notes_updated`
  - `status_changed`

## 7. Solicitor mode continuation

1. From matter detail, click `Continue in solicitor mode`.
2. Confirm the form opens inside `/solicitor/matters/:matterId/form`.
3. Confirm solicitor-only sections are visible.
4. Make edits and wait for autosave.
5. Click `Save Draft`.
6. Return to the matter detail screen and reopen the form.

### Expected result

- solicitor-only form changes persist
- autosave writes to `matters.solicitor_payload`
- reopening the form restores the merged client + solicitor state

## 8. Client visibility safety

1. Open the public form `/` without authentication.
2. Confirm solicitor-only sections are hidden.
3. In production, test `/?solicitor=1`.

### Expected result

- public users should still see client mode
- production should not expose solicitor mode from the query param alone

## 9. Client PDF safety

1. Complete the public flow and generate the client-facing completion path.
2. Generate the client copy PDF.

### Expected result

- no witness or execution blocks
- no solicitor-only Testamentary Capacity clause content

## 10. Identity verification safety

1. Upload an identity image in client mode.
2. Save and wait for autosave.
3. Inspect the matching `will_sessions.payload` and `matters.client_payload`.

### Expected result

- identity image data is not persisted to Supabase
- image remains local to the browser session / localStorage only
