# Mariyam Requirements Audit

## 1. Executive Summary

This audit compares the **current** Will Tool codebase (React form schema, `FormRenderer.jsx`, `FieldRenderer.jsx`, `buildClauses.js`, `PDFGeneratorJSPDF.js`, `clientMode.js`, and `Complete-WillSuite-Form-Data.json`) to Mariyam Ferreira / Aristone Solicitors requirements described in the user request. **No production behavior was executed** beyond what is inferable from static code paths; **visual PDF output** (e.g. right-edge clipping) is **not proven** here.

**Status counts (primary-scope requirement groups):**

| Status        | Count |
|---------------|-------|
| Done          | 2     |
| Partially done| 2     |
| Not done      | 0     |
| Broken        | 1     |
| Unverified    | 1     |

*(Groups: Estate Overview block; Digital Executor branch; Clean executor PDF wording; Solicitor-only exclusion; PDF rendering/quality.)*

---

## 2. Audit Scope

### What was audited

- **Form schema**: `src/data/Complete-WillSuite-Form-Data.json` (Estate Overview fields, Executors/Digital Executor fields, `excludeFromWill`, `_solicitorIntakeOnly`, conditions).
- **Client vs solicitor visibility**: `src/constants/clientMode.js`, `src/components/FormRenderer.jsx` (`visibleSections`, effects for estate liabilities).
- **Checkbox behaviour (liabilities)**: `src/components/FieldRenderer.jsx` (`estateLiabilityTypes`).
- **Clause building / Will text**: `src/utils/buildClauses.js` (`excludeFromWill` handling, `maxSectionIndex`).
- **Interpolation / PDF**: `src/components/PDFGeneratorJSPDF.js` (`interpolateText` / `fullDetails`, `normalizeClauseText`, `finalizeClauseTextForPdf`, numbered clause rendering via `layoutSegmentAwareLines` / `drawSegmentAwareClauseLines`), `src/components/FormRenderer.jsx` (parallel interpolate logic for preview).
- **Person line formatting**: `src/utils/excludedPersonFormat.js`, `src/utils/personRecordSpecs.js`.
- **Existing docs**: `docs/MARIYAM-PDF-FIXES-SUMMARY.md` (cross-check for stale claims).

### What was not audited

- **Runtime** browser sessions, **live** Supabase payloads, or **actual** PDF bytes from a full user journey.
- **Legal accuracy** of will clauses (lawyer sign-off).
- **WordPress embed** behaviour outside this repo’s source.
- **Automated visual regression** of PDFs.

---

## 3. Requirement-by-Requirement Findings

### Requirement: Estate Overview conditional solicitor-only section

- **Status:** Done (with **Unverified** on end-to-end PDF spot-check only)

- **Requirement summary**: Section “Estate Overview (Optional)” only when Aristone is executor; visible to solicitor, not client; not in Will / Will PDF; specific steps (asset types, liabilities, ranges, property value if property, notes) and cross-field rules.

- **What exists now**:
  - Section title matches: `"formSection": "Estate Overview (Optional)"` with `"_solicitorIntakeOnly": true` in `Complete-WillSuite-Form-Data.json` (approx. lines 1122–1257).
  - Intro display field `estateOverviewIntro` with the required intro copy; all listed asset options (`estateAssetTypes`), liability options (`estateLiabilityTypes`), gross value (`estateGrossValueRange`), liability value (`estateLiabilityValueRange`), property value (`estatePropertyValueRange` with conditions on `PropertyUK` / `PropertyOverseas`), notes (`estateAdditionalNotes`). Conditional `estateAssetOther` when `Other` selected (`conditions` on `estateAssetTypes` includes `Other`).
  - **Solicitor-only visibility when Aristone executor**: `FormRenderer.jsx` `visibleSections` — if `solicitorMode`, section `SOLICITOR_INTAKE_ONLY_SECTION_TITLE` (`clientMode.js`: `"Estate Overview (Optional)"`) is shown only when `chooseAristoneExecutor === 'Aristone'` OR (`appointProfessionalExecutor === 'Yes'` AND `professionalExecutorSelection === 'Aristone'`). Evidence: `FormRenderer.jsx` lines ~286–312.
  - **Client mode**: same `visibleSections` excludes Estate Overview entirely for non-solicitor (filters out `SOLICITOR_INTAKE_ONLY_SECTION_TITLE`). Evidence: `FormRenderer.jsx` ~288–297.
  - **Not in Will clauses**: every Estate Overview field in the JSON snippet carries `"excludeFromWill": true` (and display-only fields similarly). `buildClauses.js` skips fields where `field.excludeFromWill` (lines ~322, 499). So **no clause text** is built from these fields.
  - **Liability mutual exclusion**: `FieldRenderer.jsx` — selecting `NoLiabilities` clears other selections; other options disabled when `NoLiabilities` selected; checking `NoLiabilities` sets `estateLiabilityValueRange` to `'None'` (lines ~690–756, ~753–755). `FormRenderer.jsx` effect also syncs `estateLiabilityValueRange` to `'None'` when `NoLiabilities` is in `estateLiabilityTypes` (lines ~330–338).
  - **Field IDs for stripping / client autofill**: `SOLICITOR_INTAKE_ONLY_FIELD_IDS` in `clientMode.js` (lines 14–25) lists the estate fields for client-side handling.

