# Mariyam Will Tool MVP Full Audit

**Date:** 18 May 2026  
**Scope:** Full MVP audit for Aristone Solicitors / Mariyam — read-only; no code changes.  
**Auditor basis:** Repository inspection, `npm run lint`, `npm run build`, `npm run test:unit`, targeted code/search review.

---

## 1. Executive Summary

The Will Tool is a **mature React + Vite SPA** with a **large dynamic questionnaire**, **client vs solicitor modes**, **Supabase-backed save/resume and matter workflow**, and a **jsPDF-based Will document generator**. For Aristone’s MVP goals, the product is **substantially built**: clients can complete intake on mobile-friendly steps, save progress via ref+secret links, upload ID documents, and download an **intake-only client PDF**; solicitors can sign in (Microsoft 365), review matters, complete Testamentary Capacity, and generate **execution-ready PDFs** with witness blocks.

The MVP is **not yet “production-ready” without hardening**. The production build succeeds and **51 unit tests pass**, but **ESLint reports 9 errors**, the **`npm test` script is broken** (missing runner file), **logging is very verbose in production paths**, **`.env` appears tracked in git** (not listed in `.gitignore`), and several **privacy/documentation gaps** remain (ID images in `localStorage`, compressed ID blobs in Supabase matters, ref+secret links with no rate limiting). The **WordPress iframe embed works in principle** (`frame-ancestors *`, camera `allow`), but **fixed iframe height** and **no parent↔child resize messaging** can hurt mobile UX inside Elementor.

**Overall verdict:** **Nearly production-ready — needs hardening** before wide live client use. Suitable for **controlled pilot** with Mariyam if Phase 1 blockers below are addressed and a structured QA pass is completed.

---

## 2. Current MVP Status

| Rating | **Nearly production-ready — needs hardening** |
|--------|-----------------------------------------------|

**Why not “production-ready” yet**

- Legal/PDF risk: complex clause interpolation (~4k lines in `PDFGeneratorJSPDF.js`); stale `formValues` when users change answers are not systematically pruned.
- Privacy: ID verification images persist in browser `localStorage` and are **uploaded to Supabase on matter submit** (compressed) — staff docs still describe “local only” in places.
- Security hygiene: `.env` not in `.gitignore` (file is tracked); share URLs carry **ref + secret** with no brute-force/rate limits on RPCs.
- Engineering hygiene: 9 lint errors; `npm test` fails; ~100 `console.log` calls in PDF generator alone; main form component ~6,200 lines.

**Why not “risky for live client use”**

- Client PDF uses `maxSectionIndex` + `excludeFromWill` + hides Testamentary Capacity and solicitor-only UI fields.
- Cloud draft payload explicitly **strips** `identityVerification` and signatures (`buildCloudPayload` in `src/lib/formPayload.js`, covered by tests).
- Matters table has **RLS staff-only** read/update; will_sessions uses **hashed secrets** and no direct anon table access.
- Client execution PDF is clearly labelled **“INTAKE ONLY”** with testator signature box but **no witness attestation blocks** (witness blocks only on solicitor PDF).

---

## 3. What Is Working Well

1. **Clear architecture split (conceptually):** routing in `src/App.jsx`; questionnaire in `FormRenderer.jsx` + `FieldRenderer.jsx`; clauses in `src/utils/buildClauses.js`; PDF in `src/components/PDFGeneratorJSPDF.js`; persistence in `src/lib/willSessions.js`, `src/lib/matters.js`, `src/lib/formPayload.js`.
2. **Client vs solicitor mode** is title-based (not only fragile index): `TESTAMENTARY_CAPACITY_SECTION_TITLE`, `SOLICITOR_ONLY_FIELD_IDS`, `visibleSections` filtering in `FormRenderer.jsx` (`src/constants/clientMode.js`).
3. **Client PDF safeguards:** `isClientPDF` + `CLIENT_VISIBLE_MAX_SECTION_INDEX` in `PDFGeneratorJSPDF.js` (~line 2404); execution page shows intake messaging and omits witness attestation when `isClientPDF` (~lines 4042–4174).
4. **Estate Overview / internal fields** marked `excludeFromWill: true` in `src/data/Complete-WillSuite-Form-Data.json` so they should not become Will clauses.
5. **Supabase will_sessions:** secret hashed with `crypt`; anon blocked from direct table access; RPC-only access (`supabase/migrations/20260305000000_will_sessions.sql`).
6. **Solicitor portal:** dashboard, matter detail, form editor, Testamentary Capacity quick actions, ID verification review, calendar/appointments, reports — useful for Mariyam’s workflow.
7. **Matter outstanding model:** `src/lib/matterOutstanding.js` — ID verification, BPR/property trust, Testamentary Capacity categories.
8. **ID image compression** before submit (`src/lib/compressIdImages.js`) reduces RPC timeouts.
9. **WordPress path documented** (`docs/WORDPRESS_ELEMENTOR_EMBED.md`) + plugin `wordpress-plugin/will-tool-embed/will-tool-embed.php` with `allow="camera; clipboard-write; fullscreen"`.
10. **Responsive/dark-theme rules** in `.cursor/rules/` and substantial `src/index.css` dark overrides.
11. **Error boundary + optional Sentry** (`src/components/ErrorBoundary.jsx`, `src/monitoring/sentry.js`).
12. **Build passes** (`npm run build`, Vite 8); **51 unit tests pass** across 6 files (`npm run test:unit`).

