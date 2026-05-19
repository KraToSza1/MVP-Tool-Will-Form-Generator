/**
 * Clear dependent form values when a high-risk controlling answer changes
 * (residue, guardians, executors, property trust, deliberate exclusions).
 */

const RESIDUE_AS_SHARES_KEYS = [
  'residualGiftsDetails',
  'failedResiduePassProportionately',
];

const RESIDUE_FLIT_KEYS = [
  'powerToRevokeLifeInterest',
  'appointSeparateTrusteesFLIT',
  'separateTrusteeData',
  'lifeTenantDetails',
  'beneficiariesDetails',
  'flitTrustEndMode',
  '_flitTrustEndMode',
];

const RESIDUE_SHARED_KEYS = [
  'specifyFurtherResidualGiftsOnFail',
  'furtherResidualGiftsDetails',
  'give10PercentToCharity',
  'charityGiftOnlyIfIHTDue',
  'splitCharitableGift',
  'charityBenefitDetails',
  'minimumCharityAmount',
  'minimumCharityAmountValue',
  'howIHTDealtWithSplitting',
];

const GUARDIAN_KEYS = [
  'guardianFlowState',
  'guardianshipDetailsData',
  'substituteGuardianshipDetailsData',
];

const EXECUTOR_SWITCH_KEYS = [
  'executorData',
  'substituteExecutorData',
  'chooseAristoneSubstituteExecutor',
  'digitalExecutorData',
  'professionalExecutorOtherDetails',
];

const PROPERTY_TRUST_KEYS = [
  'includePropertyTrust',
  'propertyTrustGuided',
  'propertyTrustDetails',
  'propertyTrustScheduleNumber',
  'propertyTrustTerms',
  'pt_intent',
  'pt_properties',
  'pt_ownership',
  'pt_life_tenant_powers',
  'pt_remainder',
  'pt_trustees',
  'pt_notes',
];

const EXCLUSION_KEYS = ['excludedPersonData', 'excludedPersonSection'];

function keysChanged(prev, next, keys) {
  return keys.some((k) => !Object.is(prev[k], next[k]));
}

function clearKeys(target, keys) {
  const out = { ...target };
  let changed = false;
  for (const k of keys) {
    if (out[k] !== undefined && out[k] !== null && out[k] !== '') {
      if (Array.isArray(out[k]) && out[k].length === 0) continue;
      out[k] = Array.isArray(out[k]) ? [] : null;
      changed = true;
    }
  }
  return changed ? out : target;
}

function pruneResidue(prev, next) {
  if (prev.howResidueDistributed === next.howResidueDistributed) return next;
  let out = next;
  const dist = next.howResidueDistributed;
  if (dist === 'AsShares') {
    out = clearKeys(out, [...RESIDUE_FLIT_KEYS, ...RESIDUE_SHARED_KEYS]);
  } else if (dist === 'IntoFLIT') {
    out = clearKeys(out, [...RESIDUE_AS_SHARES_KEYS, ...RESIDUE_SHARED_KEYS]);
  } else {
    out = clearKeys(out, [...RESIDUE_AS_SHARES_KEYS, ...RESIDUE_FLIT_KEYS, ...RESIDUE_SHARED_KEYS]);
  }
  return out;
}

function pruneGuardians(prev, next) {
  if (prev.appointGuardians === next.appointGuardians) return next;
  return clearKeys(next, GUARDIAN_KEYS);
}

function pruneExecutors(prev, next) {
  const controllerKeys = [
    'chooseAristoneExecutor',
    'appointProfessionalExecutor',
    'professionalExecutorSelection',
  ];
  if (!keysChanged(prev, next, controllerKeys)) return next;
  return clearKeys(next, EXECUTOR_SWITCH_KEYS);
}

function prunePropertyTrust(prev, next) {
  if (prev.includePropertyTrust === next.includePropertyTrust) return next;
  if (next.includePropertyTrust === 'Yes') return next;
  return clearKeys(next, PROPERTY_TRUST_KEYS.filter((k) => k !== 'includePropertyTrust'));
}

function pruneExclusions(prev, next) {
  if (prev.deliberatelyExcludingAnyone === next.deliberatelyExcludingAnyone) return next;
  if (next.deliberatelyExcludingAnyone === 'Yes') return next;
  return clearKeys(next, EXCLUSION_KEYS);
}

/**
 * @param {Record<string, unknown>} prev
 * @param {Record<string, unknown>} next
 * @returns {Record<string, unknown>}
 */
export function pruneStaleBranchValues(prev, next) {
  if (!prev || !next || prev === next) return next;
  let out = next;
  out = pruneResidue(prev, out);
  out = pruneGuardians(prev, out);
  out = pruneExecutors(prev, out);
  out = prunePropertyTrust(prev, out);
  out = pruneExclusions(prev, out);
  return out;
}