- **Evidence**
  - **Files**: `src/data/Complete-WillSuite-Form-Data.json`, `src/components/FormRenderer.jsx`, `src/components/FieldRenderer.jsx`, `src/utils/buildClauses.js`, `src/constants/clientMode.js`.

- **Gaps / risks**
  - **Indexed section slice**: Client PDF uses `maxSectionIndex: CLIENT_VISIBLE_MAX_SECTION_INDEX` (`PDFGeneratorJSPDF.js` ~2354). That slice **includes** the Estate Overview **section index** in the array, but **fields** are skipped by `excludeFromWill`, so **no** will clauses should be emitted. Risk is low; verified by code path, not by binary PDF inspection here.

- **Recommended fix**: None for logic; optional **integration test** asserting no `willClauseText` is produced from `estate*` field IDs.

- **Priority**: Low

---

### Requirement: Digital Executor follow-up when “No” selected

- **Status:** Done

- **Requirement summary**: If user declines authorising executors for digital assets (`appointDigitalAssetsExecutor === "No"`), a follow-up should capture who to appoint as digital executor.

- **What exists now**
  - **Trigger**: `appointDigitalAssetsExecutor` radio — options `"No"` / `"Yes"` in `Complete-WillSuite-Form-Data.json` (~790–797).
  - **Follow-up section**: `digitalExecutorIfNoSection` — label “Who should be appointed to deal with your digital assets?”, `conditions`: `appointDigitalAssetsExecutor` `eq` `"No"` (~846–853). Subfield hidden array `digitalExecutorIfNoData` (~867–869). **Will clause**: `willClauseText` interpolates `{{field:digitalExecutorIfNoSection:fullDetails}}` (~850).
  - **When “Yes” + separate digital executors**: `digitalExecutorsSection` with `digitalExecutorData` under `AND` of `appointDigitalAssetsExecutor === "Yes"` and `appointSeparateDigitalExecutor === "Yes"` (~813–824).
  - **Interpolation / PDF**: `personSectionFullDetailsIds` includes `digitalExecutorIfNoSection` and `digitalExecutorsSection`; data keys `digitalExecutorIfNoData` / `digitalExecutorData` via `fallbackMap` in both `FormRenderer.jsx` (~774–788) and `PDFGeneratorJSPDF.js` (~1220–1235). Formatting uses `formatExcludedPersonForClause` (same as other person rows).
  - **buildClauses**: mappings `digitalExecutorIfNoSection` → `digitalExecutorIfNoData` in `buildClauses.js` (~124–126).

- **Evidence**
  - **Field IDs**: `appointDigitalAssetsExecutor`, `appointSeparateDigitalExecutor`, `digitalExecutorsSection`, `digitalExecutorData`, `digitalExecutorIfNoSection`, `digitalExecutorIfNoData`.
  - **Files**: `src/data/Complete-WillSuite-Form-Data.json`, `src/utils/buildClauses.js`, `src/components/FormRenderer.jsx`, `src/components/PDFGeneratorJSPDF.js`.

- **Gaps / risks**
  - If `appointDigitalAssetsExecutor` is `"No"` but **no** person is added, `fullDetails` resolves empty string in PDF path (`PDFGeneratorJSPDF.js` ~1231–1235) — clause may be empty or validation elsewhere; **not traced** in this audit.

- **Recommended fix**: Confirm product rule: block PDF or show `[MISSING]` when `No` but `digitalExecutorIfNoData` empty.

