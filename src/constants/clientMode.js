/**
 * Client vs Solicitor mode configuration.
 * Client mode: intake only - clients complete up to Testamentary Capacity, no witness/signing UI, no PDF download.
 * Solicitor mode: full access including execution, witnesses, PDF download.
 */

/** Section title used to hide intake-only block from clients (must match form JSON). */
export const TESTAMENTARY_CAPACITY_SECTION_TITLE = 'Testamentary Capacity';

/** Sidebar step title for estate intake (must match form JSON). Placed after Guardians; excludeFromWill on fields. */
export const ESTATE_OVERVIEW_SECTION_TITLE = 'Estate Overview';

/** @deprecated Use ESTATE_OVERVIEW_SECTION_TITLE */
export const SOLICITOR_INTAKE_ONLY_SECTION_TITLE = ESTATE_OVERVIEW_SECTION_TITLE;

/**
 * True when Aristone Solicitors is the executor: quick pick (chooseAristoneExecutor === 'Aristone')
 * or professional executor path (appointProfessionalExecutor + professionalExecutorSelection === 'Aristone').
 */
export function isAristoneExecutorSelected(formValues) {
  if (!formValues || typeof formValues !== 'object') return false;
  if (formValues.chooseAristoneExecutor === 'Aristone') return true;
  if (
    formValues.appointProfessionalExecutor === 'Yes' &&
    formValues.professionalExecutorSelection === 'Aristone'
  ) {
    return true;
  }
  return false;
}

/** Band rank for estate value (new simplified Estate Overview). */
const ESTATE_BANDS = {
  'Under £50,000': 0,
  '£50,000 – £150,000': 1,
  '£150,001 – £325,000': 2,
  '£325,001 – £500,000': 3,
  'Over £500,000': 4,
};

/** Band rank for liabilities (new simplified Estate Overview). */
const LIABILITY_BANDS = {
  'None': 0,
  'Under £10,000': 1,
  '£10,000 – £50,000': 2,
  '£50,001 – £150,000': 3,
  'Over £150,000': 4,
};

/** Extra-verbose logs (same dedupe key) — optional on top of dev logs. */
const VERBOSE_ESTATE_REC =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_ESTATE_RECOMMENDATION === 'true';

let _lastEstateRecLogKey = '';

function buildEstateRecommendationLogSummary(state) {
  if (state.eligible) {
    return 'QUALIFIED — on Trustees/Executors: show estate recommendation panel + highlighted Aristone option';
  }
  if (
    !(state.grossKey || '').trim() &&
    !(state.liabilityKey || '').trim() &&
    !state.inferredLiability
  ) {
    return 'INCOMPLETE — select estate value and liabilities on Estate Overview';
  }
  const tip = (state.reasons || []).filter(Boolean).pop();
  return tip ? `NOT_QUALIFIED — ${tip}` : 'NOT_QUALIFIED';
}

/** One-line summary for dev logs / autofill preview (same rules as UI). */
export function getEstateRecommendationLogSummary(state) {
  return buildEstateRecommendationLogSummary(state);
}

function maybeLogEstateRecommendation(state) {
  if (typeof import.meta === 'undefined' || !import.meta.env?.DEV) return;
  // Skip the noisy "no estate answers yet" snapshot (initial load / before session hydrates).
  if (
    !state.eligible &&
    !(state.grossKey || '').trim() &&
    !(state.liabilityKey || '').trim() &&
    !state.inferredLiability
  ) {
    return;
  }
  const key = `${state.eligible}|${state.grossKey}|${state.liabilityKey}|${state.inferredLiability}|${(state.reasons || []).join('¦')}`;
  if (key === _lastEstateRecLogKey) return;
  _lastEstateRecLogKey = key;
  const summary = buildEstateRecommendationLogSummary(state);
  const payload = {
    summary,
    eligible: state.eligible,
    grossKey: state.grossKey,
    liabilityKey: state.liabilityKey,
    inferredLiabilityFromNoLiabilities: state.inferredLiability,
    grossMinK: state.grossMin,
    liabilityMaxK: state.liabMax,
    netPositiveBands: state.grossMin != null && state.liabMax != null && state.grossMin > state.liabMax,
    reasons: state.reasons,
  };
  console.log('[EstateRecommendation]', payload);
  if (VERBOSE_ESTATE_REC) {
    console.log('[EstateRecommendation][verbose] full state', state);
  }
}

/**
 * Full breakdown for Aristone executor recommendation (Estate Overview → Trustees/Executors messaging).
 * Uses simplified band-ranking: recommend when estate ≥ £50k AND liabilities band is strictly lower.
 * In **development**, deduped `[EstateRecommendation]` logs are emitted when the result changes.
 * Set `VITE_DEBUG_ESTATE_RECOMMENDATION=true` for an additional verbose line.
 */
