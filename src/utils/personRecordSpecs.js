import { EXCLUDED_PERSON_FIELD_SPECS, formatExcludedPersonForClause } from './excludedPersonFormat.js';

export const PERSON_RECORD_SPECS = EXCLUDED_PERSON_FIELD_SPECS;

/** Subtitle for add-person buttons and related UI (matches modal fields). */
export const ADD_PERSON_FIELDS_HINT = 'Title, full name & address only';

export function emptyPersonRecord() {
  return Object.fromEntries(PERSON_RECORD_SPECS.map((s) => [s.key, '']));
}

/** Keep only fields shown in the person modal (prefill from registry may carry legacy keys). */
export function pickPersonFieldsForModal(data) {
  if (!data || typeof data !== 'object') return {};
  const out = {};
  for (const spec of PERSON_RECORD_SPECS) {
    const k = spec.key;
    const v = data[k];
    if (v != null && String(v).trim() !== '') out[k] = String(v).trim();
  }
  return out;
}

/**
 * Clause / list display for rich person rows (add-person modal + legacy strings).
 */
export function formatPersonRecordForClause(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (item && typeof item === 'object') {
    return formatExcludedPersonForClause(item) || '—';
  }
  return String(item ?? '');
}
