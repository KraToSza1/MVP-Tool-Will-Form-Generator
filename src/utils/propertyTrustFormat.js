/**
 * Client-facing summary for Property Trust (guided) — for solicitor handoff, not the legal schedule text.
 */

const TRUST_TYPE_LABEL = {
  'life-interest': 'Life interest trust',
  discretionary: 'Discretionary trust',
  'nil-rate-band': 'Nil-rate band trust',
  'not-sure': 'To be confirmed with solicitor',
};

function trim(s) {
  if (s == null) return '';
  return String(s).trim();
}

function formatAddressLine(p) {
  if (!p || typeof p !== 'object') return '';
  const parts = [trim(p.addressLine1), trim(p.addressLine2), trim(p.town), trim(p.postcode)].filter(Boolean);
  return parts.join(', ');
}

/**
 * @param {Record<string, unknown>} formValues
 * @returns {{ id: string, label: string, addressLine1: string, addressLine2: string, town: string, postcode: string, tenure: string }[]}
 */
export function getPropertyAddressCandidates(formValues) {
  if (!formValues || typeof formValues !== 'object') return [];
  const out = [];

  const a1 = trim(formValues.address1);
  if (a1) {
    const line2 = trim(formValues.address2);
    const line3 = trim(formValues.address3);
    out.push({
      id: '__testator_home__',
      label: `${a1}, ${[line2, line3, trim(formValues.postcode)].filter(Boolean).join(', ')} (your address)`.replace(', ,', ','),
      addressLine1: a1,
      addressLine2: line2,
      town: line3 || line2,
      postcode: trim(formValues.postcode),
      tenure: '',
    });
  }

  const gifts = formValues.propertyGiftsList;
  if (Array.isArray(gifts)) {
    gifts.forEach((g, i) => {
      if (!g || typeof g !== 'object') return;
      const line1 = trim(g.addressLine1);
      if (!line1) return;
      const gTenure = trim(g.tenure);
      const id = g.id != null && String(g.id) !== '' ? `gift:${g.id}` : `gift:idx:${i}`;
      const addrShort = [line1, trim(g.town), trim(g.postcode)].filter(Boolean).join(', ');
      out.push({
        id,
        label: gTenure ? `${addrShort} (${gTenure})` : addrShort,
        addressLine1: line1,
        addressLine2: trim(g.addressLine2),
        town: trim(g.town),
        postcode: trim(g.postcode),
        tenure: gTenure,
      });
    });
  }

  return out;
}

/**
 * @param {Record<string, unknown>} formValues
 * @returns {string}
 */
export function formatPropertyTrustClientSummaryFromState(formValues) {
  if (!formValues || typeof formValues !== 'object') return '';
  const typeKey = trim(formValues.propertyTrustType);
  const typeLabel = TRUST_TYPE_LABEL[typeKey] || (typeKey ? typeKey : '');

  const fn = trim(formValues.propertyTrustLifeTenantFirstName);
  const ln = trim(formValues.propertyTrustLifeTenantLastName);
  const rel = trim(formValues.propertyTrustLifeTenantRelationship);
  const life = [fn, ln].filter(Boolean).join(' ');
  const lifeLine = life
    ? `Life tenant: ${life}${rel ? ` (${rel})` : ''}.`
    : '';

  const props = formValues.propertyTrustPropertiesList;
  const list = Array.isArray(props) ? props : [];
  const propLines = list
    .map((p) => formatAddressLine(p))
    .filter(Boolean)
    .map((line, i) => `Property ${i + 1}: ${line}.`);

  const parts = [];
  if (typeLabel) parts.push(`Trust type: ${typeLabel}.`);
  if (lifeLine) parts.push(lifeLine);
  if (propLines.length) parts.push(...propLines);
  return parts.join(' ').trim();
}
