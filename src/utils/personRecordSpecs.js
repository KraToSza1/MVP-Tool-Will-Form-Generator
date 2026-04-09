import { EXCLUDED_PERSON_FIELD_SPECS, formatExcludedPersonForClause } from './excludedPersonFormat.js';

/**
 * Intake-only fields: stored on the person row and in the contact registry for solicitors.
 * {@link formatExcludedPersonForClause} / appointment clause formatters ignore these for Will/PDF wording.
 */
export const PERSON_INTAKE_EXTRA_SPECS = [
  { key: 'dateOfBirth', label: 'Date of birth', type: 'text', placeholder: 'dd/mm/yyyy' },
  {
    key: 'gender',
    label: 'Gender',
    type: 'select',
    options: [
      { value: '', label: 'Select…' },
      { value: 'Male', label: 'Male' },
      { value: 'Female', label: 'Female' },
      { value: 'Other', label: 'Other' },
    ],
  },
  { key: 'occupation', label: 'Occupation', type: 'text', placeholder: 'e.g. Teacher, Retired' },
  {
    key: 'relationship',
    label: 'Relationship to testator',
    type: 'text',
    placeholder: 'e.g. Friend, sibling, child',
  },
  { key: 'mobile', label: 'Mobile', type: 'text', placeholder: 'Optional' },
  { key: 'email', label: 'Email', type: 'text', placeholder: 'Optional' },
];

/** All fields shown in PersonRecordModal (identity + intake). */
export const PERSON_RECORD_SPECS = [...EXCLUDED_PERSON_FIELD_SPECS, ...PERSON_INTAKE_EXTRA_SPECS];

/** Optional subtitle under add-person buttons (empty = label only). */
export const ADD_PERSON_FIELDS_HINT = '';

export function emptyPersonRecord() {
  return Object.fromEntries(PERSON_RECORD_SPECS.map((s) => [s.key, '']));
}

/**
 * Merge hardcoded person specs with solicitor overrides from the form definition.
 * Overrides can change label, placeholder, and hidden status per field key.
 * @param {Record<string, {label?: string, placeholder?: string, hidden?: boolean}>} [overrides]
 * @returns {Array} Merged specs (hidden fields filtered out).
 */
export function getMergedPersonSpecs(overrides) {
  if (!overrides || typeof overrides !== 'object') return PERSON_RECORD_SPECS;
  return PERSON_RECORD_SPECS
    .map((spec) => {
      const o = overrides[spec.key];
      if (!o) return spec;
      return {
        ...spec,
        label: o.label ?? spec.label,
        placeholder: o.placeholder ?? spec.placeholder,
        ...(o.hidden != null ? { _hiddenFromClient: !!o.hidden } : {}),
      };
    })
    .filter((spec) => !spec._hiddenFromClient);
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
