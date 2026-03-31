# Mariyam Format-Only Action Plan

This document is **formatting and content structure only**. **PDF rendering is frozen**: no changes to layout, margins, wrapping, clipping, fonts, page breaks, or drawing/token layout code unless this file explicitly allows **string output** shaping elsewhere.

**Evidence base:** `src/utils/excludedPersonFormat.js`, `src/utils/personRecordSpecs.js`, `src/data/Complete-WillSuite-Form-Data.json`, `src/utils/buildClauses.js`, `src/components/FormRenderer.jsx`, `src/components/PDFGeneratorJSPDF.js` (interpolation + **text** normalization only—not `drawSegmentAwareClauseLines` / `layoutSegmentAwareLines`).

---

## 1. Accepted / Frozen

The following are **accepted as-is** and **must not be revisited** for this initiative:

| Area | Location (do not edit for layout) |
|------|-------------------------------------|
| Clause line drawing | `drawSegmentAwareClauseLines`, `layoutSegmentAwareLines`, `measureClauseTokenMm`, `tokenizeMarkedString`, `flattenToWordTokens` in `PDFGeneratorJSPDF.js` |
| Column width / safety mm | `CLAUSE_COLUMN_SAFETY_MM`, `getEffectiveTextWidth`, `PDF_*_FUDGE_MM` usage tied to drawable width |
| Page breaks inside generator | `checkPageBreak`, `addPage`, execution page layout blocks |
| Bold marker wrapping for output | `wrapClientValue` behaviour as wired into draw (markers stay; **do not** change draw path) |

**Allowed without violating the freeze:** functions that only change **the string** of a clause before it is passed to the frozen renderer (e.g. extending `normalizeClauseText` / `finalizeClauseTextForPdf`, or **shaping data** in `formatExcludedPersonForClause` / save-time `pickPersonFieldsForModal`). Those are **content/format** changes, not geometry.

---

## 2. Remaining Formatting Issues

### 2.1 Issue: Executor / trustee appointment lines — structured rows vs legacy strings

| Item | Detail |
|------|--------|
| **Status** | **Partially done** |
| **Files** | `src/utils/excludedPersonFormat.js`, `src/components/FormRenderer.jsx`, `src/components/PDFGeneratorJSPDF.js` (interpolation branches for `personSectionFullDetailsIds`) |
| **Field IDs** | `executorData`, `substituteExecutorData`, `trusteeData`, `substituteTrusteeData`, `digitalExecutorData`, `digitalExecutorIfNoData`, `separateTrusteeData`, etc. (any `*:fullDetails` using `formatExcludedPersonForClause`) |
| **Functions** | `formatExcludedPersonForClause`, `formatPersonRecordForClause` |
| **Current output format** | **Objects:** `Title Forename … Surname of addr1, addr2, town, POSTCODE` (comma-separated address; Bedfordshire typo fix). **Strings:** returned **verbatim** (`excludedPersonFormat.js` lines 8–9). |
| **Desired output format** | Mariyam example: *“Mrs Kate Paul of 50 Napier Road, Luton, Bedfordshire, LU1 1RG”* — clean legal line, **no** IDs, autofill provenance, or internal metadata. |
| **Precise fix needed** | (1) On load/save, normalize array entries through `pickPersonFieldsForModal` or strip unknown keys before persistence. (2) For **string** entries, either parse into structured line or reject/split to a **short** legal-style line (product rule). (3) Optionally expand county/typo fixes beyond `Bedforshire` if data shows other systematic misspellings. |

---

### 2.2 Issue: Professional executor “Other” — free-text blob in Will

| Item | Detail |
|------|--------|
| **Status** | **Partially done** |
| **Files** | `PDFGeneratorJSPDF.js` (~1532–1548), `FormRenderer.jsx` (mirror logic for preview), `Complete-WillSuite-Form-Data.json` (labels/placeholders for `professionalExecutorOtherDetails`, `substituteProfessionalExecutorOtherDetails`) |
| **Field IDs** | `professionalExecutorSelection`, `professionalExecutorOtherDetails`, `substituteProfessionalExecutorSelection`, `substituteProfessionalExecutorOtherDetails` |
| **Functions** | `interpolateText` / PDF `interpolateText` — `professionalExecutorSelection` + `fullDetails` |
| **Current output format** | If `selectionValue === 'Other'`, **entire** `*OtherDetails` string is wrapped and inserted (`trim()` only). Placeholder in JSON invites “firm name, address, and **contact details**”. |
| **Desired output format** | Same *style* as individual appointments: firm name + single professional address line, **no** email/phone clutter if Mariyam requires minimal wording. |
| **Precise fix needed** | **Data-shaping + copy:** structured fields or parsing rules for “Other” professional executor; **or** tighten placeholder + post-process strip (phone/email patterns) **in text formatter only**—not PDF layout. |

