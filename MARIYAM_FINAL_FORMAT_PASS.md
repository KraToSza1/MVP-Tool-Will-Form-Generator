# Mariyam Final Format Pass

## 1. What was still wrong

- **Appointment `fullDetails` for executors, substitute executors, trustees, substitute trustees, digital executors, and digital-executor-if-No** used `formatExcludedPersonForClause` per array row. **Plain string** rows were returned **verbatim**, so demo strings, emails, or long blobs could appear in Will/PDF wording.
- **Structured objects** could carry extra keys (e.g. legacy `email`); those keys were not used in the formatted line, but **consistency** required stripping to **modal fields only** everywhere.
- **Professional executor / trustee “Other”** (`professionalExecutorOtherDetails`, `substituteProfessionalExecutorOtherDetails`, and trustee equivalents) passed **trimmed free text** straight into the Will with **no** stripping of contact details or noise.
- **Preview (`FormRenderer`)** did not implement the same **`professionalExecutorSelection` / `substituteProfessionalExecutorSelection` / professional trustee `fullDetails`** branch as **PDF**, so preview could diverge from PDF for those templates.

---

## 2. What I changed

- Added **`src/utils/appointmentPersonFormat.js`** with:
  - **`formatAppointmentPersonForClause`**: objects → only `EXCLUDED_PERSON_FIELD_SPECS` fields, then `formatExcludedPersonForClause`; strings → **`formatLegacyAppointmentString`** (strip demo markers, emails, phone-like tokens, UUIDs; **`normalizeCountySpellingInLine`**; whitespace; optional length trim at comma).
  - **`formatAppointmentPersonListForClause`**: maps/joins appointment rows with **`; `**; **empty** after cleaning → **omitted** (not passed through raw).
  - **`formatProfessionalOtherDetailsForClause`**: strips emails, labelled contact slots, phone-like runs; county typo; whitespace; soft cap ~400 chars at last comma where sensible.
- Hardened **`src/utils/excludedPersonFormat.js`**:
  - Exported **`normalizeCountySpellingInLine`** (`Bedforshire` → `Bedfordshire`).
  - **`formatExcludedPersonForClause`** for **objects** now uses **`pickAllowedPersonFields`** so only title/name/address/postcode fields contribute (no stray metadata keys).
- **`src/components/PDFGeneratorJSPDF.js`**: appointment person lists use **`formatAppointmentPersonListForClause`**; professional “Other” uses **`formatProfessionalOtherDetailsForClause`** before **`wrapClientValue`**. **Aristone** branches unchanged (still **`getCanonicalFirmName()`** + fixed tail for professional selection; hardcoded **Aristone Limited (trading as…)** for executor quick-pick).
- **`src/components/FormRenderer.jsx`**: same **`formatAppointmentPersonListForClause`** for the six appointment sections; added **professional / substitute professional / professional trustee** **`fullDetails`** handling aligned with PDF (Aristone line + **`formatProfessionalOtherDetailsForClause`** for Other).

**PDF layout / wrapping / margins / page breaks:** **not modified.**

---

## 3. Exact files changed

| File |
|------|
| `src/utils/appointmentPersonFormat.js` *(new)* |
| `src/utils/excludedPersonFormat.js` |
| `src/components/PDFGeneratorJSPDF.js` |
| `src/components/FormRenderer.jsx` |
| `MARIYAM_FINAL_FORMAT_PASS.md` *(this file)* |

---

## 4. Exact field IDs affected

**Data arrays (rows formatted for `:fullDetails` / `:fullList` in appointment sections):**

- `executorData` → `executorsSection`
- `substituteExecutorData` → `substituteExecutorsSection`
- `trusteeData` → `trusteesSection`
- `substituteTrusteeData` → `substituteTrusteesSection`
- `digitalExecutorData` → `digitalExecutorsSection`
- `digitalExecutorIfNoData` → `digitalExecutorIfNoSection`

**Professional “Other” free-text fields (cleaned on output path):**

- `professionalExecutorOtherDetails` (with `professionalExecutorSelection === 'Other'`)
- `substituteProfessionalExecutorOtherDetails` (with `substituteProfessionalExecutorSelection === 'Other'`)
- `professionalTrusteeOtherDetails` / `substituteProfessionalTrusteeOtherDetails` (same pattern, field names follow `*Selection` → `*OtherDetails` replacement in code)

**Unchanged:** `chooseAristoneExecutor` / `chooseAristoneSubstituteExecutor` **firm** strings; `professionalExecutorSelection === 'Aristone'` wording path.

---

## 5. Remaining risks

- **Legacy strings** that look like real addresses after stripping are **still** passed through; only **obvious** noise (demo, email, phone patterns, UUIDs) is removed. Truly malicious or oddly phrased blobs may need **manual** solicitor review.
- **`formatProfessionalOtherDetailsForClause`** does not **parse** firm name vs address into separate fields; it **sanitizes** one line. Ideal UX may still be **structured** “Other” fields (future work; not required for this pass).
- **Excluded-person** clauses still use **`formatExcludedPersonForClause`** for **strings** with simple **trim** (not the strict legacy appointment cleaner). Scope was **appointment** sections only.
- **PDF validation appendix** may still list internal field labels — out of scope for appointment wording.

---

## 6. Final verdict

- **Mariyam point 1 (clean appointment wording)** is **addressed** for the listed executor/trustee/digital appointment arrays via **strict object shaping** + **legacy string normalization** + **controlled “Other” professional** text. **County** normalization remains centralized.
- **Aristone firm** appointment wording is **unchanged** in structure; executor/substitute quick-pick and professional selection paths remain as before, aside from **Other** sanitization.
- **Safe for review:** yes, with the **remaining risks** above understood.

---

*Implementation: legacy string rows are **normalized** where possible and **dropped** if empty after cleaning; “Other” professional wording is **controlled** via **`formatProfessionalOtherDetailsForClause`**. PDF rendering code was not edited.*
