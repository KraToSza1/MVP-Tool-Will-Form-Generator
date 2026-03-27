/**
 * Partner / spouse fields collected in Marital Status (parallel to testator personal details).
 * Used for solicitor matter view and dashboard preview.
 */

const PARTNER_ROWS = [
  { label: 'Full name (as for Will)', key: 'partnerFullName' },
  { label: 'Title', key: 'partnerTitle' },
  { label: 'First name(s)', key: 'partnerFirstName' },
  { label: 'Middle name(s)', key: 'partnerMiddleName' },
  { label: 'Last name', key: 'partnerLastName' },
  { label: 'Known as', key: 'partnerKnownAs' },
  { label: 'Date of birth', key: 'partnerDateOfBirth' },
  { label: 'Gender', key: 'partnerGender' },
  { label: 'Mobile', key: 'partnerMobile' },
  { label: 'Tel 2', key: 'partnerTel2' },
  { label: 'Email', key: 'partnerEmail' },
  { label: 'Occupation', key: 'partnerOccupation' },
  { label: 'Country of nationality / citizenship', key: 'partnerNationalityCountry' },
  { label: 'Country of residence', key: 'partnerCountryOfResidence' },
  { label: 'Address line 1', key: 'partnerAddress1' },
  { label: 'Address line 2', key: 'partnerAddress2' },
  { label: 'Address line 3', key: 'partnerAddress3' },
  { label: 'Postcode', key: 'partnerPostcode' },
];

function trimStr(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * @param {Record<string, unknown> | null | undefined} payload - merged client + solicitor form payload
 * @returns {{ label: string, value: string }[]}
 */
export function getPartnerIntakeRows(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const rows = [];
  for (const { label, key } of PARTNER_ROWS) {
    const value = trimStr(payload[key]);
    if (value) rows.push({ label, value });
  }
  return rows;
}

/**
 * Short label for tables (dashboard row).
 * @param {Record<string, unknown> | null | undefined} payload
 * @returns {string}
 */
export function getPartnerShortLabel(payload) {
  if (!payload || typeof payload !== 'object') return '';
  const full = trimStr(payload.partnerFullName);
  if (full) return full;
  const parts = [payload.partnerTitle, payload.partnerFirstName, payload.partnerMiddleName, payload.partnerLastName]
    .filter((x) => trimStr(x))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (parts) return parts;
  return '';
}
