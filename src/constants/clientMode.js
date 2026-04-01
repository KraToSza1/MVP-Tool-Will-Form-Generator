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

/** Ordinal min of gross estate band (£ thousands, lower bound of range). */
const ESTATE_GROSS_MIN_K = {
  Under50k: 0,
  Range50_150: 50,
  Range150_325: 150,
  Range325_500: 325,
  Range500_1m: 500,
  Range1m_2m: 1000,
  Over2m: 2000,
  PreferNotToSayGross: null,
};

/** Ordinal max of total liabilities band (£ thousands, upper bound of range). */
const LIABILITY_MAX_K = {
  None: 0,
  Under25k: 25,
  Range25_100: 100,
  Range100_250: 250,
  Over250k: 999999,
  PreferNotToSayLiab: null,
};

/** Extra-verbose logs (same dedupe key) — optional on top of dev logs. */
const VERBOSE_ESTATE_REC =
  typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_ESTATE_RECOMMENDATION === 'true';

let _lastEstateRecLogKey = '';

function buildEstateRecommendationLogSummary(state) {
  if (state.eligible) {
    return 'QUALIFIED — on Trustees/Executors: show "You qualify" panel + highlighted Aristone option';
  }
  if (
    !(state.grossKey || '').trim() &&
    !(state.liabilityKey || '').trim() &&
    !state.inferredLiability
  ) {
    return 'INCOMPLETE — select gross estate (step 3); liabilities (step 4) or tick "No liabilities" (step 2)';
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
      inferredLiability: false,
      grossMin: null,
      liabMax: null,
      reasons: ['No form values.'],
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  const rawG = formValues.estateGrossValueRange;
  const rawL = formValues.estateLiabilityValueRange;
  let grossKey = typeof rawG === 'string' ? rawG.trim() : rawG != null ? String(rawG).trim() : '';
  let liabilityKey = typeof rawL === 'string' ? rawL.trim() : rawL != null ? String(rawL).trim() : '';

  let inferredLiability = false;
  if (
    !liabilityKey &&
    Array.isArray(formValues.estateLiabilityTypes) &&
    formValues.estateLiabilityTypes.includes('NoLiabilities')
  ) {
    liabilityKey = 'None';
    inferredLiability = true;
    reasons.push('Liability value band inferred as "None" because "No liabilities" is selected in step 2.');
  }

  if (!grossKey) {
    reasons.push('Select an approximate gross estate value (step 3).');
    const state = {
      eligible: false,
      grossKey,
      liabilityKey,
      inferredLiability,
      grossMin: null,
      liabMax: null,
      reasons,
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  const grossMin = ESTATE_GROSS_MIN_K[grossKey];
  if (grossMin == null) {
    reasons.push('Gross estate is "Prefer not to say" or unknown — recommendation hidden.');
    const state = {
      eligible: false,
      grossKey,
      liabilityKey,
      inferredLiability,
      grossMin: null,
      liabMax: null,
      reasons,
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  if (!liabilityKey) {
    reasons.push('Select an approximate total liabilities value (step 4), or choose "No liabilities" in step 2.');
    const state = {
      eligible: false,
      grossKey,
      liabilityKey,
      inferredLiability,
      grossMin,
      liabMax: null,
      reasons,
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  const liabMax = LIABILITY_MAX_K[liabilityKey];
  if (liabMax == null) {
    reasons.push('Liabilities are "Prefer not to say" — recommendation hidden.');
    const state = {
      eligible: false,
      grossKey,
      liabilityKey,
      inferredLiability,
      grossMin,
      liabMax: null,
      reasons,
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  if (grossMin < 50) {
    reasons.push('Gross estate band is below £50,000 — no professional recommendation.');
    const state = {
      eligible: false,
      grossKey,
      liabilityKey,
      inferredLiability,
      grossMin,
      liabMax,
      reasons,
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  if (grossMin <= liabMax) {
    reasons.push(
      'Net position is not positive at band level (gross lower bound must exceed liabilities upper bound).'
    );
    const state = {
      eligible: false,
      grossKey,
      liabilityKey,
      inferredLiability,
      grossMin,
      liabMax,
      reasons,
    };
    maybeLogEstateRecommendation(state);
    return state;
  }

  reasons.push('Net positive estate over £50k — showing Aristone recommendation on Executors.');
  const state = {
    eligible: true,
    grossKey,
    liabilityKey,
    inferredLiability,
    grossMin,
    liabMax,
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

/** Field IDs for estate intake (must match form JSON). Legacy name — no longer stripped from client autofill. */
export const SOLICITOR_INTAKE_ONLY_FIELD_IDS = new Set([
  'estateOverviewIntro',
  'aristoneProfessionalFeesNotice',
  'aristoneProfessionalFeesAck',
  'estateStep1Heading',
  'estateStep2Heading',
  'estateStep3Heading',
  'estateStep4Heading',
  'estateStep5Heading',
  'estateStep6Heading',
  'estateAssetTypes',
  'estateAssetOther',
  'estateLiabilityTypes',
  'estateGrossValueRange',
  'estateLiabilityValueRange',
  'estatePropertyValueRange',
  'estateAdditionalNotes',
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
