/**
 * Client vs Solicitor mode configuration.
 * Client mode: intake only - clients complete up to Testamentary Capacity, no witness/signing UI, no PDF download.
 * Solicitor mode: full access including execution, witnesses, PDF download.
 */

/** Section title used to hide intake-only block from clients (must match form JSON). */
export const TESTAMENTARY_CAPACITY_SECTION_TITLE = 'Testamentary Capacity';

// Legacy default index when the section title is not found (factory order)
export const TESTAMENTARY_CAPACITY_SECTION_INDEX = 18;
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