- **Priority**: Medium (UX/completeness)

---

### Requirement: Clean PDF executor wording (“Mrs Kate Paul…” only)

- **Status:** Partially done

- **Requirement summary**: Will PDF should not include extra intake metadata; appointment lines should read like clean legal wording, e.g. “Mrs Kate Paul of 50 Napier Road, Luton, Bedfordshire, LU1 1RG to be the…”.

- **What exists now**
  - **Executor clause template**: `executorsSection` `willClauseText` includes `{{field:executorsSection:fullDetails}}` (`Complete-WillSuite-Form-Data.json` ~574–577).
  - **Individual executors (array of objects)**: `fullDetails` for `executorsSection` uses `formatExcludedPersonForClause` in both `FormRenderer.jsx` (~782–787) and `PDFGeneratorJSPDF.js` (~1228–1233). `formatExcludedPersonForClause` (`excludedPersonFormat.js`) builds **title + name + “ of ” + address lines + postcode** only; **no email/phone/DOB** in that function. County typo `Bedforshire` → `Bedfordshire` is corrected in that helper (~13–14).
  - **Aristone professional path**: When `chooseAristoneExecutor === 'Aristone'`, PDF returns a **long fixed string** including SRA number and full office address (`PDFGeneratorJSPDF.js` ~1204–1208) — **not** the short “Mrs Kate Paul…” style; that matches **firm** appointment, not individual.
  - **Legacy risk**: If `executorData` contains **plain strings**, `formatExcludedPersonForClause` returns the string **as-is** (`excludedPersonFormat.js` ~8–9), so **uncontrolled** text could still appear.

- **Evidence**
  - **Files**: `src/utils/excludedPersonFormat.js`, `src/components/PDFGeneratorJSPDF.js`, `src/components/FormRenderer.jsx`, `src/data/Complete-WillSuite-Form-Data.json`.

- **Gaps / risks**
  - **Mariyam’s example** is satisfied for **structured** modal rows; **not guaranteed** for legacy string rows or pasted blobs.
  - **Aristone** block is intentionally verbose (SRA, trading name) — differs from the **individual** example; confirm with stakeholders.

- **Recommended fix**: Reject or normalize legacy string `executorData` entries; document Aristone vs individual wording expectations.

- **Priority**: High (if leaked strings still occur in production data)

---

### Requirement: Exclusion of internal/solicitor-only content from Will and final Will PDF

- **Status:** Done (with **Unverified** on “no leak via validation appendix”)

- **Requirement summary**: Estate Overview answers, solicitor-only intake, internal review data, and extra appointment metadata must not appear in Will text or PDF body.

- **What exists now**
  - **Estate Overview**: `excludeFromWill: true` on all relevant fields; `buildClauses.js` skips them.
  - **Client questionnaire**: `visibleSections` hides Estate Overview for clients; `SOLICITOR_INTAKE_ONLY_FIELD_IDS` used for autofill stripping (`clientMode.js`).
  - **PDF clause pipeline**: Clauses come from `buildClauses` + interpolation; no `willClauseText` on estate fields.
  - **Validation / missing-items appendix**: `PDFGeneratorJSPDF.js` renders a **validation report** listing missing sections/fields (e.g. “Personal Information: firstName”) — this is **operational**, not dispositive will text; **could** expose internal field labels. Not the same as “Will clauses” but relevant if Mariyam meant “PDF must never show internal labels.”

- **Evidence**
  - **Files**: `src/utils/buildClauses.js`, `src/data/Complete-WillSuite-Form-Data.json`, `src/components/PDFGeneratorJSPDF.js` (validation report section ~4084+), `src/constants/clientMode.js`.

- **Gaps / risks**
  - **Appendix** may list technical field paths/labels — confirm against Mariyam’s intent for “client copy” vs “solicitor execution PDF.”

- **Recommended fix**: Product copy review for validation appendix wording.

- **Priority**: Medium

---

### Requirement: PDF rendering / wording quality

- **Status:** Partially done (implementation present; **visual outcome Unverified**)

- **Requirement summary**: No clipped words, malformed wrapping, duplicate fragments, bad punctuation, or known bad strings; examples: “Crematorium..”, failed-share lead-in, “of my net estate of my net estate”, clipped “applie” etc.

