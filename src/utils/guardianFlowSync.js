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

function normPersonKey(s) {
  return String(s ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normPostcodeKey(pc) {
  return String(pc ?? '').replace(/\s+/g, '').toUpperCase();
}

/**
 * Stable identity fingerprint for GuardianFlow person rows (modal shape or appointment rows).
 * Same person re-added from the registry or typed twice should match.
 */
export function guardianFlowPersonFingerprint(p) {
  if (!p || typeof p !== 'object') return '';
  const fn = normPersonKey(p.firstName);
  const ln = normPersonKey(p.lastName);
  if (!fn || !ln) return '';
  const mn = normPersonKey(p.middleNames ?? p.middleName);
  const a1 = normPersonKey(p.addressLine1 ?? p.address1);
  const town = normPersonKey(p.town ?? p.address3);
  const pc = normPostcodeKey(p.postcode);
  return `${fn}|${ln}|${mn}|${a1}|${town}|${pc}`;
}

/**
 * @param {Record<string, unknown>} newPerson
 * @param {unknown[]} list
 * @param {{ excludeIndex?: number }} [opts] excludeIndex: when editing, ignore that row
 */
export function guardianFlowPersonIsDuplicate(newPerson, list, opts = {}) {
  const { excludeIndex = -1 } = opts;
  const fp = guardianFlowPersonFingerprint(newPerson);
  if (!fp || !Array.isArray(list)) return false;
  return list.some((row, i) => {
    if (i === excludeIndex) return false;
    if (!row || typeof row !== 'object') return false;
    return guardianFlowPersonFingerprint(row) === fp;
  });
}

/** Keep first occurrence of each fingerprint; rows without a usable fingerprint are kept. */
export function dedupeGuardianFlowPersonList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const out = [];
  for (const row of list) {
    if (!row || typeof row !== 'object') continue;
    const fp = guardianFlowPersonFingerprint(row);
    if (!fp) {
      out.push(row);
      continue;
    }
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push(row);
  }
  return out;
}

const GENDER_MAP = {
  male: 'Male',
  female: 'Female',
  non_binary: 'Other',
  prefer_not_to_say: '',
};

/** ISO YYYY-MM-DD → DD/MM/YYYY for clause text; otherwise return trimmed string. */
function formatDobForClause(dob) {
  const s = String(dob ?? '').trim();
  if (!s) return '';
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) {
    const [, y, mo, d] = m;
    return `${d}/${mo}/${y}`;
  }
  return s;
}

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
    const dob = formatDobForClause(ch.dob || ch.dateOfBirth || '');
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
 * When the same guardian(s) apply to every listed child (yes_same), build one sentence per child.
 * @param {unknown[]} guardians GuardianFlow person rows
 * @param {Array<Record<string, unknown>>} children children under 18 (names + dob; guardians on each row ignored)
 * @returns {string}
 */
export function buildGuardianshipDetailsClauseSameGuardians(guardians, children) {
  if (!Array.isArray(children) || children.length === 0) return '';
  const appointmentRows = (guardians || []).map(guardianFlowPersonToAppointmentRow).filter(Boolean);
  const gPhrase = formatAppointmentPersonListForClause(appointmentRows);
  if (!gPhrase) return '';
  const parts = [];
  for (const ch of children) {
    const fn = String(ch.childFirstName || ch.firstName || '').trim();
    const ln = String(ch.childLastName || ch.lastName || '').trim();
    const dob = formatDobForClause(ch.dob || ch.dateOfBirth || '');
    const childLabel = [fn, ln].filter(Boolean).join(' ').trim();
    if (!childLabel) continue;
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
    out.guardianshipDetailsData = buildGuardianshipDetailsClauseSameGuardians(
      data.guardians || [],
      data.children || []
    );
    const subRows = (data.substituteGuardians || [])
      .map(guardianFlowPersonToAppointmentRow)
      .filter(Boolean);
    out.substituteGuardianData = subRows;
  } else if (data.guardianOption === 'yes_different') {
    if (!skipAppointGuardians) out.appointGuardians = 'Yes, but appoint different guardians for children';
    out.guardianData = [];
    out.guardianshipDetailsData = buildGuardianshipDetailsClause(data.children || []);
    out.substituteGuardianData = [];
  }
  return out;
}
