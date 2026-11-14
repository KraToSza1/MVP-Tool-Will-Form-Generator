# Supabase restore runbook (backend offline)

**Symptom (found 14 Nov 2026):** the Supabase project behind the Will Tool, `proyrepqqpzerloyydlk` ("Will tool"),
no longer resolves in DNS (`proyrepqqpzerloyydlk.supabase.co` → *DNS name does not exist*). Both local `.env`
and the live Vercel build point at it. This is what Supabase does to a **paused** (or deleted) project.
Free-plan projects pause after about 7 days without activity.

While it is down:

| Area | Effect |
|------|--------|
| Solicitor login (Microsoft 365 and password) | Fails; the app now says "server could not be reached" instead of a raw error |
| Client save/resume links | Not created; answers stay on the client's device only (amber banner explains) |
| Client **Submit** | Cannot reach Aristone. The app now shows a clear "couldn't send — saved on this device, try again" message (it used to show a false "submitted" screen) |
| Appointments, matters dashboard, questionnaire editor | Unavailable |
| Questionnaire itself | Still works (falls back to the bundled form definition) |

---

## Option A: restore the existing project (keeps all matters and staff accounts)

1. Sign in at <https://supabase.com/dashboard> with the account that owns organisation `tmfuxrpakfaozpyzoenp`.
2. Open project **Will tool** (`proyrepqqpzerloyydlk`).
3. If it shows **Paused**, click **Restore project** and wait until it is healthy (a few minutes).
4. Check: `https://proyrepqqpzerloyydlk.supabase.co/auth/v1/health` loads in a browser.
5. Nothing to change in Vercel: the URL and anon key stay the same.
6. Smoke test: staff sign-in at `/celista-login`, open a matter, client intake **Submit** on a test record.

> Supabase only allows one-click restore for a limited time after pausing (90 days at the time of writing).
> If the dashboard says it can't be restored, use its **Download backup** option first (to keep existing
> matters), then follow Option B.

**Stop it happening again:** move the project to the **Pro plan** (paid by Aristone), because Pro projects are never paused.
Ideally transfer the Supabase organisation to an Aristone-owned account at the same time.

---

## Option B: new project (if the old one can't be restored)

1. **Create a project** (Aristone-owned account, Pro plan, region `eu-west-2` London).
2. **Schema**, from this repo:
   ```bash
   npx supabase login
   npx supabase link --project-ref <NEW_REF>
   npx supabase db push            # runs supabase/migrations/* in order
   ```
   (Or paste each file in `supabase/migrations/` into the SQL Editor in filename order.)
3. **Old data:** if you downloaded a backup in Option A, restore it with `psql` into the new project *before*
   step 2, or ask Supabase support to restore it.
4. **Auth settings** (Dashboard → Authentication):
   - URL configuration → Site URL `https://mvp-tool-will-form-generator-chi.vercel.app` (or the custom domain);
     Redirect URLs: `https://<app-domain>/celista-login` and `http://localhost:5173/celista-login`.
   - Providers → **Azure**: the client ID, secret *value* and tenant URL from Aristone's Entra app (see
     `docs/SOLICITOR_MICROSOFT_LOGIN_SETUP.md`). In Entra, add `https://<NEW_REF>.supabase.co/auth/v1/callback`
     as a **Web** redirect URI.
5. **Staff:** have each solicitor sign in once with Microsoft, then run `supabase/bootstrap_profiles_and_admin.sql`
   (edit the admin email in it) to give the admin role.
6. **Edge functions** (appointment emails): deploy `supabase/functions/process-appointment-outbox` and
   `send-solicitor-client-email`, then set the secrets `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`,
   `M365_SENDER_USER` and `M365_REPLY_TO` (see `scripts/setup-m365-outbox.ps1`, `docs/APPOINTMENT_EMAIL_DELIVERY_SETUP.md`).
7. **Vercel** → Project → Settings → Environment Variables (Production *and* Preview):
   `VITE_SUPABASE_URL=https://<NEW_REF>.supabase.co`, `VITE_SUPABASE_ANON_KEY=<new anon key>`.
   **Redeploy** afterwards, because `VITE_*` values are baked in at build time.
8. Update the local `.env` the same way (never commit it).
9. Smoke test as in Option A step 6, and run the questionnaire editor once to confirm `form_definitions` loads.

---

## Quick health check

```bash
nslookup <ref>.supabase.co          # must resolve
curl -I https://<ref>.supabase.co/auth/v1/health
```
