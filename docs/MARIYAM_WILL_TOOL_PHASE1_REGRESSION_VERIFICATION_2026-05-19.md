# Mariyam Will Tool Phase 1 Regression Verification

**Date:** 19 May 2026  
**Branch:** `phase1-hardening-before-qa`  
**Commit:** `0ebe03c` — *Phase 1 hardening for Mariyam Will Tool MVP*  
**Verifier:** Automated + static code review (no new code changes in this pass)

---

## 1. Summary

Phase 1 hardening **does not appear to have broken the build or test suite**. Automated checks are green: **0 ESLint errors**, **58 tests passed**, **production build succeeded**.

**This pass did not run a full interactive browser smoke test** (client journey, resume link in incognito, solicitor Microsoft login, WordPress iframe on a device). Those steps remain **required human QA on staging** before production.

**Recommendation:** **Safe to deploy to staging / Vercel preview for QA** — not safe to skip staging QA or go straight to live Mariyam use. No rollback indicated from automated verification alone.

---

## 2. Commands Run

| Command | Exit code | Result |
|---------|-----------|--------|
| `npm run lint` | 0 | **0 errors**, 25 warnings |
| `npm test` | 0 | **8 files, 58 tests passed** |
| `npm run test:unit` | 0 | Same as `npm test` |
| `npm run build` | 0 | **Built successfully** (~6.6s) |

Additional targeted tests (same session):

| Command | Result |
|---------|--------|
| `npx vitest run src/utils/pruneStaleBranchValues.test.js` | 6/6 passed |
| `npx vitest run src/constants/aristoneSolicitors.test.js` | 1/1 passed |
| `npx vitest run src/components/PDFGeneratorJSPDF.artifact.test.js` | 1/1 passed; wrote `artifacts/verify-pdf-from-source.pdf` |

### Git

| Command | Result |
|---------|--------|
| `git checkout -b phase1-hardening-before-qa` | Branch created |
| `git add -A` + commit | **31 files changed**, 1687 insertions, 665 deletions |
| `git check-ignore -v .env` | `.env` ignored via `.gitignore` line 39 |
| `git ls-files .env` | **Empty** (not tracked) |

---

## 3. Changed Files Reviewed

| File / area | Risk | Assessment |
|-------------|------|------------|
| `src/components/FormRenderer.jsx` (~981 line diff) | **High** | Mostly `console.log` → `debugLog`; added `setFormValues` wrapper with `pruneStaleBranchValues`; share/iframe UI. **Risk:** pruning on every state update — mitigated by 6 unit tests, not full UI E2E. |
| `src/components/PDFGeneratorJSPDF.js` | **High** | `pdfDebugLog` gating + firm address fix. Client `isClientPDF` / `CLIENT_VISIBLE_MAX_SECTION_INDEX` unchanged in intent. |
| `src/utils/pruneStaleBranchValues.js` | **Medium** | New; only clears known keys on controller change. |
| `src/lib/willToolDebug.js` | **Low** | Central debug gate; no business logic. |
| `src/lib/willSessions.js`, `matters.js`, `supabase.js` | **Low** | Logging only; no RPC signature changes. |
| `.env` deleted from git | **Ops** | Correct for security; requires key rotation if ever pushed. |
| Guided components / `BookAppointmentModal` | **Low** | ESLint-only (unused params). |
| Docs only | **None** | No runtime effect. |

---

## 4. Manual Smoke Test Results

**Status:** **Not executed in this verification pass** (requires browser, Supabase env, and time). Use staging after deploy.

| Check | Result | Notes |
|-------|--------|-------|
| Open public intake route | **Not run** | |
| Complete basic client journey | **Not run** | |
| Next/back navigation | **Not run** | |
| Required fields block Next | **Not run** | |
| Save draft | **Not run** | |
| Copy resume link | **Not run** | |
| Resume link in incognito | **Not run** | |
| Refresh mid-form | **Not run** | |

### High-risk branch regression (automated partial)

| Flow | Automated | Manual browser |
|------|-----------|----------------|
| Executors — change answer, stale data | Unit test: executor arrays cleared | **Not run** |
| Guardians — Yes → No | Unit test: `guardianshipDetailsData` cleared | **Not run** |
| Residue — FLIT → AsShares | Unit test: `lifeTenantDetails` cleared | **Not run** |
| Property trust — Yes → No | Unit test: `propertyTrustDetails` cleared | **Not run** |
| Exclusions — Yes → No | Unit test: `excludedPersonData` cleared | **Not run** |

---

## 5. PDF Verification

### Automated / static