- **What exists now**
  - **Clause body**: `renderNumberedClause` uses `tokenizeMarkedString` → `flattenToWordTokens` → `layoutSegmentAwareLines` → `drawSegmentAwareClauseLines` (`PDFGeneratorJSPDF.js` ~2271–2327, ~892–1086).
  - **Cleanup**: `normalizeClauseText`, `finalizeClauseTextForPdf` / `finalizeClauseTextForPdfPass` — includes regexes for double-period after words, failed-share lead-in, duplicate “of my net estate” (`PDFGeneratorJSPDF.js` ~132+, ~267–300, applied ~3478–3485 before render).
  - **Schedules / other text**: `wrapPdfLinesWordAware` still used for non–clause-body lines (~1932+).

- **Evidence**
  - **Files**: `src/components/PDFGeneratorJSPDF.js`

- **Gaps / risks**
  - **Cannot assert** from this audit alone that **no** PDF still shows clipping or duplicate fragments in all cases; depends on jsPDF measurement drift, content, and fonts.
  - **Repo doc** `docs/MARIYAM-PDF-FIXES-SUMMARY.md` still claims bold rendering via **`renderTextWithBoldSegments`** (line 40), which **does not exist** in `src/` — see **Confirmed Bugs**.

- **Recommended fix**: Visual regression on representative PDFs; fix or remove stale doc.

- **Priority**: High (if clipping still reported in production)

---

## 4. Field and Logic Map

| Requirement | Field ID(s) | Section ID(s) | Trigger condition(s) | Visible to client? | Visible to solicitor? | In Will clauses? | In PDF body? | Source file(s) |
|-------------|-------------|-----------------|------------------------|--------------------|-----------------------|------------------|--------------|----------------|
| Estate Overview | `estateOverviewIntro`, `aristoneProfessionalFeesNotice`, `aristoneProfessionalFeesAck`, `estateAssetTypes`, `estateAssetOther`, `estateLiabilityTypes`, `estateGrossValueRange`, `estateLiabilityValueRange`, `estatePropertyValueRange`, `estateAdditionalNotes` | `Estate Overview (Optional)` (`_solicitorIntakeOnly`) | Solicitor mode **and** (Aristone executor OR professional Aristone) | **No** (section filtered) | **Yes**, when Aristone path | **No** (`excludeFromWill`) | **No** (no `willClauseText` on these fields) | `Complete-WillSuite-Form-Data.json`, `FormRenderer.jsx`, `buildClauses.js` |
| Digital executor (no general digital power) | `appointDigitalAssetsExecutor` | `Trustees/Executors` | Always in section | Yes | Yes | Yes (radio `willClauseText` when Yes) | Yes | JSON, `buildClauses.js` |
| Digital executor follow-up (No) | `digitalExecutorIfNoData` | `digitalExecutorIfNoSection` | `appointDigitalAssetsExecutor === "No"` | Yes | Yes | Yes (`willClauseText` on section) | Yes (interpolated) | JSON, `FormRenderer.jsx`, `PDFGeneratorJSPDF.js` |
| Digital executors (Yes + separate) | `digitalExecutorData` | `digitalExecutorsSection` | Yes **and** `appointSeparateDigitalExecutor === "Yes"` | Yes | Yes | Yes | Yes | JSON |
| Executor appointment line | `executorData`, `chooseAristoneExecutor` | `executorsSection` | Various | Yes (non-solicitor-only fields) | Yes | Yes | Yes | JSON, interpolate |

---

## 5. PDF Path Audit

- **Will PDF entry**: `export const generatePDFWithJSPDF` in `src/components/PDFGeneratorJSPDF.js` (~1862+). Builds `jsPDF` document, loads optional logo, iterates clauses from `buildClauses({ formValues, formData: schema, interpolateText, maxSectionIndex })` (~2350+).
- **Clause list**: Shared with preview via `buildClauses.js` + `interpolateText` defined inside PDF module (mirrors `FormRenderer` logic for `fullDetails`).
- **Appointment text**: Composed from JSON `willClauseText` templates with `{{field:section:fullDetails}}` resolved through `interpolateText` / `wrapClientValue` for bold markers.
- **Normalization / sanitization**: `normalizeClauseText`, `sanitizeUnprofessionalContent`, `standardizeAristoneName`, `finalizeClauseTextForPdf` applied in clause processing pipeline (~3478–3485 region).
- **Internal data leak into body clauses**: **No evidence** estate fields enter clauses (no `willClauseText`, `excludeFromWill`). **Appendix** may still print missing-field diagnostics.
- **Wrapping reliability**: Clause bodies use measured token layout (`layoutSegmentAwareLines`, `drawSegmentAwareClauseLines`) with `CLAUSE_COLUMN_SAFETY_MM` (~22–30, ~2290–2294). **Reliability vs. all PDF viewers** = **Unverified** without samples.