---

### 2.3 Issue: Aristone firm string consistency

| Item | Detail |
|------|--------|
| **Status** | **Partially done** (inconsistent wording, not “wrong” if intentional) |
| **Files** | `PDFGeneratorJSPDF.js` (~1204–1208 executorsSection; ~1538–1539 `professionalExecutorSelection`); JSON `willClauseText` / option `fullDetails` for Aristone |
| **Field IDs** | `chooseAristoneExecutor`, `chooseAristoneSubstituteExecutor`, `professionalExecutorSelection`, … |
| **Functions** | `getCanonicalFirmName()`, `wrapClientValue`, Aristone branches in interpolation |
| **Current output format** | Multiple variants: e.g. “Aristone Limited (trading as Aristone Solicitors), SRA No. …” vs shorter `getCanonicalFirmName()` + SRA line depending on branch. |
| **Desired output format** | Single **approved** firm line for all Aristone appointments (Mariyam/legal to sign off). |
| **Precise fix needed** | Centralize one canonical Aristone appointment string in code or JSON; use everywhere `fullDetails` is resolved for Aristone. **Formatting/content only.** |

---

### 2.4 Issue: Digital Executor clause — length and “No” branch wording

| Item | Detail |
|------|--------|
| **Status** | **Partially done** |
| **Files** | `Complete-WillSuite-Form-Data.json` (`digitalExecutorsSection`, `digitalExecutorIfNoSection` `willClauseText`) |
| **Field IDs** | `appointDigitalAssetsExecutor`, `appointSeparateDigitalExecutor`, `digitalExecutorData`, `digitalExecutorIfNoData` |
| **Functions** | `formatExcludedPersonForClause` for `fullDetails`; same template for both branches |
| **Current output format** | *“I appoint [person] solely for the purpose of dealing with my digital assets, including accessing, managing, and distributing these assets according to my wishes.”* Person line matches other appointments **if** data is structured; **strings** pass through. |
| **Desired output format** | Mariyam: follow-up when “No” must not be “ugly or over-detailed” — likely **shorter** statutory-style appointment or shorter subordinate clause (legal review). |
| **Precise fix needed** | **JSON / legal copy:** shorten or split `willClauseText` for digital executor (both branches) after lawyer approval; **no** layout engine change. Optionally separate template for `digitalExecutorIfNoSection` vs `digitalExecutorsSection` if the firm wants different weight. |

---

### 2.5 Issue: Estate Overview — exclusion from Will/PDF **content**

| Item | Detail |
|------|--------|
| **Status** | **Done** (for clause/PDF **body** text) |
| **Files** | `Complete-WillSuite-Form-Data.json` (Estate Overview fields), `buildClauses.js` (~322, ~499), `clientMode.js` (`SOLICITOR_INTAKE_ONLY_FIELD_IDS`), `FormRenderer.jsx` (`visibleSections`) |
| **Field IDs** | `estateAssetTypes`, `estateLiabilityTypes`, `estateGrossValueRange`, `estateLiabilityValueRange`, `estatePropertyValueRange`, `estateAdditionalNotes`, `estateAssetOther`, `aristoneProfessionalFeesAck`, … |
| **Functions** | `buildClauses` skip when `excludeFromWill`; no `willClauseText` on these fields |
| **Current output format** | Values do **not** become will clauses; not interpolated into clause templates via schema. |
| **Desired output format** | Must never appear as will text — **satisfied** by schema + builder. |
| **Precise fix needed** | None for body clauses. **Optional:** audit **validation appendix** strings in `PDFGeneratorJSPDF.js` if Mariyam objects to **any** internal labels on PDFs (separate from Will text). |

---

