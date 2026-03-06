# Phase 2: Backend Persistence (Secure Save/Load) – Implementation

**Client:** Aristone Solicitors (WordPress + Elementor)  
**Decision:** Supabase + Vercel; app hosted separately, embedded in WP via Elementor iframe/script.

---

## 1. INVENTORY

### Framework & build
| Item | Finding |
|------|--------|
| **Framework** | React 19.2 + Vite 7.1 (not Next.js) |
| **Routing** | Single-page; no router. Section index in state (`currentIndex`). |
| **Main entry** | `index.html` → `src/main.jsx` → `App.jsx` → `FormRenderer.jsx` |
| **Build** | `npm run build` → Vite → `dist/` |
| **Deploy** | `vercel.json`: SPA rewrite `(.*)` → `/index.html` |

### Form state
| Item | Location |
|------|----------|
| **Where stored** | `src/components/FormRenderer.jsx`: `useState` for `formValues` / `setFormValues` (line ~134). |
| **Initialization** | From `localStorage.getItem('willForm')` (line ~135); fallback `{}`. |
| **Updates** | `setFormValues` from `FieldRenderer`, `IdentityVerification`, autofill, reset, and modal processors. |

### Reference (“ref”)
| Item | Location |
|------|----------|
| **Generated** | `FormRenderer.jsx`: `getOrCreateReferenceNumber()` (lines 68–95). |
| **URL** | If no `ref` in URL: generate new ref, then `window.history.replaceState` with `?ref=...`. |
| **localStorage** | `willFormRef` stores ref; also read from URL param `ref` (8–12 alphanumeric). |
| **Share** | “Share” button (lines 3357–3383): builds URL with `?ref=...`, `navigator.share` or `clipboard.writeText`. |
| **Cross-device (before Phase 2)** | Data not restored on other device; toast says “Form data is stored on this device only”. |

### PDF generation
| Item | Location |
|------|----------|
| **Entry** | `FormRenderer.jsx`: “Download PDF” / “Download client copy” triggers handler that lazy-loads `./PDFGeneratorJSPDF.js` and calls `generatePDFWithJSPDF(sanitizedValues, signatures, { isClientPDF })` (lines ~2970–3040). |
| **Data source** | `formValues` → sanitized to `sanitizedValues` (signatures/data URLs stripped for size; corruption checks). |
| **Client vs solicitor PDF** | `isClientPDF = clientCopy || !isSolicitorMode()` (line 3035). `PDFGeneratorJSPDF.js`: `isClientPDF` hides witness/attestation blocks and shows “INTAKE ONLY” (lines 3568, 3586, 3643, 3667, 3674). |

### clientMode / solicitorMode (PDF safety)
| Item | Location |
|------|----------|
| **Definition** | `src/constants/clientMode.js`: `isSolicitorMode()` reads `?solicitor=1` (or `true`/`yes`); `TESTAMENTARY_CAPACITY_SECTION_INDEX = 18`; `SOLICITOR_ONLY_FIELD_IDS`. |
| **UI** | `FormRenderer.jsx`: `visibleSections` excludes section index 18 in client mode (lines 168–174); field-level skip for `SOLICITOR_ONLY_FIELD_IDS` (e.g. ~3537). |
| **PDF** | Client PDF uses `isClientPDF` so witness/signing blocks are not rendered; clause content comes from `buildClauses` (all sections). *Audit note: clause builder does not filter by section; possible leakage if solicitor-only data exists in formValues.* |

### Identity upload
| Item | Location |
|------|----------|
| **Component** | `src/components/IdentityVerification.jsx`: photo/upload → base64 data URLs. |
| **Storage today** | Stored in `formValues.identityVerification`; persisted with draft in `localStorage` (key `willForm`). |
| **Not sent** | No backend upload; local-only. |

---

## 2. WHAT'S MISSING

### Dependencies to install
- `@supabase/supabase-js` (add to `package.json`, then `npm install`).