---

## 4. Critical Issues

### C1 — `.env` not gitignored (possible secrets in repo)

| | |
|---|---|
| **Severity** | **Critical** |
| **File(s)** | `.gitignore`, `.env` (tracked — `git ls-files .env` returns the file) |
| **Problem** | `.gitignore` does not list `.env`. If real Supabase keys or other secrets were committed, they may exist in git history. |
| **Risk** | Credential leak, unauthorised DB access, reputational/legal breach. |
| **Recommended fix** | Add `.env` to `.gitignore`; rotate all keys; remove `.env` from tracking (`git rm --cached .env`); audit history. Use Vercel/host env only. |
| **Effort** | **Small** (process + rotation may be **Medium**) |

### C2 — Client share links grant full read/write on session (ref + secret in URL)

| | |
|---|---|
| **Severity** | **Critical** (for MVP threat model) |
| **File(s)** | `src/lib/willSessions.js`, `src/components/FormRenderer.jsx` (share URL with `?ref=&s=`), `supabase/migrations/20260305000000_will_sessions.sql` |
| **Problem** | Anyone with ref+secret can load/update JSON payload via anon RPCs. No rate limiting, lockout, or expiry visible in migrations. |
| **Risk** | Link forwarded/leaked → third party can read or alter client Will answers before solicitor review. |
| **Recommended fix** | MVP minimum: short TTL, optional one-time secret, rate limits on RPCs, warn users in UI; longer term: magic-link email verification before load. |
| **Effort** | **Medium** |

### C3 — ID documents stored in Supabase on matter submit (documentation mismatch)

| | |
|---|---|
| **Severity** | **High** (privacy / GDPR) |
| **File(s)** | `src/lib/matters.js` (`submitMatterFromDraft`), `docs/IDENTITY_VERIFICATION_STORAGE.md`, `docs/PHASE2_PERSISTENCE.md` |
| **Problem** | Docs state ID data is local-only / not sent to backend; code **compresses and includes `identityVerification` in matter payload** on submit. Cloud **draft** saves exclude ID (`buildCloudPayload`). |
| **Risk** | Client expectation mismatch; sensitive images in `matters.client_payload` JSONB; retention/access policy must be explicit. |
| **Recommended fix** | Confirm with Aristone legal/compliance; update privacy notice; consider separate encrypted storage bucket + retention policy; fix docs. |
| **Effort** | **Medium** (policy) / **Large** (architecture change) |

### C4 — Stale hidden answers may remain in `formValues` and affect PDF

| | |
|---|---|
| **Severity** | **High** (legal document accuracy) |
| **File(s)** | `src/components/FormRenderer.jsx`, `src/utils/buildClauses.js`, `src/components/PDFGeneratorJSPDF.js` |
| **Problem** | No systematic “prune on condition change” when user reverses a radio/select. Hidden fields are skipped at **render** and **clause build** uses `evaluateConditions`, but values can remain in state/localStorage and affect interpolation edge cases. |
| **Risk** | Wrong beneficiary/executor/trust wording if stale keys are referenced indirectly. |
| **Recommended fix** | On answer change, clear dependent field IDs from schema; add regression tests for “fill → change answer → PDF” paths. |
| **Effort** | **Medium** |