### 2.6 Issue: Malformed / duplicated **clause** phrasing (content-level)

| Item | Detail |
|------|--------|
| **Status** | **Partially done** |
| **Files** | `PDFGeneratorJSPDF.js` — `normalizeClauseText` (~132–254), `finalizeClauseTextForPdf` / `finalizeClauseTextForPdfPass` (~267–300) |
| **Field IDs** | N/A (applies to interpolated clause strings globally) |
| **Functions** | `normalizeClauseText`, `finalizeClauseTextForPdf`, `sanitizeUnprofessionalContent` (where used in pipeline) |
| **Current output format** | Regex passes reduce: double periods, duplicate “of my net estate”, failed-share lead-ins like *“I give the failed share to If any…”*, etc. |
| **Desired output format** | No duplicated fragments, no awkward failed-share glue, clean punctuation. |
| **Precise fix needed** | Add **content-only** rules (same layer as `finalizeClauseTextForPdf`) when new bad patterns appear from templates/interpolation—**do not** touch draw/layout. |

---

### Implementation checklist (categories)

**Safe to leave as-is**

- Estate Overview: `excludeFromWill` + `buildClauses` skipping + solicitor/client visibility rules.
- Structured `formatExcludedPersonForClause` output shape (title + name + “ of ” + address) for **object** rows.
- PDF drawing pipeline (frozen).

**Needs formatting cleanup**

- Legacy **string** rows in person arrays (executors, digital executor, etc.).
- Professional executor **Other** free-text (`professionalExecutorOtherDetails`) as inserted into clauses.
- Stale doc `docs/MARIYAM-PDF-FIXES-SUMMARY.md` (claims `renderTextWithBoldSegments` — wrong for current `src/`).

**Needs wording cleanup**

- Digital executor `willClauseText` templates (verbosity; possibly branch-specific copy).
- Aristone canonical line unification across branches.
- Any new template text that produces duplicate lead-ins (address in `normalizeClauseText` / `finalizeClauseTextForPdf`).

**Needs data-shaping cleanup before interpolation**

- Persist only `pickPersonFieldsForModal`-compatible keys (or normalize at save) so stored objects cannot carry hidden fields that might be stringified elsewhere.
- “Other” professional executor: structured capture vs raw blob.

**Do not touch**

- `drawSegmentAwareClauseLines`, `layoutSegmentAwareLines`, `measureClauseTokenMm`, page-break geometry, margins, column safety constants for drawing.

---

## 3. Requirement-by-Requirement Format Check

### A. Executor appointment wording — clean legal line only

| Check | Result |
|-------|--------|
| **Status** | **Partially done** |
| **Evidence** | `formatExcludedPersonForClause` uses only name + address fields (`excludedPersonFormat.js`). Interpolation uses it for `executorsSection:fullDetails` (`FormRenderer.jsx` / `PDFGeneratorJSPDF.js` ~1220–1235). |
| **Gap** | **Strings** in arrays are unfiltered. **Other** professional path inserts raw `*OtherDetails`. Aristone strings vary by code path. |
| **Fix type** | Data-shaping + optional text normalization **outside** PDF layout. |

### B. Estate Overview — solicitor-only; excluded from Will/PDF content

| Check | Result |
|-------|--------|
| **Status** | **Done** |
| **Evidence** | All listed fields `excludeFromWill: true`; `buildClauses.js` returns early; section `_solicitorIntakeOnly`; client UI hides section except solicitor + Aristone rule (`FormRenderer.jsx`). |
| **Gap** | None for will clause text. Appendix reporting is out-of-scope for “Will text” but may matter for Mariyam’s PDF expectations. |

### C. Digital Executor “No” path — avoid ugly / over-detailed Will wording

| Check | Result |
|-------|--------|
| **Status** | **Partially done** |
| **Evidence** | Same long `willClauseText` for `digitalExecutorIfNoSection` as parallel branch (`Complete-WillSuite-Form-Data.json` ~850). Person formatting matches other `fullDetails` when data is structured. |
| **Gap** | Template is **long**; string rows bypass structured formatting. |
| **Fix type** | **Wording** (`willClauseText`) + data-shaping for stored people. |

### D. Bad content-formatting phrases (duplicates, punctuation, failed-share, fragments)

