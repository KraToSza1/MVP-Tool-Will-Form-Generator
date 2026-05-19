# Mariyam Will Tool Phase 1 Hardening Report

**Date:** 18 May 2026  
**Scope:** Phase 1 “Must Fix Before Live Use” from `docs/MARIYAM_WILL_TOOL_MVP_FULL_AUDIT_2026-05-18.md`

---

## 1. Summary

Phase 1 hardening focused on **security hygiene**, **production logging**, **PDF placeholder fix**, **developer tooling**, **honest ID privacy documentation**, **resume-link warnings**, **targeted stale-field pruning**, and **iframe QA guidance** — without large refactors or new Phase 2 features.

The app **builds successfully**, **`npm test` runs 58 unit tests**, and **ESLint reports 0 errors** (warnings remain, mostly pre-existing hook/export noise).

`.env` was **removed from git tracking** (local file kept). **You must still rotate Supabase/Vercel keys manually** if `.env` was ever pushed to a remote.

---

## 2. Files Changed

| File | Why |
|------|-----|
| `.gitignore` | Ignore `.env` and variants |
| `docs/ENV_AND_SECRETS.md` | Where secrets live; rotation steps |
| `docs/IDENTITY_VERIFICATION_STORAGE.md` | Accurate storage matrix + future Storage TODO |
| `docs/PHASE2_PERSISTENCE.md` | Identity section updated (not “local only” on submit) |
| `docs/FLOW_LOGGING.md` | Production logging gate documented |
| `docs/SESSION_RESUME_LINKS.md` | Resume-link risk + TTL follow-up |
| `docs/WORDPRESS_ELEMENTOR_EMBED.md` | Mobile/iframe QA checklist |
| `package.json` | `npm test` → `vitest run src` |
| `.env.example` | Stronger autofill/debug warnings |
| `src/lib/willToolDebug.js` | **New** — gated `debugLog` / `flowLog` |
| `src/utils/pruneStaleBranchValues.js` | **New** — branch pruning helper |
| `src/utils/pruneStaleBranchValues.test.js` | **New** — 6 regression tests |
| `src/constants/aristoneSolicitors.js` | `getAristoneProfessionalExecutorOptions()` |
| `src/constants/aristoneSolicitors.test.js` | **New** — address not placeholder |
| `src/components/PDFGeneratorJSPDF.js` | Real firm address; `pdfDebugLog` for debug lines |
| `src/components/FormRenderer.jsx` | Pruning wrapper; gated logs; share warning; iframe link |
| `src/lib/willSessions.js` | Gated flow logs; sanitized refs |
| `src/lib/matters.js` | Gated flow logs; no payload size logs |
| `src/lib/supabase.js` | Gated client-created log |
| `src/components/IdentityVerification.jsx` | Client-facing privacy sentence |
| Guided components (5) | ESLint: remove unused `field` param |
| `BookAppointmentModal.jsx` | ESLint: remove unused `matterId` |
| `src/lib/portalBrowserFreshStart.js` | ESLint: `themeBackup` assignment |

**Git only (not file content):** `git rm --cached .env` — stops tracking `.env`; your local `.env` is unchanged.

---

## 3. Phase 1 Items Completed

| Item | Status | Notes |
|------|--------|-------|
| Secrets / `.env` | ✅ | `.gitignore` + `docs/ENV_AND_SECRETS.md` + untracked `.env` |
| PDF firm address | ✅ | Uses `ARISTONE_PROFILE.autoPopulateData`; test added |
| Production logging | ✅ | `willToolDebug.js`; PDF/FormRenderer/sessions/matters/supabase gated |
| ESLint | ✅ | **0 errors** (25 warnings, mostly pre-existing) |
| `npm test` | ✅ | Points to `vitest run src` |
| ID privacy docs | ✅ | Docs + in-form sentence; Storage bucket TODO |
| Session link warning | ✅ | UI copy + `docs/SESSION_RESUME_LINKS.md` (no TTL — see §4) |
| Stale answer pruning | ✅ | 5 branches + 6 tests; wired via `setFormValues` wrapper |
| WordPress/mobile QA | ✅ | Checklist in embed doc; “Open in full tab” when iframe |
| Autofill production guard | ✅ | Already gated; `.env.example` reinforced |

---

## 4. Items Not Fully Completed

| Item | Reason |
|------|--------|
| **Session TTL / rate limits** | Would break existing resume URLs without product approval. Documented in `docs/SESSION_RESUME_LINKS.md` for Phase 2+. |
| **`frame-ancestors` restriction** | Aristone production domain not confirmed in this pass. Still `*` in `vercel.json`. |
| **Dedicated ID Storage bucket** | Policy/architecture change — documented as future work only. |
| **Exhaustive stale-field pruning** | Only 5 high-risk controllers; other branches may still retain hidden values. |
| **All `console.warn` in production** | Some warnings (e.g. Supabase missing env) remain intentional for operators. |
| **Live WordPress QA** | Checklist added; must be run by humans on staging. |

---

## 5. Manual Actions Required

1. **Rotate Supabase and Vercel keys** if `.env` was ever committed or shared (`docs/ENV_AND_SECRETS.md`).
2. **Commit the `.gitignore` change** and confirm `.env` is not in the next commit: `git status` should not list `.env` as tracked.
3. **Confirm with Mariyam / Aristone** that storing compressed ID images in `matters.client_payload` is acceptable; align privacy notice on the website.
4. **Confirm Aristone domain(s)** before tightening `frame-ancestors` in `vercel.json`.
5. **Run the WordPress iframe QA checklist** on staging (`docs/WORDPRESS_ELEMENTOR_EMBED.md`) at 375px on iOS Safari and Android Chrome.
6. **Verify Vercel production** does not set `VITE_SHOW_CLIENT_AUTOFILL=true` or `VITE_DEBUG_WILL_TOOL=true`.

---

## 6. Test Results

Commands run on 18 May 2026:

### `npm run lint`

```
✖ 25 problems (0 errors, 25 warnings)
```

Exit code: **0** (no ESLint errors).

### `npm test`

```
Test Files  8 passed (8)
     Tests  58 passed (58)
```

Exit code: **0**

### `npm run test:unit`

Same as `npm test` (identical script target).

### `npm run build`

```
✓ built in ~800ms
```

Exit code: **0** (chunk size warning only).

---

## 7. Remaining Risks

- **Resume links** remain bearer-token style (`ref` + `s`) with no expiry until Phase 2.
- **ID images** in matter JSONB until separate Storage + retention is built.
- **Hidden field values** outside the five pruned branches may still exist in `formValues` / localStorage.
- **Large bundle** (~1.8 MB main chunk) — mobile load time in iframe.
- **Legal review** of sample PDFs still required before client-facing use.
- **Git history** may still contain old `.env` if it was committed previously — rotation + history review recommended.

---

## 8. Recommended Next Phase

After Phase 1 is signed off on staging:

1. **Phase 2 polish:** Matter dashboard summary, client completion review, PDF review UI for solicitors.
2. **Session security:** TTL, rate limiting, optional email verification for resume.
3. **ID storage:** Supabase Storage bucket, retention job, staff access audit.
4. **CI:** GitHub Action running `lint` + `test` + `build` on PRs.
5. **Expand pruning/tests** for additional conditional branches (business interests, pets, etc.).
6. **Restrict `frame-ancestors`** to Aristone domains once confirmed.

---

*End of Phase 1 hardening report.*