### C5 — Production console logging may expose client data

| | |
|---|---|
| **Severity** | **High** |
| **File(s)** | `src/components/PDFGeneratorJSPDF.js` (~100 `console.log`), `src/components/FormRenderer.jsx` (~100), `src/lib/matters.js`, `docs/FLOW_LOGGING.md` |
| **Problem** | `[WillTool Flow]`, `[PDF GENERATION]`, and auth logs run in production builds unless tree-shaken (many are unconditional). |
| **Risk** | Client PII in browser console on shared devices; support screen-shares leak data. |
| **Recommended fix** | Gate all flow logs behind `import.meta.env.DEV` or `VITE_DEBUG_*`; keep structured logging server-side only where needed. |
| **Effort** | **Small**–**Medium** |

### C6 — `[Office Address]` placeholder in professional executor PDF text

| | |
|---|---|
| **Severity** | **High** (professional output) |
| **File(s)** | `src/components/PDFGeneratorJSPDF.js` (~line 625), `src/constants/aristoneSolicitors.js` (has real address) |
| **Problem** | `_getAristoneProfessionalOptions()` uses `address: "[Office Address]"` with TODO. |
| **Risk** | Final PDFs sent to clients/courts contain placeholder text. |
| **Recommended fix** | Wire to `aristoneSolicitors.js` canonical address; legal review of wording. |
| **Effort** | **Small** |

### H1 — ESLint errors fail CI-quality bar

| | |
|---|---|
| **Severity** | **High** |
| **File(s)** | `BookAppointmentModal.jsx`, guided components, `FormRenderer.jsx`, `portalBrowserFreshStart.js` (9 errors per `npm run lint`) |
| **Problem** | Unused vars / useless assignment — indicates incomplete features or copy-paste debt. |
| **Risk** | Latent bugs (e.g. `matterId` unused in booking modal). |
| **Recommended fix** | Fix or remove dead code; enable lint in CI. |
| **Effort** | **Small** |

### H2 — `npm test` script broken

| | |
|---|---|
| **Severity** | **Medium** |
| **File(s)** | `package.json` → missing `scripts/run-all-tests.js` |
| **Problem** | `npm test` throws `MODULE_NOT_FOUND`. |
| **Risk** | Team thinks tests ran when they did not; regression drift. |
| **Recommended fix** | Restore runner or point `test` to `vitest run`. |
| **Effort** | **Small** |

### H3 — Monolithic `FormRenderer.jsx` (~6,229 lines)

| | |
|---|---|
| **Severity** | **Medium** (maintainability → production bugs) |
| **File(s)** | `src/components/FormRenderer.jsx` |
| **Problem** | Single file owns navigation, validation, autosave, cloud session, submit, PDF, share, autofill, interpolation preview. |
| **Risk** | Regressions when Mariyam requests small changes; hard to review PRs. |
| **Recommended fix** | Incremental extraction (persistence hook, PDF hook, validation hook) — not a rewrite. |
| **Effort** | **Large** (phased) |

### H4 — WordPress iframe: fixed height, no dynamic resize

| | |
|---|---|
| **Severity** | **Medium** |
| **File(s)** | `wordpress-plugin/will-tool-embed/will-tool-embed.php`, `docs/WORDPRESS_ELEMENTOR_EMBED.md` |
| **Problem** | Iframe uses static height (`800` / `80vh`); no `postMessage` height sync. Inner app scrolls inside iframe — awkward on mobile/iOS Safari. |
| **Risk** | Double scrollbars, clipped buttons, poor completion rates on phones. |
| **Recommended fix** | Optional resize script in plugin + app listener; test 320–375px widths. |
| **Effort** | **Medium** |

### H5 — `localStorage` draft may hold ID base64 until submit

| | |
|---|---|
| **Severity** | **Medium** |
| **File(s)** | `src/components/FormRenderer.jsx` (`willForm` key), `docs/IDENTITY_VERIFICATION_STORAGE.md` |
| **Problem** | Full draft including `identityVerification` can sit in localStorage on client devices. |
| **Risk** | Shared-family devices; XSS impact surface (if any script injection on host page). |
| **Recommended fix** | Store ID slots in `sessionStorage` only or memory until submit; document retention. |
| **Effort** | **Medium** |

