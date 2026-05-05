/**
 * LPA opportunity scoring + payload shape (ported from lpa-opportunity-system.js; React integration).
 */

/** @typedef {{
 *   lpa_seeds_shown: string[],
 *   lpa_triggers: Record<string, unknown>,
 *   lpa_priority: string,
 *   lpa_client_response: string | null,
 *   lpa_types_recommended: string[],
 *   lpa_shown_at_step: number[],
 *   lpa_final_banner_shown?: boolean,
 * }} LpaOpportunityState */

export const DEFAULT_LPA_STATE = () => ({
  lpa_seeds_shown: [],
  lpa_triggers: {},
  lpa_priority: 'none',
  lpa_client_response: null,
  lpa_types_recommended: [],
  lpa_shown_at_step: [],
  lpa_final_banner_shown: false,
});

export const PRIORITY_RANK = { urgent: 3, high: 2, standard: 1, none: 0 };

export function normalizeLpaState(raw) {
  const base = DEFAULT_LPA_STATE();
  if (!raw || typeof raw !== 'object') return base;
  return {
    ...base,
    ...raw,
    lpa_seeds_shown: Array.isArray(raw.lpa_seeds_shown) ? [...raw.lpa_seeds_shown] : [],
    lpa_triggers:
      raw.lpa_triggers && typeof raw.lpa_triggers === 'object' ? { ...raw.lpa_triggers } : {},
    lpa_types_recommended: Array.isArray(raw.lpa_types_recommended)
      ? [...raw.lpa_types_recommended]
      : [],
    lpa_shown_at_step: Array.isArray(raw.lpa_shown_at_step)
      ? [...raw.lpa_shown_at_step]
      : [],
    lpa_final_banner_shown: !!raw.lpa_final_banner_shown,
  };
}

export function setPriority(state, level) {
  const next = { ...state };
  const cur = next.lpa_priority || 'none';
  if (!cur || cur === 'none' || (PRIORITY_RANK[level] ?? 0) > (PRIORITY_RANK[cur] ?? 0)) {
    next.lpa_priority = level;
  }
  return next;
}

export function addRecommendedType(state, type) {
  if (state.lpa_types_recommended.includes(type)) return state;
  return { ...state, lpa_types_recommended: [...state.lpa_types_recommended, type] };
}

/** @param {string} dobRaw */
export function ageFromIsoDob(dobRaw) {
  if (dobRaw == null || String(dobRaw).trim() === '') return null;
  const d = new Date(dobRaw);
  if (Number.isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

export function parseGuardianFlowState(formValues) {
  const raw = formValues?.guardianFlowState;
  if (!raw || typeof raw !== 'string') return null;
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : null;
  } catch {
    return null;
  }
}

/** @param {unknown} child */
export function childIsMinorFromDob(child) {
  if (!child || typeof child !== 'object') return false;
  const dob = /** @type {{ dob?: string }} */ (child).dob;
  const age = ageFromIsoDob(dob || '');
  return age != null && age < 18;
}

export function guardianFlowHasMinorChild(formValues) {
  const flow = parseGuardianFlowState(formValues);
  const children = Array.isArray(flow?.children) ? flow.children : [];
  return children.some(childIsMinorFromDob);
}

export function hasMeaningfulPartner(formValues) {
  const full = String(formValues?.partnerFullName || '').trim();
  const fn = String(formValues?.partnerFirstName || '').trim();
  const ln = String(formValues?.partnerLastName || '').trim();
  return !!(full || (fn && ln) || (fn && !ln) || (!fn && ln));
}

const NO_PARTNER_MARITAL = new Set(['Single', 'Divorced', 'Widowed']);

export function shouldTriggerSingleNoPartner(formValues) {
  const ms = formValues?.maritalStatus;
  if (!NO_PARTNER_MARITAL.has(String(ms || ''))) return false;
  return !hasMeaningfulPartner(formValues);
}

export function shouldTriggerPropertyTrust(formValues) {
  const inc = String(formValues?.includePropertyTrust || '').trim();
  const w = String(formValues?.pt_wants_trust || '').trim().toLowerCase();
  if (inc === 'Yes' || inc === 'Unsure') return true;
  return w === 'yes' || w === 'advise';
}

export function shouldTriggerBusiness(formValues) {
  return String(formValues?.biz_has_interests || '').trim().toLowerCase() === 'yes';
}

export function hasGuardianshipDetails(formValues) {
  const g = formValues?.guardianshipDetailsData;
  if (typeof g === 'string') return g.trim().length > 0;
  if (Array.isArray(g)) return g.some((x) => String(x || '').trim());
  return false;
}

/** @param {unknown} existing */
export function mergeCapacityConcernIntoLpa(existing) {
  let s = normalizeLpaState(existing);
  s = {
    ...s,
    lpa_triggers: { ...s.lpa_triggers, capacityConcern: true },
  };
  s = setPriority(s, 'urgent');
  s = addRecommendedType(s, 'property_financial');
  s = addRecommendedType(s, 'health_welfare');
  return s;
}
