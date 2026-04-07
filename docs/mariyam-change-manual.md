# Mariyam Change Manual — 2 April 2026

Backup branch: `backup/mariyam-changes-2026-04-02`

---

## 1. Estate Overview — field labels

| # | Requirement | Status | File | Notes |
|---|-------------|--------|------|-------|
| 1a | Remove "Step 1:", "Step 2:" etc prefixes | DONE | JSON `estateStep1Heading`…`estateStep5Heading` display fields already use clean text | No "Step X:" text exists anywhere in codebase |
| 1b | Remove "(Checkboxes)", "(Range)", "(Conditional…)" | DONE | Not present in codebase | |
| 1c | "What assets do you have?" | DONE | `estateStep1Heading` text | |
| 1d | "Do you have any outstanding liabilities?" | DONE | `estateStep2Heading` text | |
| 1e | "What is the approximate value of your estate before deducting liabilities?" | DONE | `estateStep3Heading` text | |
| 1f | "What is the approximate total value of your liabilities?" | DONE | `estateStep4Heading` text | |
| 1g | "What is the approximate value of your property?" | DONE | `estateStep5Heading` text | |
| 1h | "Is there anything else we should know about your estate? (Optional)" | DONE | `estateAdditionalNotes` label | |

## 2. Property Value conditional logic

| Requirement | Status | Notes |
|-------------|--------|-------|
| Show only when Property (UK) OR Property (overseas) selected | DONE | `estatePropertyValueRange` conditions: OR clauses on `estateAssetTypes` includes `PropertyUK` / `PropertyOverseas` |
| Do not change logic | DONE | Untouched |

## 3. "Choosing your executors" section

| Requirement | Status | Notes |
|-------------|--------|-------|
| Standalone section after Estate Overview, before Trustees/Executors | DONE | Own `formSection` in JSON at correct position |
| Visible to ALL users (no conditional) | DONE | Not in `visibleSections` filter |
| Informational only (no inputs) | DONE | Single `display` field |
| Back/Next navigation, Next → Trustees/Executors | DONE | Standard form navigation |
| Exact wording (4 paragraphs about executors/Aristone) | DONE | `choosingExecutorsIntro` display field |
| Does not alter Estate Overview or Trustees/Executors | DONE | |

## 4. Professional fees wording

| Requirement | Status | Notes |
|-------------|--------|-------|
| One notice: "If you appoint Aristone…professional fees…pricing on our website" | DONE | `aristoneProfessionalFeesNotice` + FieldRenderer renders clickable link |
| One checkbox: "I understand and agree" | DONE | `aristoneProfessionalFeesAck` with single option |
| No separate "Professional fees" heading | DONE | Does not exist |
| No trustee remuneration question | DONE | Does not exist |
| No second checkbox | DONE | Does not exist |

## 5. Digital assets flow

| Requirement | Status | Notes |
|-------------|--------|-------|
| Remove old "Should the Executors be appointed…" question | DONE | Not in live JSON |
| Remove old "Would you like to appoint separate digital Executors?" | DONE | Not in live JSON |
| New Q1: "Do you want someone to manage your digital assets…?" Yes/No | DONE | `digitalAssetsWantManagement` — **Yes first, No second** (reordered this session) |
| No → stop, no further questions | DONE | `digitalAssetsWhoManages` condition: eq Yes |
| Yes → Q2: "Who should be responsible…?" My executors / Someone else | DONE | `digitalAssetsWhoManages` |
| My executors → stop | DONE | `digitalExecutorsSection` condition: AND(Yes, SomeoneElse) |
| Someone else → "Who would you like to appoint?" + Add Digital Executor | DONE | `digitalExecutorsSection` with button |
| Help tooltip on Q1 | DONE | `infoText` on `digitalAssetsWantManagement` |

## 6. Additional Notes helper text

| Requirement | Status | Notes |
|-------------|--------|-------|
| Replace "Free text for the solicitor…" with long guidance text | DONE | `estateAdditionalNotes` placeholder already has the exact wording |

## 7. Executor age flow

| Requirement | Status | File |
|-------------|--------|------|
| Only runs when ≥1 individual executor added | DONE | JSON condition: `executorData` `arrayLengthGte` `1`; component filters Aristone lines |
| Not shown if only Aristone selected / no individuals | DONE | `isAristoneExecutorLine` filter → `relevant.length === 0` → return null |
| Uses DOB from add-executor form | DONE | `getAgeYearsFromDob(item.dateOfBirth)` |
| **25+**: no age question | DONE | `tier === '25plus'` → renderExecutorBlock returns null |
| **18–24**: shows intro + "act from 18" / "later age" radios | DONE | `intro1824` text, from18/later radios |
| **18–24 later**: "At what age…?" with 21/23/25/Other | DONE | `LATER_OPTIONS_1824` |
| **18–24 Other**: manual age entry | DONE | number input when `actingAgePreset === 'Other'` |
| **18–24**: "Until they reach…" explanation if chosen age > current | DONE | `showExplainUnder` condition |
| **Under 18**: shows intro + "act from 18" / "later age" radios | DONE | `introU18` text |
| **Under 18 later**: 18/21/23/25/Other | DONE | `LATER_OPTIONS_UNDER18` |
| **Under 18**: "Until they reach…" explanation | DONE | Same `showExplainUnder` logic |
| Warning if no executor can act immediately | DONE | `showNoImmediateWarning` banner |
| Warning suggests: add another executor / appoint Aristone | DONE | Listed in warning UI |
| Warning does NOT block user | DONE | Informational only |
| Warning removed dynamically when new executor added | DONE | `useMemo` recalculates on `executorData` change |

## 8. Solicitor login fix

| Requirement | Status | File |
|-------------|--------|------|
| Login stuck on "Signing in…" | FIXED | `src/lib/auth.js` — `onAuthStateChange` no longer blocks `signInWithPassword` resolution |
| Root cause: `profiles.select` inside sync auth callback | FIXED | Moved to `queueMicrotask` + `withTimeout` |

---

## Files changed this session

| File | Change |
|------|--------|
| `src/lib/auth.js` | Fix login deadlock (onAuthStateChange async → deferred microtask) |
| `src/data/Complete-WillSuite-Form-Data.json` | Digital assets options reordered Yes/No |
| `src/components/FormRenderer.jsx` | Added AUTOFILL_VERIFY log line (debug, temporary) |

## Known temporary debug instrumentation (to remove when Mariyam signs off)

Search for these tags to find and remove:
- `[EXECUTOR_AGE_DEBUG]` — FormRenderer, FieldRenderer, ExecutorIndividualAgeFlow, executorAgeUtils
- `[AUTOFILL_VERIFY]` — FormRenderer, autoFillForm
- Noisy `parseUkDate` / `getAgeYearsFromDob` per-call logs — executorAgeUtils

---

## Backup

Branch `backup/mariyam-changes-2026-04-02` contains a snapshot of all code as of this session.
To restore: `git checkout backup/mariyam-changes-2026-04-02`