| Check | Result |
|-------|--------|
| **Status** | **Partially done** |
| **Evidence** | `normalizeClauseText` + `finalizeClauseTextForPdfPass` target duplicates, periods, failed-share, “of my net estate” duplication (`PDFGeneratorJSPDF.js`). |
| **Gap** | Cannot prove **all** future template combinations are covered; new patterns need new **string** rules. |
| **Fix type** | Extend **normalization/finalize** only (not layout). |

---

## 4. File and Field Map

| Concern | Primary files | Key field / section IDs | Notes |
|---------|---------------|---------------------------|--------|
| Person line shape | `excludedPersonFormat.js`, `personRecordSpecs.js` | Any `*Data` arrays used with `:fullDetails` | Objects → clean line; strings → raw |
| Executor clauses | `Complete-WillSuite-Form-Data.json` | `executorsSection`, `executorData`, `chooseAristoneExecutor` | Template uses `{{field:executorsSection:fullDetails}}` |
| Professional Other | `Complete-WillSuite-Form-Data.json`, `PDFGeneratorJSPDF.js` | `professionalExecutorSelection`, `professionalExecutorOtherDetails` | Other → free text into Will |
| Digital executor | `Complete-WillSuite-Form-Data.json` | `digitalExecutorsSection`, `digitalExecutorIfNoSection`, `digitalExecutorData`, `digitalExecutorIfNoData`, `appointDigitalAssetsExecutor` | Same template string both branches |
| Estate Overview | `Complete-WillSuite-Form-Data.json`, `buildClauses.js` | `estate*` fields, `Estate Overview (Optional)` | No will clauses |
| Clause text cleanup | `PDFGeneratorJSPDF.js` | (clause strings) | `normalizeClauseText`, `finalizeClauseTextForPdf` |

---

## 5. Recommended Format-Only Fix Order

1. **Unify Aristone appointment string** (single source of truth) — content consistency, no layout change.  
2. **Professional executor “Other”** — product/legal decision: structured fields or sanitize/strip contact noise from free text **before** interpolation.  
3. **Legacy string rows** in person arrays — normalize or reject at save / at `formatExcludedPersonForClause` input.  
4. **Digital executor `willClauseText`** — shorter approved wording; optionally different text for If-No branch.  
5. **Extend `finalizeClauseTextForPdf` / `normalizeClauseText`** only when new bad **strings** are observed (template bugs).  
6. **Docs** — fix `MARIYAM-PDF-FIXES-SUMMARY.md` inaccurate bold/renderer claim (housekeeping).  
7. **Optional** — validation appendix human-readable labels (if Mariyam objects); not Will clause text.

---

## 6. Do Not Touch

- **`drawSegmentAwareClauseLines`**, **`layoutSegmentAwareLines`**, **`measureClauseTokenMm`**, **`tokenizeMarkedString`**, **`flattenToWordTokens`** — PDF line breaking and drawing.  
- **Page geometry**: margins, `CLAUSE_COLUMN_SAFETY_MM`, `getEffectiveTextWidth` **as used for layout width**.  
- **Font size / line height** for clause rendering (except if product changes **global** typographic spec later—out of scope here).  
- **html2canvas** / non-jsPDF paths if unrelated to clause **wording**.

**May touch (format-only):** `normalizeClauseText`, `finalizeClauseTextForPdf`, `formatExcludedPersonForClause`, JSON `willClauseText`, interpolation branches that only change **returned strings**, `pickPersonFieldsForModal` usage at save.

---

## 7. Final Verdict

- **Estate Overview** is **correctly excluded** from will clause building and uses solicitor-only visibility flags; **no format work required** for keeping it out of Will/PDF **body** text.  
- **Clean appointment lines** are **reliable for structured modal rows**; **not reliable** for legacy strings or **Other** professional free-text.  
- **Digital executor** copy is **functionally wired** but **wording may be too long** for Mariyam’s taste—address with **template/copy**, not PDF engine.  
- **Clause-level bad phrases** are **partially mitigated** by existing normalizers; **new issues** should get **string-level** fixes only.  
- **PDF rendering/layout is frozen**; all remaining Mariyam items in this plan are **content, data shaping, and legal wording**.

---

*Document reflects static review of the codebase; it does not re-audit PDF pixel-level output.*