### Environment variables
- **Build-time (Vite):** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.  
- **Referenced in:** `src/lib/supabase.js` (see Implementation).  
- **Where to set:**  
  - Local: `.env` (create; do not commit secrets).  
  - Vercel: Project → Settings → Environment Variables (Production/Preview/Development).

### Optional
- `.env.example` listing `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (no values).

---

## 3. IMPLEMENTATION

See below for code: Supabase client, will-session API, FormRenderer URL/load/save and Copy link.  
SQL and Supabase setup are in **Section 4**.

---

## 4. SQL / SUPABASE SETUP

### Steps to create Supabase project and run SQL

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.  
2. Choose org, name, DB password, region → **Create project**.  
3. Wait for the project to be ready.  
4. **Project Settings** (gear) → **API**: copy **Project URL** (`VITE_SUPABASE_URL`) and **anon public** key (`VITE_SUPABASE_ANON_KEY`).  
5. **SQL Editor** → **New query** → paste the contents of `supabase/migrations/20260305000000_will_sessions.sql` from the repo → **Run**.  
6. Confirm no errors. Table `will_sessions` and the three RPCs should exist.

### What the migration does

- **Table:** `will_sessions` with columns: `id` (uuid), `ref` (text unique), `secret_hash` (text), `payload` (jsonb), `created_at`, `updated_at`.  
- **Trigger:** `updated_at` set on every update.  
- **RLS:** Enabled; anon cannot read/write the table directly (policy `USING (false) WITH CHECK (false)`).  
- **RPCs:** `create_will_session`, `get_will_session`, `update_will_session` (SECURITY DEFINER) use pgcrypto `crypt()` so only the correct secret allows create/read/update.

Exact SQL is in repo: `supabase/migrations/20260305000000_will_sessions.sql`.

---

## 5. TEST PLAN

### Cross-device (ref + secret in link)
1. Device A: Open app (no ref) → new session, URL gets `?ref=...&s=...`.  
2. Copy link (Copy link / Share).  
3. Device B: Open link → form hydrates from Supabase.  
4. Edit on B → autosave → reload on A with same link → see B’s data.

### Regression
- **PDF:** Generate client PDF (no `?solicitor=1`) → no witness blocks; generate solicitor PDF (`?solicitor=1`) → witness/signing present.  
- **Identity upload:** Upload/capture → still in `formValues.identityVerification`; save/load session restores (or document if ID docs excluded from payload for size).  
- **Required fields / Next:** Required validation and Next disable/enable unchanged.  
- **Clause preview:** Unchanged.

---

## 6. VERCEL DEPLOY STEPS

1. Push repo to GitHub (or connect existing).  
2. Vercel → New Project → Import repo.  
3. Build: **Framework Preset** Vite; **Build Command** `npm run build`; **Output** `dist`.  
4. Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.  
5. Deploy.  
6. Optional: Custom domain; ensure CSP/headers allow embedding if using iframe.

---

## 7. WORDPRESS / ELEMENTOR EMBED NOTES

- **Editor access only:** No server-side PHP required for MVP; embed via iframe or script.  
- **Iframe:** Elementor HTML/widget:  
  `<iframe src="https://your-vercel-app.vercel.app" title="Will Tool" width="100%" height="800" allow="camera; microphone"></iframe>`  
  Adjust URL, title, size; `allow` needed if identity capture/upload uses camera/mic.  
- **Script (alternative):** Load app in a div: e.g. `<div id="will-tool-root"></div>` and a script that mounts the app (if you build a bundle that mounts to a configurable root).  
- **CORS:** App and Supabase on same origin or Supabase allows Vercel origin; no WordPress CORS needed for API.  
- **ID documents:** Do not store in WordPress. If later stored in Supabase Storage, define retention and access in Supabase (RLS, lifecycle).

---

*End of Phase 2 persistence document.*
