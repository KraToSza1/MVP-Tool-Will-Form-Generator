# Questionnaire edits: save, Supabase, and why changes might not show

## Does Mariyam need to “save to Supabase”?

**Yes — in practice.** Edits are stored when she clicks **Save questionnaire** in the Will Tool (staff area). That writes to the Supabase table **`form_definitions`** (one row named `default`).

- **If she only changed text in the editor and closed the tab without saving**, nothing is stored — clients keep seeing the old version.
- **After a successful save**, the live app loads that saved JSON on the next page load. No separate “export to Supabase” step — **Save questionnaire** is the step.

## Checklist if changes “don’t appear”

1. **Click “Save questionnaire”** at the top of the editor and wait for a success message.
2. **Hard refresh** the client form: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac), or try an incognito window (avoids old cached JS).
3. **Open the client form on the direct Will Tool URL** (Vercel), not only inside WordPress embed, to rule out caching on the parent site.
4. **Confirm her account can save** (staff role, RLS allows `form_definitions` upsert). If save fails, the UI should show an error — if unsure, check Supabase → **Table Editor** → `form_definitions` → `updated_at` changed after save.

## Repo vs database

- **Built-in JSON files** in Git (e.g. `src/data/Complete-WillSuite-Form-Data.json`) are the **default** when no custom definition exists in Supabase.
- Once **Save questionnaire** has run at least once, the app usually uses the **Supabase copy** and **overrides** the built-in file until that row is removed.

So: **edits in the editor = Supabase `form_definitions`.** Deploying new code updates the default JSON for **new** installs or if the DB row is cleared — not automatically for an existing saved questionnaire unless you merge manually.

## Raymond: after changing default JSON in Git

If you change the repo JSON and want **everyone** to get it, either:

- Have staff **re-import** / paste the updated structure in the editor and **Save**, or  
- Update the `form_definitions.payload` in Supabase (advanced), or  
- Delete the `default` row in `form_definitions` so the app falls back to shipped JSON (loses live edits — only if intended).
