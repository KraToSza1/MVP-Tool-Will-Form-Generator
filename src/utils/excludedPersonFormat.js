/**
 * Format excluded-person entries for will clauses (FormRenderer / PDF interpolation).
 * Supports legacy string entries and rich object rows from the add-person modal.
 *
 * Legal-style wording: "Mrs Kate Paul of 50 Napier Road, Luton, Bedfordshire, LU1 1RG" (name + " of " + comma-separated address).
 * Objects are reduced to modal fields only so stray keys (email, internal ids) never affect output.
 */
export function normalizeCountySpellingInLine(s) {
  return String(s).replace(/\bBedforshire\b/gi, 'Bedfordshire');
}

/** Field config: title, full name, and address only (add-person flows + excluded persons). */
export const EXCLUDED_PERSON_FIELD_SPECS = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'e.g. Mr, Ms, Dr' },
  { key: 'firstName', label: 'First name', type: 'text' },
  { key: 'middleName', label: 'Middle name(s)', type: 'text' },
  { key: 'lastName', label: 'Last name', type: 'text' },
  { key: 'address1', label: 'Address line 1', type: 'text' },
  { key: 'address2', label: 'Address line 2', type: 'text' },
  { key: 'address3', label: 'Town / city', type: 'text' },
  { key: 'postcode', label: 'Postcode', type: 'text' },
];

function pickAllowedPersonFields(item) {
  const out = {};
  for (const spec of EXCLUDED_PERSON_FIELD_SPECS) {
    const v = item[spec.key];
    if (v != null && String(v).trim() !== '') out[spec.key] = String(v).trim();
  }
  return out;
}

export function formatExcludedPersonForClause(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);
  const cleaned = pickAllowedPersonFields(item);
  const name = [cleaned.title, cleaned.firstName, cleaned.middleName, cleaned.lastName].filter(Boolean).join(' ').trim();
  const addr = [cleaned.address1, cleaned.address2, cleaned.address3, cleaned.postcode].filter(Boolean).join(', ');
  if (name && addr) return normalizeCountySpellingInLine(`${name} of ${addr}`);
  if (name) return normalizeCountySpellingInLine(name);
  if (addr) return normalizeCountySpellingInLine(addr);
  return '';
}

export function emptyExcludedPersonRecord() {
  return Object.fromEntries(EXCLUDED_PERSON_FIELD_SPECS.map((s) => [s.key, '']));
}
