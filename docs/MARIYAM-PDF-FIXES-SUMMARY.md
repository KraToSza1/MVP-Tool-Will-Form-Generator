# Mariyam PDF Requirements — Implementation Summary

## 1. Client PDF: Witness Sections Removed ✅

**Changes in `PDFGeneratorJSPDF.js`:**
- When `isClientPDF` is true, the execution page shows **only**:
  - INTAKE ONLY notice
  - "To be signed by [Name] at your solicitor appointment."
  - Date of signing (blank line)
  - Testator signature box (empty — sign in person)
- **Removed entirely** for client PDF:
  - "We confirm this Will was signed first by…" attestation
  - Witness 1 / Witness 2 boxes
  - Any witness-related text

## 2. Client PDF: No "Signed" Wording ✅

**Changes:**
- Replaced "Signed by [Name], to give effect to this Will, on" with:
  - "To be signed by [Name] at your solicitor appointment."
- No execution date pre-filled for client PDF (stays blank)
- Testator signature image **not** rendered in client PDF (blank box only)

## 3. Download Gating & Client Messaging ✅

**Current behavior:**
- **Client mode** (no `?solicitor=1`): No download button. Shows amber banner:
  - "Questionnaire complete — this is not your final Will"
  - "Solicitor review and identity verification happen next. Your documents will be emailed to you. An appointment will be scheduled for legal signing (wet signature) with witnesses."
- **Solicitor mode** (`?solicitor=1`): Two download options:
  - **Execution PDF** — full copy with witnesses, attestation, "Signed by…"
  - **Client copy** — intake-only, no witnesses, not sign-ready (for sending to client)

## 4. Section Headers ✅

Section headers (Foreign Assets, Guardians, Trustees, etc.) remain enabled and visible.

## 5. Bold Client-Entered Values

All interpolated client values (including addresses) use `wrapClientValue()` and are rendered via `renderTextWithBoldSegments`, which applies bold font for text between BOLD_START and BOLD_END markers.

### Screenshot guidance for bold proof

To capture evidence that addresses are bold:
1. Open app with `?solicitor=1`
2. Use autofill, then download **Client copy**
3. In the PDF, locate clauses containing addresses (e.g. Separate Trustees, Pet Carer, Executors, Beneficiaries)
4. Take a screenshot where address text is clearly visible — bold text will appear darker/heavier than surrounding body text
5. For multiple addresses: check "Friend Mr Michael Thompson of **67 Church Road, Hampstead, London…**" and similar blocks — the address portions should be bold

---

## How to Test

### Client PDF (no witnesses)

1. Open: `http://localhost:5173/?solicitor=1`
2. Autofill or complete the form
3. Click **Client copy** (amber button) — NOT "Execution PDF"
4. Verify the signature page:
   - INTAKE ONLY notice at top
   - "To be signed by [Name] at your solicitor appointment."
   - No attestation, no Witness 1/2, no "Signed by" wording

### Download gating (client mode)

1. Open: `http://localhost:5173/` (no `?solicitor=1`)
2. Complete or autofill the form
3. Verify: No download button; amber banner with "Questionnaire complete — this is not your final Will"
