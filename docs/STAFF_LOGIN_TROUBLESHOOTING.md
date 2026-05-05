# Staff login problems

## When staff are not technical — you still “see” the failure

She does **not** need to fetch logs from her Mac or phone, paste diagnostics, or use Supabase. **Trying to sign in is enough.**

Every failed Microsoft / OAuth step is logged **on the server** inside **Supabase** (same project as production `VITE_SUPABASE_URL`). You open **[Supabase Dashboard](https://supabase.com/dashboard) → Logs**, filter **Auth**, and scroll to roughly **when she tapped sign in**. That is how you diagnose “unable to exchange code” etc. without asking her for anything technical.

**In the solicitor portal (after deploying the migration `20260506120000_sign_in_support_events.sql`):** sign in as a firm **`admin`** (or the configured owner override account). Open **`/solicitor/sign-in-events`** or use the **Sign-in log** link in the top nav. You get a chronological list of **client-recorded failures** (Microsoft OAuth errors, policy blocks, emergency password errors) — no action from staff. If the migration is missing, that page explains how to enable it.

If you add **`VITE_SENTRY_DSN`** in Vercel, many auth failures are also sent **automatically** to Sentry — again, **nothing** required from staff.

The login-page **copy diagnostics** / **`?support=1`** shortcuts are optional for people who are comfortable pasting JSON; treat them as helpers, **not** a requirement for solicitors.

---

## See what went wrong (admins)

Your app **does not stream end-user phone logs to your laptop** — iOS Safari and Mac Safari do not expose that. You still have workable options:

1. **Supabase (authoritative for Microsoft 365 / Entra)** — In the [Supabase Dashboard](https://supabase.com/dashboard) for the same project as `VITE_SUPABASE_URL`, open **Logs** → **Postgres** / **Auth** (or **Edge** depending on your dashboard version) and filter for **Auth**. Failed OAuth and “unable to exchange code” errors are recorded **on the server** when she tries to sign in. Match her attempt by **time** (within a minute or two).

2. **Solicitor portal “Sign-in log”** — After running migration `supabase/migrations/20260506120000_sign_in_support_events.sql` in SQL Editor: sign into the portal as an **`admin`** user (or the configured owner override). Open **`/solicitor/sign-in-events`** (nav: **Sign-in log**). Recorded OAuth / policy failures appear there without asking staff for anything technical.

3. **In-app diagnostics (optional)** — Comfortably technical users may use **Copy sign-in diagnostics for support** on the login page; paste into Slack/email for you. Combine with Supabase logs at the same time if needed.

4. **Optional Sentry** — Add `VITE_SENTRY_DSN` in Vercel (see `.env.example`). Important auth failures emit **support messages** into your Sentry project (still no passwords). Useful if you want a single inbox for frontend issues across devices.

Staff can append `?support=1` to the login URL (e.g. `/celista-login?support=1`) to preview the diagnostic JSON on screen if clipboard fails on mobile.

---

## “Sign-in timed out” (embedded in WordPress / iframe)

The Will Tool is **meant to work embedded** on your site (iframe). Staff can sign in **inside** the embed using the same email and password as in a full tab.

Some browsers **slow down or throttle** network calls when the app runs in a **cross-origin** iframe (e.g. WordPress on your domain, app on Vercel). That can make sign-in **hang** until it times out — **not** always a wrong password.

**What we do in the app:** faster Supabase connection (preconnect), one automatic retry on timeout, optional URL-session parsing disabled only **inside** the iframe, and a timeout around loading the staff profile after password sign-in.

**If it still times out:** open solicitor login **in a full tab** (same account):

`https://YOUR-VERCEL-APP.vercel.app/solicitor/login`

(e.g. `https://mvp-tool-will-form-generator-chi.vercel.app/solicitor/login`)

**Optional:** Add a WordPress menu link “Staff: Will Tool login” pointing to that URL (opens in new tab).

The login page shows an **amber box** with **Open solicitor login in new tab** when it detects an iframe — use that only if embedded sign-in fails.

**Stronger setup (optional):** Point a **subdomain** of your firm’s site at Vercel (e.g. `will.aristonesolicitors.co.uk` → CNAME to the deployment). Same embed UX, sometimes fewer browser restrictions than `*.vercel.app` alone.

---

## “Wrong email or password”

## What the app does

Solicitor login uses **Supabase Auth** (`signInWithPassword`). If Supabase says the email/password don’t match, the app shows **Wrong email or password**.

## Common cause: no password set yet

In **Authentication → Users**, if **Last signed in** is **blank (`-`)**, the user has **never** signed in. Often they were **invited** or **added** but:

- They never completed the **invite link** to choose a password, or  
- No one told them the **temporary password** you set when creating the user, or  
- The password was mistyped when the account was created.

Adding someone in the dashboard does **not** automatically mean they know a working password.

## Fix for the staff member (recommended)

1. In **Supabase Dashboard** → **Authentication** → **Users**.
2. Click the user (e.g. `m.f@aristonesolicitors.co.uk`).
3. Click **Send password recovery** (or **Send magic link** if you use magic links).
4. They open the **email from Supabase**, follow the link, and **set a new password**.
5. They sign in on the Will Tool with that **email** and **new password**.

## After they can sign in

If they then see a message about **not being in the staff list** or **no solicitor profile**, add/update their row in **`public.profiles`** with `role` = `solicitor` or `admin` (see `docs/SOLICITOR_WORKFLOW_ROLLOUT.md`).

## “I gave her the correct password” — why it can still fail

Supabase only accepts the password **actually stored** for that user. If you’re sure you told her the right one, check these:

1. **Prove it yourself**  
   Open the **live Will Tool** (same URL she uses), **Incognito/private window**, email `m.f@aristonesolicitors.co.uk`, password you think is correct.  
   - If **you** can’t sign in → the password in Supabase is **not** that string (typo when you created the user, or you changed it later). Reset via **Send password recovery** or set a new password in the dashboard.  
   - If **you** can sign in but **she** can’t → she’s typing it differently (Caps Lock, space at end, autofill using another account, copy/paste from WhatsApp changing a character).

2. **Wrong Supabase project**  
   The deployed app uses `VITE_SUPABASE_URL` from **Vercel/hosting**. If that points at **Project A** but you created her user in **Project B**, her real credentials are in B — the app is asking A. Open the URL in your `.env` / Vercel env and confirm it’s the same project as the dashboard where you see her user.

3. **Trailing space in email**  
   The login form now **trims** the email on submit. Ask her to re-type the email with no space after `.co.uk`.

4. **Special characters in the password**  
   Messages/apps sometimes turn straight quotes into “smart” quotes or drop characters. Safest: **Send password recovery** so she sets her own password in the browser.

## Quick checklist

| Check | Action |
|-------|--------|
| Wrong password | Send password recovery from Supabase |
| You’re sure password is right | Sign in as her in Incognito yourself — if you fail, reset password in Supabase |
| Email typo | Must match Supabase exactly (trimmed automatically now) |
| Logged in but “access denied” | Fix `profiles.role` in Supabase |
| App says Supabase not configured | Deploy must have `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` |
| User exists in dashboard but app rejects | Confirm Vercel env Supabase URL = that project |

---

## Matters list: “stack depth limit exceeded” (HTTP 500)

Solicitor dashboard fails loading matters. Supabase logs show **54001 stack depth limit exceeded**.

**Cause:** Row Level Security on `profiles` + `matters` caused **infinite recursion** (`is_staff()` → read `profiles` → policy calls `is_staff()` again).

**Fix:** In Supabase → **SQL Editor**, run the migration:

`supabase/migrations/20260318000000_fix_is_staff_rls_recursion.sql`

(pastes the `SECURITY DEFINER` versions of `is_staff` and `current_user_role`). Then refresh the dashboard.
