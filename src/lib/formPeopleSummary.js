/**
 * Aggregates people-like entries from a saved questionnaire payload for solicitor review
 * and optional client-side read-only summary. Does not change form behaviour.
 */

import { getPartnerIntakeRows } from './partnerIntakeSummary.js';

/** Array keys on formValues that typically hold named people (strings or objects). */
export const PEOPLE_ARRAY_KEYS = [
  { key: 'guardianData', role: 'Guardian' },
  { key: 'substituteGuardianData', role: 'Substitute guardian' },
  { key: 'executorData', role: 'Executor' },
  { key: 'substituteExecutorData', role: 'Substitute executor' },
  { key: 'professionalExecutorData', role: 'Professional executor' },
  { key: 'substituteProfessionalExecutorData', role: 'Substitute professional executor' },
  { key: 'digitalExecutorData', role: 'Digital executor' },
  { key: 'digitalExecutorIfNoData', role: 'Digital executor (no default digital-assets powers)' },
  { key: 'trusteeData', role: 'Trustee' },
  { key: 'substituteTrusteeData', role: 'Substitute trustee' },
  { key: 'separateTrusteeData', role: 'Separate trustee (FLIT / other)' },
  { key: 'professionalTrusteeData', role: 'Professional trustee' },
  { key: 'substituteProfessionalTrusteeData', role: 'Substitute professional trustee' },
  { key: 'petCarerData', role: 'Pet carer' },
  { key: 'substitutePetCarerData', role: 'Substitute pet carer' },
  { key: 'chattelRecipientData', role: 'Chattels recipient' },
  { key: 'excludedPersonData', role: 'Excluded person' },
  { key: 'debtorData', role: 'Debt released' },
  { key: 'signingOnBehalfData', role: 'Signs on behalf' },
  { key: 'interpreterData', role: 'Interpreter' },
  { key: 'witness1Data', role: 'Witness 1' },
  { key: 'witness2Data', role: 'Witness 2' },
];

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * Turn one array entry into a short title + optional detail lines.
 * @param {unknown} item
 * @returns {{ title: string, lines: { label: string, value: string }[] }}
 */
export function normalizePersonEntry(item) {
  const lines = [];
  if (item == null) return { title: '', lines: [] };
  if (typeof item === 'string') {
    const t = trim(item);
    return { title: t || '(empty)', lines: [] };
  }
  if (typeof item !== 'object') {
    return { title: String(item), lines: [] };
  }

  const o = item;
  const title =
    trim(o.fullName) ||
    [o.title, o.firstName, o.middleName, o.lastName].filter(Boolean).join(' ').trim() ||
    trim(o.name) ||
    trim(o.label) ||
    '(unnamed)';

  const push = (label, key) => {
    const v = o[key];
    if (v != null && trim(v) !== '') lines.push({ label, value: trim(v) });
  };

  push('Relationship', 'relationship');
  push('Relationship to testator', 'relationshipToTestator');
  push('Email', 'email');
  push('Email', 'email_dupe');
  push('Mobile', 'mobile');
  push('Phone', 'phone');
  push('Date of birth', 'dateOfBirth');
  push('Gender', 'gender');
  push('Address line 1', 'address1');
  push('Address line 2', 'address2');
  push('Address line 3', 'address3');
  push('Postcode', 'postcode');
  push('Occupation', 'occupation');
  push('Nationality', 'nationalityCountry');
  push('Country of residence', 'countryOfResidence');

  return { title, lines };
}

/**
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {{ id: string, role: string, title: string, lines: { label: string, value: string }[] }[]}
 */
export function getFormPeopleEntries(payload) {
  if (!payload || typeof payload !== 'object') return [];

  const out = [];

  const partnerRows = getPartnerIntakeRows(payload);
  if (partnerRows.length > 0) {
    const title =
      trim(payload.partnerFullName) ||
      [payload.partnerTitle, payload.partnerFirstName, payload.partnerLastName].filter(Boolean).join(' ').trim() ||
      'Partner / spouse';
    out.push({
      id: 'partner',
      role: 'Partner / spouse',
      title,
      lines: partnerRows,
    });
  }

  for (const { key, role } of PEOPLE_ARRAY_KEYS) {
    const raw = payload[key];
    if (!raw) continue;
    const arr = Array.isArray(raw) ? raw : [raw];
    arr.forEach((item, i) => {
      const { title, lines } = normalizePersonEntry(item);
      if (!title || title === '(empty)') return;
      out.push({
        id: `${key}-${i}`,
        role,
        title,
        lines,
      });
    });
  }

  return out;
}

/**
 * Corporate / firm appointment lines (e.g. Aristone) are often repeated across several roles on purpose.
 * They are not "duplicate people" — exclude from natural-person duplicate heuristic.
 */
export function shouldSkipDuplicateTitleForHeuristic(title) {
  const t = trim(title).toLowerCase();
  if (!t) return true;
  if (t.includes('aristone')) return true;
  if (t.includes('sra no') || t.includes('sra number')) return true;
  if (/\btrading as\b/.test(t) && /\b(limited|llp|plc)\b/.test(t)) return true;
  return false;
}

/**
 * Heuristic: flag entries whose titles share the same normalised name (possible duplicate **natural persons**).
 * Same firm repeated in Executor + Professional executor is ignored (see shouldSkipDuplicateTitleForHeuristic).
 * The same loved one named in two roles (e.g. spouse as guardian and executor) may still appear here — often intentional.
 * @param {ReturnType<typeof getFormPeopleEntries>} entries
 * @returns {string[][]} groups of entry ids that look like the same name
 */
export function getPossibleDuplicateNameGroups(entries) {
  const map = new Map();
  for (const e of entries) {
    if (shouldSkipDuplicateTitleForHeuristic(e.title)) continue;
    const n = e.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (n.length < 3) continue;
    if (!map.has(n)) map.set(n, []);
    map.get(n).push(e.id);
  }
  return [...map.values()].filter((ids) => ids.length > 1);
}