### H6 — Anon RPC `record_sign_in_support_event` (abuse surface)

| | |
|---|---|
| **Severity** | **Medium** |
| **File(s)** | `supabase/migrations/20260506120000_sign_in_support_events.sql` |
| **Problem** | Anon can insert support events (payload capped at 12KB). Staff-only read. |
| **Risk** | Table spam / noise; must ensure payload never contains passwords (relies on client discipline). |
| **Recommended fix** | Rate limit; CAPTCHA or HMAC; strip PII from payload schema. |
| **Effort** | **Medium** |

### L1 — `?solicitor=1` only works in DEV on public routes

| | |
|---|---|
| **Severity** | **Low** (positive) |
| **File(s)** | `src/constants/clientMode.js` |
| **Problem** | Production public intake ignores `?solicitor=1` unless path is `/solicitor/*`. |
| **Risk** | Low — note for QA: do not rely on query param in prod. |
| **Recommended fix** | Document for team. |
| **Effort** | **Small** |

### L2 — Large JS bundle (~1.8 MB main chunk)

| | |
|---|---|
| **Severity** | **Low** |
| **File(s)** | Vite build output |
| **Problem** | Main chunk warning >500 kB; PDF generator lazy-loaded but still heavy. |
| **Risk** | Slow first load on mobile networks inside iframe. |
| **Recommended fix** | Further code-splitting; prefetch on idle. |
| **Effort** | **Medium** |

---

## 5. High-Value Improvements for Mariyam

1. **Matter “at a glance” panel** on dashboard: client name, ref, % steps complete, ID status, TC status, last activity, one-click “Open form” / “Download PDF”.
2. **Client completion summary** (read-only): plain-English list of choices (executors, guardians, residue split) before submit — reduces “I didn’t mean that” calls.
3. **PDF review step** for solicitors: side-by-side checklist vs generated clause list (`buildClauseDebugExport` already exists in `FormRenderer.jsx` — surface in UI).
4. **Resume link email template** (copy button): short instructions for clients + security warning not to forward link.
5. **Testamentary Capacity wizard** — already partially in `MatterQuickActionModal.jsx`; add progress % and “what’s missing” on matter card.
6. **Internal handover export**: JSON/PDF pack (client snapshot + solicitor notes + TC fields) for file opening — not another full rewrite.
7. **Client-friendly validation copy** — map field IDs to plain labels (partially done for TC in `matterOutstanding.js`).
8. **“Confidence check” modal** before client final submit: “Have you included all children / former spouses / foreign assets?” keyed off form branches.
9. **Solicitor notes** visible only in portal (never in client PDF) — verify no `solicitor_notes` interpolation in clauses.
10. **LPA opportunity banners** (`LpaOpportunityClient.jsx`) — good for upsell; add Mariyam toggle to disable per matter if too noisy.

---

## 6. UX and Mobile Improvements

| Area | Finding | Recommendation |
|------|---------|----------------|
| **Progress** | Sidebar + step index in `FormRenderer` / `Sidebar.jsx` | Sticky mobile progress bar; show “Step X of Y” on small screens |
| **Touch targets** | Workspace rules require ~44px — mostly followed | Audit primary buttons on 320px |
| **Date of birth** | Modal + `react-datepicker` in `FieldRenderer.jsx` | Test iOS Safari keyboard overlap inside iframe |
| **Repeaters** | Guardian flow embedded variant; person modals | Card layout below `lg` for repeater tables |
| **Identity upload** | Camera + file picker; HTTPS/`allow=camera` documented | In-iframe test matrix (iOS Safari, Android Chrome) |
| **Double scroll** | WP fixed iframe height | Dynamic height or full-page link “Open in new tab” prominent |
| **Dark theme** | Supported via `ThemeContext` + `index.css` | Avoid opacity tints (`bg-indigo-50/90`) on new panels per project rules |
| **Autofill button** | Shown in DEV or `VITE_SHOW_CLIENT_AUTOFILL=true` | Ensure **false** on production Vercel for real clients |
| **Keyboard** | Long forms | `scrollIntoView` on focus for inputs near bottom (verify on mobile) |

---

## 7. PDF Improvements

