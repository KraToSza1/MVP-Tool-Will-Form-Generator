/**
 * Format excluded-person entries for will clauses (FormRenderer / PDF interpolation).
 * Supports legacy string entries and rich object rows from the add-person modal.
 *
 * Legal-style wording: "Mrs Kate Paul of 50 Napier Road, Luton, Bedfordshire, LU1 1RG" (name + " of " + comma-separated address).
 */
export function formatExcludedPersonForClause(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);
  const name = [item.title, item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ').trim();
  const addr = [item.address1, item.address2, item.address3, item.postcode].filter(Boolean).join(', ');
  const fixCountyTypo = (s) =>
    String(s).replace(/\bBedforshire\b/gi, 'Bedfordshire');
  if (name && addr) return fixCountyTypo(`${name} of ${addr}`);
  if (name) return fixCountyTypo(name);
  if (addr) return fixCountyTypo(addr);
  return '';
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

export function emptyExcludedPersonRecord() {
  return Object.fromEntries(EXCLUDED_PERSON_FIELD_SPECS.map((s) => [s.key, '']));
}
