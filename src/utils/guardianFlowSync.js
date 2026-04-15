/**
 * Maps GuardianFlow completion payloads to main form keys and builds Will clause text
 * for per-child guardian appointments (guardianshipDetailsSection:fullDetails).
 */
import { formatAppointmentPersonListForClause } from './appointmentPersonFormat.js';
import { pickPersonFieldsForModal } from './personRecordSpecs.js';

/** Empty GuardianFlow `PersonModal` row (single source of truth with GuardianFlow.jsx). */
export const GUARDIAN_FLOW_MODAL_EMPTY = {
  title: '',
  firstName: '',
  middleNames: '',
  lastName: '',
  addressLine1: '',
  addressLine2: '',
  town: '',
  postcode: '',
  dob: '',
  gender: '',
  occupation: '',
  relationship: '',
  mobile: '',
  email: '',
};

function registryGenderToGuardianModalGender(g) {
  if (g == null || String(g).trim() === '') return '';
  const t = String(g).trim();
  const lower = t.toLowerCase();
  if (lower === 'male' || t === 'Male') return 'male';
  if (lower === 'female' || t === 'Female') return 'female';
  if (lower === 'other' || t === 'Other' || lower === 'non-binary' || lower === 'non_binary') return 'non_binary';
  if (lower.includes('prefer')) return 'prefer_not_to_say';
  return 'non_binary';
}

/**
 * Normalise registry / *Data person row / existing modal row into GuardianFlow PersonModal shape.
 * @param {Record<string, unknown>|null|undefined} raw
 * @returns {typeof GUARDIAN_FLOW_MODAL_EMPTY}
 */
export function normalizeSourceToGuardianModalForm(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...GUARDIAN_FLOW_MODAL_EMPTY };
  }
  const hasFlowShape =
    Object.prototype.hasOwnProperty.call(raw, 'addressLine1') ||
    Object.prototype.hasOwnProperty.call(raw, 'middleNames');
  if (hasFlowShape) {
    const o = { ...GUARDIAN_FLOW_MODAL_EMPTY };
    for (const k of Object.keys(GUARDIAN_FLOW_MODAL_EMPTY)) {
      const v = raw[k];
      if (v != null && String(v).trim() !== '') o[k] = String(v).trim();
    }
    return o;
  }
  const p = pickPersonFieldsForModal(raw);
  return {
    title: p.title || '',
    firstName: p.firstName || '',
    middleNames: p.middleName || '',
    lastName: p.lastName || '',
    addressLine1: p.address1 || '',
    addressLine2: p.address2 || '',
    town: p.address3 || '',
    postcode: p.postcode || '',
    dob: p.dateOfBirth || '',
    gender: registryGenderToGuardianModalGender(p.gender),
    occupation: p.occupation || '',
    relationship: p.relationship || '',
    mobile: p.mobile || '',
    email: p.email || '',
  };
}

const GENDER_MAP = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Other',
  prefer_not_to_say: '',
};

/**
 * @param {Record<string, unknown>} p GuardianFlow person row
 * @returns {Record<string, string>|null}
 */
export function guardianFlowPersonToAppointmentRow(p) {
  if (!p || typeof p !== 'object') return null;
  const row = {
    title: String(p.title || '').trim(),
    firstName: String(p.firstName || '').trim(),
    middleName: String(p.middleNames ?? p.middleName ?? '').trim(),
    lastName: String(p.lastName || '').trim(),
    address1: String(p.addressLine1 ?? p.address1 ?? '').trim(),
    address2: String(p.addressLine2 ?? p.address2 ?? '').trim(),
    address3: String(p.town ?? p.address3 ?? '').trim(),
    postcode: String(p.postcode || '').trim(),
  };
  const dob = String(p.dob ?? p.dateOfBirth ?? '').trim();
  if (dob) row.dateOfBirth = dob;
  const g = String(p.gender || '').trim();
  if (g) {
    row.gender = GENDER_MAP[g] || (['Male', 'Female', 'Other'].includes(g) ? g : 'Other');
  }
  if (p.occupation != null && String(p.occupation).trim()) row.occupation = String(p.occupation).trim();
  if (p.relationship != null && String(p.relationship).trim()) row.relationship = String(p.relationship).trim();
  if (p.mobile != null && String(p.mobile).trim()) row.mobile = String(p.mobile).trim();
  if (p.email != null && String(p.email).trim()) row.email = String(p.email).trim();
  if (!row.firstName || !row.lastName) return null;
  return row;
}

/**
 * @param {Array<Record<string, unknown>>} children GuardianFlow children with guardians[]
 * @returns {string}
 */
export function buildGuardianshipDetailsClause(children) {
  if (!Array.isArray(children) || children.length === 0) return '';
  const parts = [];
  for (const ch of children) {
    const fn = String(ch.childFirstName || ch.firstName || '').trim();
    const ln = String(ch.childLastName || ch.lastName || '').trim();
    const dob = String(ch.dob || ch.dateOfBirth || '').trim();
    const childLabel = [fn, ln].filter(Boolean).join(' ').trim();
    const guardians = Array.isArray(ch.guardians)
      ? ch.guardians.map(guardianFlowPersonToAppointmentRow).filter(Boolean)
      : [];
    const gPhrase = formatAppointmentPersonListForClause(guardians);
    if (!childLabel || !gPhrase) continue;
    parts.push(
      `I appoint ${gPhrase} to be the guardian(s) of ${childLabel}${
        dob ? ` (date of birth ${dob})` : ''
      }`
    );
  }
  return parts.join(' ');
}

/**
 * Resolves guardianshipDetailsData for {{field:guardianshipDetailsSection:fullDetails}}.
 * @param {Record<string, unknown>} values formValues
 * @returns {string}
 */
export function resolveGuardianshipDetailsDataForClause(values) {
  const raw = values?.guardianshipDetailsData;
  if (raw == null) return '';
  if (typeof raw === 'string') return raw.trim();
  if (Array.isArray(raw)) {
    return raw
      .map((x) => (typeof x === 'string' ? x.trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim();
  }
  return String(raw).trim();
}

/**
 * @param {{ guardianOption: string, guardians?: unknown[], children?: unknown[] }} data
 * @param {{ skipAppointGuardians?: boolean }} [opts]
 * @returns {Record<string, unknown>}
 */
export function mapGuardianFlowCompletionToFormValues(data, opts = {}) {
  const out = {};
  if (!data || typeof data !== 'object') return out;
  const { skipAppointGuardians } = opts;

  if (data.guardianOption === 'no') {
    if (!skipAppointGuardians) out.appointGuardians = 'No';
    out.guardianData = [];
    out.guardianshipDetailsData = '';
    out.substituteGuardianData = [];
  } else if (data.guardianOption === 'yes_same') {
    if (!skipAppointGuardians) out.appointGuardians = 'Yes';
    const rows = (data.guardians || []).map(guardianFlowPersonToAppointmentRow).filter(Boolean);
    out.guardianData = rows;
    out.guardianshipDetailsData = '';
  } else if (data.guardianOption === 'yes_different') {
    if (!skipAppointGuardians) out.appointGuardians = 'Yes, but appoint different guardians for children';
    out.guardianData = [];
    out.guardianshipDetailsData = buildGuardianshipDetailsClause(data.children || []);
  }
  return out;
}