---

## 6. Confirmed Bugs

| Bug | Evidence |
|-----|----------|
| **Stale documentation**: `docs/MARIYAM-PDF-FIXES-SUMMARY.md` states client values are rendered via `renderTextWithBoldSegments` | File line 40; **grep** `renderTextWithBoldSegments` in `src/` returns **no matches** — doc is **incorrect** for current source. |

---

## 7. Unverified Claims

| Claim | Why unverified |
|-------|----------------|
| “PDF never shows right-edge clipped words” | Requires **visual** or binary text-layer inspection of generated PDFs; code mitigations exist but are not proof. |
| “No duplicate/malformed fragments remain in all wills” | `finalizeClauseTextForPdf` targets known patterns; cannot exhaust all content paths. |
| “Validation appendix never exposes unacceptable internal data” | Appendix content not reviewed against Mariyam’s confidentiality bar in this audit. |

---

## 8. Recommended Implementation Order

1. **Verify PDF output** (samples: long clauses, bold segments, Aristone + individual executors) — confirms or refutes clipping/duplication.
2. **Align / fix `docs/MARIYAM-PDF-FIXES-SUMMARY.md`** — remove wrong function name; describe current bold path (`wrapClientValue` + `drawSegmentAwareClauseLines`).
3. **Harden executor `fullDetails`** — reject or parse legacy string `executorData` rows if leaks are observed.
4. **Product decision** on validation appendix labels on client-facing PDFs.
5. **Optional tests**: `buildClauses` never emits clauses for `SOLICITOR_INTAKE_ONLY_FIELD_IDS`; snapshot PDF text for known bad strings.

---

## 9. File-by-File Change Targets

| File | Likely edits (if gaps confirmed) |
|------|-----------------------------------|
| `src/components/PDFGeneratorJSPDF.js` | PDF quality, appendix copy, any new sanitization |
| `src/utils/excludedPersonFormat.js` / `personRecordSpecs.js` | Stricter person line formatting for legacy data |
| `docs/MARIYAM-PDF-FIXES-SUMMARY.md` | Doc accuracy |
| `src/data/Complete-WillSuite-Form-Data.json` | Only if field logic/copy changes |
| `src/components/FormRenderer.jsx` | Visibility / validation messaging |

---

## 10. Final Verdict

- **What Mariyam can rely on right now (code-proven)**  
  - Estate Overview is **schema-defined**, **solicitor-gated** (Aristone executor paths), **hidden from clients**, and **excluded from will clause generation** via `excludeFromWill` + `buildClauses` skips.  
  - **Digital executor follow-up when “No”** exists (`digitalExecutorIfNoSection` / `digitalExecutorIfNoData`) and is wired into interpolation and clause templates.  
  - **Structured** executor/trustee-style lines use **name + of + address** formatting with **Bedfordshire** typo fix in `formatExcludedPersonForClause`.

- **What is still unsafe / incomplete without further proof**  
  - **Visual PDF quality** (clipping, stray fragments) — **not verified** here.  
  - **Legacy string** person rows may bypass strict formatting.  
  - **Stale doc** misstates bold rendering.

- **What must be fixed before handoff** (process + doc minimum)  
  - **Correct** `docs/MARIYAM-PDF-FIXES-SUMMARY.md` (or retire it).  
  - **Run** agreed PDF samples through Mariyam’s checklist; if clipping persists, treat as **High** priority despite layout code.

---

## Other Mariyam-related items spotted outside primary scope

- **`docs/MARIYAM-PDF-FIXES-SUMMARY.md`**: Client PDF witness removal, download gating, section headers — **not re-verified** line-by-line against `PDFGeneratorJSPDF.js` in this audit; claims should be spot-checked before relying on the doc.
- **`PDFGeneratorJSPDF.js` comments** reference “Mariyam’s numbering” (~3367, ~3532) — logic exists; **not** audited against a written spec in-repo.
- **`src/utils/autoFillForm.js`** comment references Mariyam/Aristone estate intake test data (~488) — demo only.

---

*Audit generated from repository state; no functional code changes were made to produce this document.*