| Check | Result | Evidence |
|-------|--------|----------|
| Client PDF generates (smoke) | **Pass** | `PDFGeneratorJSPDF.artifact.test.js` |
| Contains “INTAKE ONLY” (client mode, empty payload) | **Pass** | Binary string search on `artifacts/verify-pdf-from-source.pdf` |
| No `[Office Address]` in source | **Pass** | `grep` — only in test asserting absence |
| Aristone canonical address helper | **Pass** | `aristoneSolicitors.test.js` |
| No `identityVerification` in PDF generator | **Pass** | `grep` PDFGeneratorJSPDF.js — no matches |
| Client PDF omits witness attestation block | **Pass (code)** | `if (!isClientPDF)` wraps witness section (~line 4144) |
| Client PDF limits clauses by section index | **Pass (code)** | `maxSectionIndex: CLIENT_VISIBLE_MAX_SECTION_INDEX` when `isClientPDF` |
| No “We confirm this Will was signed…” in empty client artifact | **Pass** | String search false on client artifact |

### Manual (required on staging)

| Check | Result |
|-------|--------|
| Filled client PDF — no Testamentary Capacity wording | **Not run** |
| No solicitor-only notes in client PDF | **Not run** |
| No obvious placeholders in real data PDF | **Not run** |
| Solicitor execution PDF — testator + 2 witness areas | **Not run** |
| Aristone address appears when professional executor selected | **Not run** (unit test covers helper only) |

---

## 6. Solicitor Portal Verification

**Not run** (needs Microsoft auth + Supabase staff user).

| Check | Result |
|-------|--------|
| Login route (`/celista-login`) | **Not run** |
| Matter dashboard loads | **Not run** |
| Matter detail loads | **Not run** |
| Testamentary Capacity quick action | **Not run** |
| Solicitor execution PDF | **Not run** |
| Solicitor notes absent from client PDF | **Not run** (code paths unchanged in this commit beyond logging) |

---

## 7. Remaining Warnings

**25 ESLint warnings, 0 errors.** None were introduced as errors in Phase 1.

| Category | Count | Block staging? |
|----------|-------|----------------|
| `react-refresh/only-export-components` | 10 | **No** — pre-existing pattern |
| `react-hooks/exhaustive-deps` | 13 | **No** — pre-existing; includes new `setFormValues` warnings in FormRenderer |
| Unused `eslint-disable` | 2 | **No** |

**New warnings tied to Phase 1:** FormRenderer now reports `setFormValues` missing from some `useEffect` dependency arrays (5 warnings). These are **consistent with wrapping `setFormValues` in `useCallback`** and are unlikely to block staging, but worth watching if odd re-fetch behaviour appears.

---

## 8. Blockers

### Code / CI blockers

**None identified** from automated verification.

### Staging / release blockers (process)

1. **Human browser QA** on staging (client journey, resume link, iframe, solicitor login).
2. **Rotate Supabase/Vercel keys** if `.env` was ever in remote git history.
3. **Mariyam sign-off** on ID storage in matter payload (documented in Phase 1).
4. **Vercel env:** confirm `VITE_SHOW_CLIENT_AUTOFILL` and `VITE_DEBUG_WILL_TOOL` are **unset/false** on preview/production.
5. **Six sample PDFs** + legal wording review (from original audit).

### Non-blockers for staging deploy

- 25 lint warnings  
- Bundle size warning on build  
- Session TTL / rate limits (Phase 2)

---

## 9. Recommendation

### **Safe to deploy to staging**

Deploy `phase1-hardening-before-qa` to a **Vercel preview/staging** environment only. Run the manual checklist in §4–§6 on staging (including WordPress iframe at 375px). Do **not** treat this as approval for production or live client traffic until staging QA and Mariyam/legal review complete.

**Not recommended:** skip staging, or assume Phase 1 replaced manual QA.

**Not indicated:** rollback — no failing tests or build breaks found.

---

## Production safety (static verification)

| Check | Result |
|-------|--------|
| `VITE_SHOW_CLIENT_AUTOFILL` default off | **Pass** — only `DEV` or explicit `=== 'true'` |
| `VITE_DEBUG_WILL_TOOL` default off | **Pass** — `willToolDebug.js` |
| `.env` gitignored | **Pass** |
| `willSessions.js` — no raw `console.log` | **Pass** |
| `matters.js` — no raw `console.log` | **Pass** |
| `FormRenderer.jsx` — no raw `console.log` | **Pass** (uses `debugLog`) |
| PDF debug logs gated | **Pass** — `pdfDebugLog` / `pdfDebugEnabled()` |
| Cloud draft excludes identity | **Pass** — `formPayload.test.js` |
| Identity upload client copy | **Pass (code)** — `IdentityVerification.jsx` |
| Resume link warning | **Pass (code)** — FormRenderer amber banner |
| iframe “Open in full tab” | **Pass (code)** — when `window.self !== window.top` |

---

*End of regression verification — no application code modified during this pass.*
