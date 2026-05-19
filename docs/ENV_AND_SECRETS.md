# Environment variables and secrets

## Where secrets belong

- **Never commit** `.env` or real API keys to git.
- Set production values in **Vercel** (or your host) → Environment Variables.
- Set Supabase keys in the **Supabase Dashboard** → Project Settings → API.

Copy `.env.example` to `.env` for local development only.

## Required client variables

| Variable | Purpose |
|----------|---------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase publishable/anon key (browser-safe only) |

Never put the **service role** key in any `VITE_*` variable.

## Optional debug (must stay off in production)

| Variable | Purpose |
|----------|---------|
| `VITE_DEBUG_WILL_TOOL` | Verbose flow/PDF logs (`true` only for support) |
| `VITE_DEBUG_CLAUSES` | Clause build logs |
| `VITE_DEBUG_FIELD_RENDERER` | Field-level logs |
| `VITE_SHOW_CLIENT_AUTOFILL` | Shows “Auto-Fill Form” on hosted builds — **do not enable for real clients** |

## If `.env` was ever committed

1. Remove it from git tracking: `git rm --cached .env` (keeps your local file).
2. **Rotate** the Supabase anon key and any other exposed secrets in the Supabase and Vercel dashboards.
3. Review git history for leaked values (e.g. `git log -p -- .env`).

This repository adds `.env` to `.gitignore`; rotation is a **manual** step for the project owner.