export function getAristoneEstateRecommendationState(formValues) {
  const reasons = [];

  if (!formValues || typeof formValues !== 'object') {
    const state = {
      eligible: false,
      grossKey: '',
      liabilityKey: '',
      ownProperty: null,
      businessInterests: null,
      inferredLiability: false,
      grossMin: null,
      liabMax: null,
      reasons: ['No form values.'],
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  const rawG = formValues.estateApproxValue;
  const rawL = formValues.estateApproxLiabilities;
  const grossKey = typeof rawG === 'string' ? rawG.trim() : '';
  const liabilityKey = typeof rawL === 'string' ? rawL.trim() : '';
  const ownProperty = formValues.estateOwnProperty ?? null;
  const businessInterests = formValues.estateBusinessInterests ?? null;

  const eRank = ESTATE_BANDS[grossKey] ?? null;
  const lRank = LIABILITY_BANDS[liabilityKey] ?? null;

  const estateQualifies = eRank != null && eRank >= 1;
  const propertyQualifies = ownProperty === 'Yes';
  const businessQualifies = businessInterests === 'Yes';

  const eligible = estateQualifies || propertyQualifies || businessQualifies;

  if (eligible) {
    if (estateQualifies) reasons.push(`Estate ≥ £50k (${grossKey}) — professional administration recommended.`);
    if (propertyQualifies) reasons.push('Property owned — professional administration recommended.');
    if (businessQualifies) reasons.push('Business interests present — professional administration recommended.');
  } else {
    if (!grossKey) reasons.push('No estate value selected.');
    else if (!estateQualifies) reasons.push(`Estate under £50k (${grossKey}) — no estate signal.`);
    if (ownProperty !== 'Yes') reasons.push(`Property: ${ownProperty ?? 'not answered'} — no property signal.`);
    if (businessInterests !== 'Yes') reasons.push(`Business interests: ${businessInterests ?? 'not answered'} — no business signal.`);
    reasons.push('No qualifying signals — recommendation not shown.');
  }

  const state = {
    eligible,
    grossKey,
    liabilityKey,
    ownProperty,
    businessInterests,
    inferredLiability: false,
    grossMin: eRank,
    liabMax: lRank,
    reasons,
  };

  maybeLogEstateRecommendation(state);
  return state;
}

/**
 * Whether to show Aristone “recommended for estates like yours” messaging on Trustees/Executors.
 * Uses {@link getAristoneEstateRecommendationState} so radio / checkbox combinations stay consistent.
 */
export function shouldRecommendAristoneFromEstate(formValues) {
  return getAristoneEstateRecommendationState(formValues).eligible;
}

/** Field IDs for estate intake (must match form JSON). */
export const SOLICITOR_INTAKE_ONLY_FIELD_IDS = new Set([
  'estateOverviewIntro',
  'estateApproxValue',
  'estateApproxLiabilities',
  'estateOwnProperty',
  'estateBusinessInterests',
  'aristoneProfessionalFeesNotice',
  'aristoneProfessionalFeesAck',
]);

// Legacy default index when the section title is not found (factory order; keep in sync with Complete-WillSuite-Form-Data.json)
export const TESTAMENTARY_CAPACITY_SECTION_INDEX = 19;
export const CLIENT_VISIBLE_MAX_SECTION_INDEX = TESTAMENTARY_CAPACITY_SECTION_INDEX - 1;

// Field IDs that are solicitor-only (hidden in client mode): execution/witnesses + professional executor workflow
export const SOLICITOR_ONLY_FIELD_IDS = new Set([
  'includeWitnessDetails', 'witness1Section', 'witness2Section',
  'willExecutionDate', 'testatorSignature', 'consultantSignature', 'clientSignature',
  'inabilityToSignProvisions', 'signingOnBehalfSection', 'interpreterSection', 'nativeLanguage',
  'witness1StatusDisplay', 'addWitness1Button', 'witness1Data',
  'witness2StatusDisplay', 'addWitness2Button', 'witness2Data',
  'signingOnBehalfStatusDisplay', 'addSigningOnBehalfButton', 'signingOnBehalfData',
  'interpreterStatusDisplay', 'addInterpreterButton', 'interpreterData',
  // Substitute / professional executors — completed by solicitor, not shown to clients (intake)
  'substituteExecutorsSection',
  'appointProfessionalExecutor',
  'professionalExecutorSection',
  'substituteProfessionalExecutorSection',
]);

export const isSolicitorMode = () => {
  if (typeof window === 'undefined') return false;
  if ((window.location.pathname || '').startsWith('/solicitor')) return true;
  if (!import.meta.env.DEV) return false;
  const params = new URLSearchParams(window.location.search);
  const val = params.get('solicitor');
  if (val === '1' || val === 'true' || val === 'yes') return true;
  // Fallback: handle URL-encoded form ?solicitor%3D1 (some browsers/links produce this)
  const search = (window.location.search || '').toLowerCase();
  return search.includes('solicitor=1') || search.includes('solicitor%3d1') || search.includes('solicitor=true');
};
