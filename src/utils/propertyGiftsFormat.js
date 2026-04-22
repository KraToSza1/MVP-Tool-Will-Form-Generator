/**
 * Build will-clause prose for property gifts from structured list entries.
 * Kept in sync with PropertyGiftsGuided save shape.
 */

const TENURE_LABEL = {
  freehold: 'freehold',
  leasehold: 'leasehold',
  commonhold: 'commonhold',
};

const MORTGAGE_INSTRUCTION_LABEL = {
  'recipient-takes-over': 'The recipient is to take over the mortgage payments',
  'paid-from-estate': 'The mortgage is to be paid off from the estate before transfer',
  'solicitor-advise': 'The approach to the mortgage is to be advised by my solicitor',
};

function formatAddress(g) {
  if (!g || typeof g !== 'object') return '';
  const parts = [
    String(g.addressLine1 || '').trim(),
    String(g.addressLine2 || '').trim(),
    String(g.town || '').trim(),
    String(g.postcode || '').trim(),
  ].filter(Boolean);
  return parts.join(', ');
}

export function formatPropertyGiftsDetailsFromList(gifts) {
  if (!Array.isArray(gifts) || gifts.length === 0) return '';

  return gifts
    .map((g) => {
      if (!g || typeof g !== 'object') return '';
      const addr = formatAddress(g);
      const name = String(g.recipientName || '').trim();
      if (!addr || !name) return '';

      let line = `I give my property at ${addr} to ${name}`;

      const rel = String(g.recipientRelationship || '').trim();
      if (rel) line += ` (${rel})`;

      const tenure = String(g.tenure || '').trim();
      if (tenure && TENURE_LABEL[tenure]) {
        line += `. The property is ${TENURE_LABEL[tenure]}`;
      }

      const hm = g.hasMortgage;
      if (hm === 'yes') {
        const mid = String(g.mortgageInstruction || '').trim();
        if (mid && MORTGAGE_INSTRUCTION_LABEL[mid]) {
          line += `. With regard to any mortgage: ${MORTGAGE_INSTRUCTION_LABEL[mid]}`;
        } else {
          line += '. There is a mortgage on the property; my executors are to take appropriate steps in relation to it';
        }
      } else if (hm === 'unknown') {
        line += '. I am not sure whether there is a mortgage; my executors are to make enquiries and take appropriate action';
      }

      const cond = String(g.conditionLabel || '').trim();
      if (cond && cond !== 'None' && g.conditionKey) {
        line += `. ${cond}`;
      }

      const lapseKey = g.lapseKey;
      if (lapseKey && lapseKey !== 'residue') {
        const lapseLbl = String(g.lapseLabel || '').trim();
        if (lapseLbl) line += `. If this gift cannot take effect: ${lapseLbl}`;
      }

      return line;
    })
    .filter(Boolean)
    .join(' ');
}
