# Client resume links (ref + secret)

## Current behaviour

- New sessions receive a **reference** (`ref`) and **secret** (`s`) in the URL query string.
- Anyone with both values can load and update the draft via Supabase RPCs (`get_will_session`, `update_will_session`).
- Secrets are stored hashed in the database (`will_sessions.secret_hash`).

## UI safeguards (Phase 1)

- The form shows a warning that the link must not be forwarded except to Aristone Solicitors.
- Copy/share toasts repeat the same message.

## Not implemented yet (follow-up)

| Improvement | Notes |
|-------------|--------|
| **Session TTL / expiry** | Requires migration + RPC changes; would break old links unless phased in. |
| **Rate limiting** | Per-IP or per-ref limits on failed secret attempts. |
| **One-time or rotating secrets** | Stronger than static URL secret. |
| **Email magic link** | Verify client email before load. |

Do not enable TTL without product sign-off — existing client links would stop working.