| Item | Status / risk | Action |
|------|----------------|--------|
| **Testator signature box** | Present on execution page; empty for client PDF | OK for intake |
| **Two witness blocks** | Only when `!isClientPDF` (~4174) | OK — client PDF has no witness columns |
| **Witness data when `includeWitnessDetails !== 'Yes'`** | Solicitor PDF still renders empty witness boxes | Acceptable for signing appointment; confirm with Mariyam |
| **Testamentary Capacity in Will body** | Section excluded via `maxSectionIndex` for client PDF | Verify after any questionnaire reorder |
| **Estate Overview in Will** | Fields use `excludeFromWill` | Spot-check PDF after client completes estate step |
| **Clause quality** | `sanitizeUnprofessionalContent`, incomplete clause blocking in `buildClauses.js` | Legal review of sample outputs (married, blended, BPR, property trust) |
| **Placeholders** | Validation appendix at end of PDF | Train staff: placeholders = not ready for execution |
| **Text wrap** | jsPDF manual layout | Test long addresses and foreign character names |
| **Identity / internal leakage** | No `identityVerification` in PDF grep | Keep excluded; audit any new `display` fields |
| **Firm address** | `[Office Address]` TODO | **Fix before live** (Critical C6) |
| **Logging** | Verbose PDF logs | Disable in production |

**Suggested PDF QA pack:** Generate 6 fixtures — single testator, mirror wills, guardians yes/no, property trust, BPR trust, residue split + change answer mid-flow.

---

## 8. Solicitor Mode Improvements

| Area | Current behaviour | Improvement |
|------|-------------------|-------------|
| **Activation** | `/solicitor/*` routes + `ProtectedRoute` + MS login (`src/lib/auth.js`) | Document celista-login URL for staff |
| **Hidden from clients** | Section title + `SOLICITOR_ONLY_FIELD_IDS` + `_hiddenFromClient` in JSON | Automated test: client route never renders TC fields |
| **Testamentary Capacity** | Quick action modal + required field IDs in `matterOutstanding.js` | Pinpoint missing fields on matter list badge |
| **ID verification** | Shown on `MatterDetailPage` from merged payload | Mark verified + notes (`MatterQuickActionModal`) — good; add audit log entry |
| **PDF from matter** | `MatterDetailPage` calls `generatePDFWithJSPDF` with `isClientPDF: false` | Add “client copy” vs “execution pack” labels |
| **Questionnaire editor** | `QuestionnaireEditorPage.jsx` + Supabase `form_definitions` | Train Mariyam: factory JSON vs live DB definition |
| **Admin email** | `SOLICITOR_ADMIN_OVERRIDE_EMAIL` hardcoded | Move to env-only list (`VITE_SIGN_IN_LOG_ALLOW_EMAILS` pattern) |
| **Dashboard scale** | Filters, urgent page, calendar | Export CSV for weekly review |

---

## 9. Supabase / Security / Privacy Findings

### Schema (migrations present)

| Table / feature | Migration | Notes |
|-----------------|-----------|-------|
| `will_sessions` | `20260305000000_will_sessions.sql` | Secret hashed; RPC-only |
| `matters`, `profiles`, `matter_activity` | `20260306000000_matters_and_auth.sql` | RLS staff read/update |
| `form_definitions` | `20260307000000_form_definitions.sql` | Staff-editable questionnaire |
| `appointments` | `20260429000000_appointments.sql` | Session-scoped booking |
| `sign_in_support_events` | `20260506120000_sign_in_support_events.sql` | Anon insert via RPC |

### Positive controls

- `buildCloudPayload` / tests exclude `identityVerification` from **draft** cloud saves.
- Matters not readable by anon; client submit via `submit_will_matter` RPC (see `src/lib/matters.js`).
- `is_staff()` RLS fix migration `20260318000000_fix_is_staff_rls_recursion.sql` documented for dashboard errors.

### Risks & recommendations

1. **Rotate keys** if `.env` was ever committed (Critical C1).
2. **Document lawful basis** for storing ID images in `matters.client_payload` (Critical C3).
3. **Session link security** — TTL, rate limits (Critical C2).
4. **`frame-ancestors *`** in `vercel.json` — any site can embed; restrict to `https://www.aristonesolicitors.co.uk` when domain known.
5. **Do not use `user_metadata` for authorization** (Supabase best practice) — current RLS uses `profiles.role`; verify no JWT user_metadata policies were added elsewhere.
6. **Sign-in support events** — anon writable; add abuse controls (H6).

