/**
 * Build will-clause prose for specific (non-cash) gifts from structured list entries.
 * Kept in sync with SpecificGiftsListPanel save shape.
 */
const ITEM_TYPE_LABELS = {
  jewellery: 'Jewellery or watches',
  property: 'Property or land',
  vehicle: 'Vehicle (car, motorcycle, boat)',
  artwork: 'Artwork or antiques',
  furniture: 'Furniture or household items',
  financial: 'Financial account or investment',
  business: 'Business interest or shares',
  digital: 'Digital assets (accounts, crypto)',
  other: 'Other',
};

export function formatSpecificGiftsDetailsFromList(gifts) {
  if (!Array.isArray(gifts) || gifts.length === 0) return '';

  return gifts
    .map((g) => {
      if (!g || typeof g !== 'object') return '';
      const desc = String(g.itemDescription || '').trim();
      const recipient = String(g.recipientName || '').trim();
      if (!desc || !recipient) return '';

      const typeKey = String(g.itemType || '').trim();
      const typeL = typeKey ? ITEM_TYPE_LABELS[typeKey] || typeKey : '';

      let line = `I give ${desc}${typeL ? ` (${typeL})` : ''} to ${recipient}`;
      const rel = String(g.recipientRelationship || '').trim();
      if (rel) line += ` (${rel})`;
      const loc = String(g.itemLocation || '').trim();
      if (loc) line += `. Kept or located at: ${loc}`;

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
