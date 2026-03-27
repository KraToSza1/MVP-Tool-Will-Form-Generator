# Console noise on WordPress (`aristonesolicitors.co.uk`)

These messages appear on the **WordPress parent page**, not inside the Will Tool bundle. **They are not fixed in the Will Tool repo** — fix them in WordPress / theme / plugins.

| Message | Source | What to do |
|---------|--------|------------|
| `gravity-forms-contact.js` — `$selectedOption.val() is undefined` | Theme `Aristone` | Fix `captureEnquiry` to guard when the select has no selection (or scope script so it does not run on Will Tool pages). |
| Quirks Mode on `55845r.html` | Third-party **Yoshki** / `cdn.yoshki.com` iframe | Third-party widget; optional: remove widget or ask vendor for valid HTML5 doctype. |
| MonsterInsights / GTM disabled for admin | Plugins | Expected when logged in as WP admin. |
| `Layout was forced before the page was fully loaded` | WordPress / theme | Performance/theme issue; not Will Tool. |
| Source map 404 `installHook.js.map` | Browser extension (e.g. React DevTools) | Harmless. |

**Will Tool–related:** `Partitioned cookie … vercel.app` is normal for an embedded iframe. Staff can sign in **inside** the embed; if login times out, use a **full tab** (see `STAFF_LOGIN_TROUBLESHOOTING.md`).

**Database:** If you see `stack depth limit exceeded` on listing matters, run the migration `20260318000000_fix_is_staff_rls_recursion.sql` in Supabase SQL Editor.