---

## 10. WordPress / iframe Findings

| Topic | Finding |
|-------|---------|
| **Plugin** | `will-tool-embed.php` — shortcode `[will_tool]`, settings for URL + height |
| **Camera** | `allow="camera; clipboard-write; fullscreen"` — matches app docs |
| **CSP** | `vercel.json` allows embedding from any parent (`frame-ancestors *`) |
| **Layout** | Full-bleed `100vw` wrapper may cause horizontal scroll inside boxed themes |
| **Height** | Static; inner app scrolls — **no postMessage resize** |
| **Parent page noise** | Documented in `docs/WORDPRESS_EMBED_CONSOLE_NOISE.md` (theme JS errors unrelated to app) |
| **Solicitor login in iframe** | Supported with timeout guidance + open in new tab (`SolicitorLoginPage.jsx`, `STAFF_LOGIN_TROUBLESHOOTING.md`) |
| **Third-party cookies** | Partitioned cookies warning possible (doc’d) — test save/resume logged out |

**Recommendations:** Test `[will_tool]` on staging WP page at 375px; offer prominent “Open full screen” link; consider restricting `frame-ancestors`; optional resize script.

---

## 11. Code Quality Findings

| Topic | Detail |
|-------|--------|
| **Duplication** | Clause logic in `buildClauses.js` + large interpolation block in `PDFGeneratorJSPDF.js` |
| **Dead dependency** | `@react-pdf/renderer` in `package.json` — not imported in `src/` (unused) |
| **Legacy JSON** | `Complete-WillSuite-Form-Data-FINAL-autofill-updated.json`, `README-LEGACY-FORM-DATA.txt` — clarify which is canonical (bundled factory + DB override) |
| **Tests** | 6 unit test files; no `tests/e2e` directory despite `package.json` `test:e2e` script |
| **Scripts** | `scripts/puppeteer-e2e-demo.js`, `scripts/mariyam-ui-smoke.mjs` — manual QA helpers, not CI |
| **Naming** | Login path `/celista-login` vs “solicitor” in UI — document for Aristone staff |
| **Condition logic** | Complex nested AND/OR in JSON; debug behind `VITE_DEBUG_CLAUSES` |
| **Performance** | Autosave + localStorage quota checks in `FormRenderer` — good pattern; watch large ID payloads |

---

## 12. Recommended Roadmap

### Phase 1 — Must Fix Before Live Use

1. **Secrets:** `.gitignore` + remove `.env` from git + rotate Supabase keys (C1).
2. **PDF firm address** placeholder (C6).
3. **Privacy alignment:** Confirm ID storage in matters; update client-facing text + `IDENTITY_VERIFICATION_STORAGE.md` (C3).
4. **Disable production debug logging** for client/solicitor flows (C5).
5. **Fix ESLint errors** (H1).
6. **Fix `npm test`** script (H2).
7. **Session link risk:** UI warnings + Mariyam process; plan rate limits (C2).
8. **Stale answer pruning** for top 5 high-risk branches (residue, guardians, executors, property trust, exclusions) (C4).
9. **WordPress mobile QA** on real Elementor page (H4).
10. **Verify `VITE_SHOW_CLIENT_AUTOFILL` is off** in production.

### Phase 2 — Professional Polish for Mariyam

1. Matter dashboard “completion summary” and outstanding badges.
2. Client-readable validation messages and pre-submit confidence check.
3. PDF review UI for solicitors (clause diff / missing items).
4. Resume-link email/copy templates and security wording.
5. iframe height UX (resize or full-screen CTA).
6. Reduce `FormRenderer` size incrementally (extract hooks).
7. Expand unit tests: conditional visibility, PDF clause snapshots, `buildCloudPayload`.
8. Lint + unit tests in CI (GitHub Actions).

### Phase 3 — Future Enhancements

1. Email magic-link resume (replace raw secret in URL).
2. Separate Storage bucket for ID with retention job.
3. Mirror wills / linked matters.
4. Client portal read-only status (“Your solicitor is reviewing”).
5. Clause versioning when questionnaire editor changes mid-matter.
6. Remove `@react-pdf/renderer` or use it for a simpler export path.
7. Restrict `frame-ancestors` to Aristone domains only.
8. Full e2e suite (Playwright) covering iframe + PDF download.

