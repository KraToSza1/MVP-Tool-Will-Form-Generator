/**
 * Format excluded-person entries for will clauses (FormRenderer / PDF interpolation).
 * Supports legacy string entries and rich object rows from the add-person modal.
 */
export function formatExcludedPersonForClause(item) {
  if (item == null) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item !== 'object') return String(item);
  const name = [item.title, item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ');
  const known = item.knownAs ? ` (known as ${item.knownAs})` : '';
  const alias = item.alias ? `; also known as ${item.alias}` : '';
  const nameBlock = (name + known + alias).trim();
  const addr = [item.address1, item.address2, item.address3, item.postcode].filter(Boolean).join(', ');
  const contact = [item.mobile, item.email].filter(Boolean).join(', ');
  const dob = item.dateOfBirth ? `DOB ${item.dateOfBirth}` : '';
  const gender = item.gender ? String(item.gender) : '';
  const parts = [nameBlock || undefined, dob, gender, addr, contact].filter(Boolean);
  return parts.join(' — ');
}

/** Field config for the excluded-person modal (labels + keys on stored object). */
export const EXCLUDED_PERSON_FIELD_SPECS = [
  { key: 'title', label: 'Title', type: 'text', placeholder: 'e.g. Mr, Ms, Dr' },
  { key: 'firstName', label: 'First name', type: 'text' },
  { key: 'middleName', label: 'Middle name(s)', type: 'text' },
  { key: 'lastName', label: 'Last name', type: 'text' },
  { key: 'knownAs', label: 'Known as', type: 'text', placeholder: 'If different from legal name' },
  { key: 'alias', label: 'Other / alias', type: 'text' },
  { key: 'dateOfBirth', label: 'Date of birth', type: 'text', placeholder: 'DD/MM/YYYY' },
  { key: 'gender', label: 'Gender', type: 'text' },
  { key: 'mobile', label: 'Mobile', type: 'text' },
  { key: 'email', label: 'Email', type: 'text' },
  { key: 'address1', label: 'Address line 1', type: 'text' },
  { key: 'address2', label: 'Address line 2', type: 'text' },
  { key: 'address3', label: 'Town / city', type: 'text' },
  { key: 'postcode', label: 'Postcode', type: 'text' },
];

export function emptyExcludedPersonRecord() {
  return Object.fromEntries(EXCLUDED_PERSON_FIELD_SPECS.map((s) => [s.key, '']));
}
