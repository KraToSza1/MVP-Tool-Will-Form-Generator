import {
  EXCLUDED_PERSON_FIELD_SPECS,
  formatExcludedPersonForClause,
} from './excludedPersonFormat.js';

/** Extra fields aligned with testator/partner-style intake (optional on each row). */
export const PERSON_RECORD_EXTRA_SPECS = [
  { key: 'relationship', label: 'Relationship / role note', type: 'text', placeholder: 'e.g. Son, friend' },
  { key: 'relationshipToTestator', label: 'Relationship to testator', type: 'text' },
  { key: 'occupation', label: 'Occupation', type: 'text' },
  { key: 'nationalityCountry', label: 'Country of nationality / citizenship', type: 'text' },
  { key: 'countryOfResidence', label: 'Country of residence', type: 'text' },
];

export const PERSON_RECORD_SPECS = [...EXCLUDED_PERSON_FIELD_SPECS, ...PERSON_RECORD_EXTRA_SPECS];

export function emptyPersonRecord() {
  return Object.fromEntries(PERSON_RECORD_SPECS.map((s) => [s.key, '']));
}

/**
 * Clause / list display for rich person rows (add-person modal + legacy strings).
 */
export function formatPersonRecordForClause(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  const base = formatExcludedPersonForClause(item);
  const extras = [];
  if (item.relationship || item.relationshipToTestator) {
    extras.push([item.relationship, item.relationshipToTestator].filter(Boolean).join(' — '));
  }
  if (item.occupation) extras.push(`Occupation: ${item.occupation}`);
  if (item.nationalityCountry) extras.push(`Nationality: ${item.nationalityCountry}`);
  if (item.countryOfResidence) extras.push(`Residence: ${item.countryOfResidence}`);
  if (!extras.length) return base;
  return base ? `${base} — ${extras.join(' — ')}` : extras.join(' — ');
}