---

## 13. Suggested Acceptance Criteria

### Client intake (public / iframe)

- [ ] Complete full questionnaire on Chrome Android, Safari iOS, desktop Chrome at 375px, 768px, 1280px.
- [ ] Save draft → copy link → open on second device → answers restored (cloud mode).
- [ ] Refresh mid-form → no data loss (local + cloud).
- [ ] Invalid/expired ref+secret shows clear error, no blank screen.
- [ ] Upload all four ID slots (camera + file); submit matter; solicitor sees images on matter detail.
- [ ] Client PDF downloads; shows **INTAKE ONLY**; **no** witness attestation blocks; **no** Testamentary Capacity wording in body.
- [ ] No “Auto-Fill Form” for production clients.
- [ ] No solicitor-only fields visible in client UI.

### Solicitor portal

- [ ] MS login works top-level and in iframe (or documented fallback new tab).
- [ ] Matter list loads <5s for expected volume; no RLS recursion error.
- [ ] Complete Testamentary Capacity via quick action; outstanding clears.
- [ ] Execution PDF includes testator + two witness areas; firm address correct.
- [ ] Solicitor notes never appear in client PDF.

### Security / privacy

- [ ] No secrets in git; env only on host.
- [ ] Cloud draft payload contains no ID images (verify network tab).
- [ ] Privacy notice mentions ID storage if retained in Supabase.
- [ ] Share link warning displayed.

### WordPress

- [ ] `[will_tool]` on staging page; camera works; no double-scroll blocking submit.
- [ ] Theme JS errors on parent do not block iframe.

### Engineering

- [ ] `npm run build` passes.
- [ ] `npm run lint` passes (0 errors).
- [ ] `npm run test:unit` passes.
- [ ] `npm test` works or is removed from docs.

---

## 14. Developer Notes

### Commands run (18 May 2026)

| Command | Result |
|---------|--------|
| `npm run lint` | **Failed** — 9 errors, 19 warnings |
| `npm run build` | **Passed** (~7.4s) |
| `npm run test` | **Failed** — `scripts/run-all-tests.js` not found |
| `npm run test:unit` | **Passed** — 51 tests, 6 files |

### Assumptions

- Supabase migrations in repo match **deployed** production schema (not verified against live project in this audit).
- Mariyam/legal team will confirm whether **client PDF** is “instructions only” vs any wording that could be mistaken for executed Will.
- Aristone WordPress URL and Elementor page layout were not live-tested in this audit (code/docs only).

### Areas needing human / legal confirmation

1. Is storing compressed ID images in `matters.client_payload` approved under firm GDPR policies?
2. Should client PDF ever be emailed directly to clients without solicitor review?
3. Witness boxes on solicitor PDF when witnesses not yet identified — OK as blank lines?
4. Correct **Testamentary Capacity** retention — solicitor_payload only (code intent in `matterOutstanding.js`) vs client visibility.
5. Questionnaire edits via editor mid-flight — how to handle matters started on old definition?

### Repository map (quick reference)

| Concern | Primary location |
|---------|------------------|
| Routing | `src/App.jsx` |
| Client intake shell | `src/pages/PublicIntakePage.jsx` |
| Form orchestration | `src/components/FormRenderer.jsx` |
| Field rendering | `src/components/FieldRenderer.jsx` |
| Form schema (bundled) | `src/data/Complete-WillSuite-Form-Data.json` |
| Live schema (DB) | `src/lib/formDefinition.js` |
| Client/solicitor rules | `src/constants/clientMode.js` |
| Clauses | `src/utils/buildClauses.js` |
| PDF | `src/components/PDFGeneratorJSPDF.js` |
| Cloud sessions | `src/lib/willSessions.js` |
| Matters | `src/lib/matters.js`, `src/pages/MatterDetailPage.jsx` |
| Payload privacy helpers | `src/lib/formPayload.js` |
| WordPress embed | `wordpress-plugin/will-tool-embed/will-tool-embed.php` |

### Prior audit

`WILL_TOOL_AUDIT_15_MARCH_2026.md` flagged index-based TC hiding and missing Supabase — **partially superseded**: persistence and title-based hiding exist now; re-validate PDF leakage and ID storage against this document.

---

*End of audit — no application code was modified during this review.*
