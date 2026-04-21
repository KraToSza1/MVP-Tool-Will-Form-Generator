/**
 * Build will-clause prose for monetary gifts from structured list entries.
 * Kept in sync with MonetaryGiftsListPanel save shape.
 */
export function formatMonetaryGiftsDetailsFromList(gifts) {
  if (!Array.isArray(gifts) || gifts.length === 0) return '';

  return gifts
    .map((g) => {
      if (!g || typeof g !== 'object') return '';
      const name = String(g.recipientName || '').trim();
      if (!name) return '';

      const rawAmount = g.amount;
      let amountNum =
        typeof rawAmount === 'number' && Number.isFinite(rawAmount)
          ? rawAmount
          : parseFloat(String(rawAmount || '').replace(/[£,\s]/g, ''), 10);
      if (!Number.isFinite(amountNum) || amountNum <= 0) return '';

      const amountStr = amountNum.toLocaleString('en-GB', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });

      let line = `I give £${amountStr} to ${name}`;
      const rel = String(g.recipientRelationship || '').trim();
      if (rel) line += ` (${rel})`;

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
