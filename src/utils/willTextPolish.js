/**
 * Final wording tidy-up for Will clauses before they are drawn in the PDF.
 * Works on text that may contain the PDF generator's invisible bold markers ( … ) around
 * client-entered values, so every pattern tolerates those markers. Mariyam's template wording is not changed —
 * only joins between template text and client answers, duplicated fragments and punctuation.
 */
export const BOLD_START = '';
export const BOLD_END = '';
const M = '[\\uE001\\uE002]*'; // optional markers

const RELATIONSHIPS = [
  'Son-in-law', 'Daughter-in-law', 'Brother-in-law', 'Sister-in-law', 'Mother-in-law', 'Father-in-law',
  'Civil Partner', 'Step-son', 'Step-daughter', 'Stepson', 'Stepdaughter', 'Granddaughter', 'Grandson',
  'Grandmother', 'Grandfather', 'Goddaughter', 'Godson', 'Godmother', 'Godfather',
  'Friend', 'Sister', 'Brother', 'Mother', 'Father', 'Son', 'Daughter', 'Wife', 'Husband', 'Partner', 'Spouse',
  'Cousin', 'Aunt', 'Uncle', 'Niece', 'Nephew', 'Accountant', 'Solicitor', 'Colleague', 'Neighbour', 'Neighbor',
  'Carer', 'Business Partner',
];
const TITLES = 'Mr|Mrs|Ms|Miss|Mx|Dr|Prof|Professor|Sir|Dame|Lord|Lady|Rev';
const NAME_WORD = "[A-Z][A-Za-z'’-]*";
const NO_FULL_STOP_BEFORE = new Set(['which', 'that', 'whom', 'who', 'and', 'or', 'as', 'also', 'hereby', 'then', 'where', 'whereby', 'if', 'unless', 'so']);

/** "I appoint Friend Mr Felix Flint" → "I appoint Mr Felix Flint (my friend)"; "my Sister Mrs X" → "Mrs X (my sister)". */
export function moveRelationshipAfterName(text) {
  const rel = RELATIONSHIPS.sort((a, b) => b.length - a.length).map((r) => r.replace('-', '\\-')).join('|');
  const re = new RegExp(
    `\\b(?:my\\s+)?(${rel})\\s+(${M})((?:(?:${TITLES})\\.?\\s+)?${NAME_WORD}(?:\\s+${NAME_WORD}){0,4})(${M})(?=\\s+of\\b|,|;|\\s+as\\b|\\s+to\\b|\\s+from\\b|\\s+is\\b|\\s+assume\\b|\\s+care\\b|\\s*\\(|\\s*$)`,
    'g',
  );
  return text.replace(re, (all, relation, m1, name, m2) => {
    // A single capitalised word that is itself a title (e.g. "Sister Mr") is never a name on its own.
    if (new RegExp(`^(?:${TITLES})\\.?$`).test(name.trim())) return all;
    return `${m1}${name}${m2} (my ${relation.toLowerCase()})`;
  });
}

/** Ensure separate list items read as separate sentences: "…(date of birth 10/03/2020) I appoint …" → "…). I appoint …". */
export function separateRunOnSentences(text) {
  return text.replace(new RegExp(`(\\S+?)(${M})\\s+(I\\s+(?:give|appoint|make|request|wish|direct|declare|leave))\\b`, 'g'), (all, prevWord, markers, verb, offset, full) => {
    const bare = prevWord.replace(/[]/g, '');
    if (/[.,;:!?(]$/.test(bare)) return all;
    if (NO_FULL_STOP_BEFORE.has(bare.toLowerCase())) return all;
    if (/[—–-]$/.test(bare)) return all;
    // Only split after something that looks like the end of an item (word, number, closing bracket).
    if (!/[A-Za-z0-9)\]’']$/.test(bare)) return all;
    // Don't split the very first words of a clause.
    if (offset === 0) return all;
    void full;
    return `${prevWord}${markers}. ${verb}`;
  });
}

export function polishWillClauseText(text) {
  if (!text || typeof text !== 'string') return text;
  let s = text;

  // Duplicated fragment: "of my net estate of my net estate".
  s = s.replace(new RegExp(`of\\s+my\\s+net\\s+estate(${M})\\s+of\\s+my\\s+net\\s+estate`, 'gi'), 'of my net estate$1');

  // "I wish My ashes…" → "I wish my ashes…" (client answer starts with a capital after the template's "I wish").
  s = s.replace(new RegExp(`(\\bI\\s+wish\\s+(?:that\\s+)?${M})(My|The|That|Our)\\b`, 'g'), (m, lead, word) => `${lead}${word.toLowerCase()}`);

  // Double full stops across a marker: "Crematorium.<end>." → "Crematorium<end>."
  s = s.replace(new RegExp(`\\.(${M})\\s*\\.(?!\\.)`, 'g'), '$1.');

  // "forgive my Mr Darren Debtor" (empty relationship) → "forgive Mr Darren Debtor".
  s = s.replace(new RegExp(`\\bmy\\s+(${M})(${TITLES})\\b(?=\\.?\\s+[A-Z])`, 'g'), '$1$2');

  s = moveRelationshipAfterName(s);
  // Moving the relationship can leave "my Ms Penny Parker (my friend)" — drop the dangling "my" again.
  s = s.replace(new RegExp(`\\bmy\\s+(${M})(${TITLES})\\b(?=\\.?\\s+[A-Z])`, 'g'), '$1$2');
  s = separateRunOnSentences(s);

  // Clause should end with a full stop.
  const bare = s.replace(/[]/g, '').trim();
  if (bare && !/[.!?:;]$/.test(bare) && !/^\[/.test(bare)) s = `${s.trimEnd()}.`;
  return s;
}

/** Schedule references may carry bold markers around the number: "Schedule 5754690". */
export const SCHEDULE_REF_RE = new RegExp(`Schedule\\s+(${M})(\\d+)(${M})`, 'gi');
