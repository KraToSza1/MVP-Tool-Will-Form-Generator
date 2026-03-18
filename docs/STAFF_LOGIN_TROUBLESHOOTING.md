# Staff login problems

## “Sign-in timed out” (embedded in WordPress / iframe)

If the Will Tool is **inside an iframe** on `aristonesolicitors.co.uk` but the app is hosted on **Vercel**, the browser treats it as **third-party**. Chrome often **throttles or blocks** calls to Supabase Auth, so login **hangs** until it times out — **not** a wrong password.

**Fix:** Open solicitor login **in a full tab**, not inside WordPress:

`https://YOUR-VERCEL-APP.vercel.app/solicitor/login`

(e.g. `https://mvp-tool-will-form-generator-chi.vercel.app/solicitor/login`)

Same email and password. After sign-in, staff can use Matters / questionnaire in that tab.

**Optional:** Add a WordPress menu link “Staff: Will Tool login” pointing to that URL (opens in new tab).

The login page now shows an **amber box** with **Open solicitor login in new tab** when it detects an iframe.

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
