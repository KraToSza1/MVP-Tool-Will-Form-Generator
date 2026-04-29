/**
 * Casing helpers used by clause/PDF formatters so client-typed names and
 * addresses always render as "First letter capital, rest lowercase" no matter
 * how the client typed them (ALL CAPS, all lowercase, etc.). Mixed-case input
 * is left untouched so that names the client deliberately styled (e.g. "iPad
 * Trust" or "MacDonald") still render correctly.
 */

const ROMAN_NUMERAL = /^(?:[ivxlcdm]+)$/i;
const ALL_CAPS_TOKENS = new Set([
  'UK',
  'USA',
  'EU',
  'NHS',
  'SRA',
  'JP',
  'DBS',
  'GP',
  'OBE',
  'MBE',
  'CBE',
  'KBE',
  'GBE',
  'KCMG',
  'DPHIL',
  'PHD',
  'BSC',
  'MSC',
  'BA',
  'MA',
  'LLB',
  'LLM',
  'CEO',
  'COO',
  'CFO',
  'MP',
  'QC',
  'KC',
  'JR',
  'SR',
  'TBA',
  'TBC',
  'PO',
]);

const NAME_PARTICLES = new Set([
  'von',
  'van',
  'de',
  'der',
  'den',
  'du',
  'des',
  'la',
  'le',
  'el',
  'da',
  'di',
  'do',
  'dos',
  'das',
  'al',
]);

const TITLE_TOKENS = new Map(
  [
    'Mr',
    'Mrs',
    'Ms',
    'Miss',
    'Mx',
    'Dr',
    'Prof',
    'Hon',
    'Sir',
    'Dame',
    'Rev',
    'Revd',
    'Fr',
    'Br',
    'Sr',
    'Lord',
    'Lady',
  ].map((t) => [t.toLowerCase(), t]),
);

function isAllUpper(s) {
  return /[A-Z]/.test(s) && s === s.toUpperCase() && !/[a-z]/.test(s);
}

function isAllLower(s) {
  return /[a-z]/.test(s) && s === s.toLowerCase() && !/[A-Z]/.test(s);
}

function shouldAutoCase(s) {
  if (!s) return false;
  return isAllUpper(s) || isAllLower(s);
}

function capWord(word) {
  if (!word) return word;
  if (TITLE_TOKENS.has(word.toLowerCase())) return TITLE_TOKENS.get(word.toLowerCase());
  if (ROMAN_NUMERAL.test(word) && word.length <= 4) return word.toUpperCase();
  if (ALL_CAPS_TOKENS.has(word.toUpperCase())) return word.toUpperCase();
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function capWordWithSubparts(word) {
  if (!word) return word;
  if (/^mc[a-z]/i.test(word)) {
    return 'Mc' + word.charAt(2).toUpperCase() + word.slice(3).toLowerCase();
  }
  if (/^mac[a-z]{2,}/i.test(word) && !ALL_CAPS_TOKENS.has(word.toUpperCase())) {
    return 'Mac' + word.charAt(3).toUpperCase() + word.slice(4).toLowerCase();
  }
  if (word.includes("'")) {
    return word
      .split("'")
      .map((part, idx) => (idx === 0 ? capWord(part) : capWord(part)))
      .join("'");
  }
  if (word.includes('-')) {
    return word.split('-').map(capWord).join('-');
  }
  if (word.includes('.')) {
    return word
      .split('.')
      .map((part, idx, arr) => (idx === arr.length - 1 ? capWord(part) : capWord(part)))
      .join('.');
  }
  return capWord(word);
}

/**
 * Title-case a person/firm name. Only auto-casts when the whole input is
 * either ALL CAPS or all lowercase — mixed-case is left as the client typed
 * it. Particles (de, van, of, …) become lowercase except as the first word.
 */
export function toProperNameCase(input) {
  if (input == null) return '';
  const s = String(input).trim();
  if (!s) return '';
  if (!shouldAutoCase(s)) return s;
  return s
    .split(/(\s+)/)
    .map((tok, idx) => {
      if (/^\s+$/.test(tok)) return tok;
      const lower = tok.toLowerCase();
      if (idx > 0 && NAME_PARTICLES.has(lower)) return lower;
      return capWordWithSubparts(tok);
    })
    .join('');
}

/**
 * Title-case an address fragment. Behaves like {@link toProperNameCase} but
 * preserves postcode-shaped tokens (e.g. "LU1", "1QG") in upper case so
 * "14 HIGHT STREET, LUTON, LU1 1QG" → "14 Hight Street, Luton, LU1 1QG".
 */
export function toProperAddressCase(input) {
  if (input == null) return '';
  const s = String(input).trim();
  if (!s) return '';
  if (!shouldAutoCase(s)) return s;
  let out = s.replace(/[A-Za-z\d][A-Za-z\d'.-]*/g, (token) => {
    // Pure number ("14"): leave alone
    if (/^\d+$/.test(token)) return token;
    // Postcode outward part ("LU1", "SW1A", "EC2N"): force upper
    if (/^[A-Za-z]{1,2}\d[A-Za-z\d]*$/.test(token)) return token.toUpperCase();
    // Postcode inward part / "12A" style: digit-led with trailing letters
    if (/^\d+[A-Za-z]+$/.test(token)) return token.toUpperCase();
    if (ALL_CAPS_TOKENS.has(token.toUpperCase())) return token.toUpperCase();
    return capWordWithSubparts(token);
  });
  out = out.replace(/\s*,\s*/g, ', ').replace(/\s{2,}/g, ' ').trim();
  return out;
}

/**
 * UK-style postcode normalisation: always uppercase, single space between
 * outward and inward parts when present. Non-postcode-looking values are
 * uppercased and trimmed but otherwise left alone.
 */
export function normalizePostcode(input) {
  if (input == null) return '';
  const raw = String(input).trim();
  if (!raw) return '';
  const compact = raw.replace(/\s+/g, '').toUpperCase();
  const m = compact.match(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/);
  if (m) return `${m[1]} ${m[2]}`;
  return compact;
}

/**
 * Convenience: title-case the testator's full name even when they typed it
 * "MARCUS ELLWOOD". Falls back gracefully on empty/non-string input.
 */
export function toProperPersonString(input) {
  return toProperNameCase(input);
}

/**
 * Apply name/address casing to a person row in-place style (returns a new
 * object). Operates on the standard person-record keys used across the app.
 */
export function normalizePersonRecordCasing(item) {
  if (!item || typeof item !== 'object') return item;
  const out = { ...item };
  const NAME_KEYS = ['title', 'firstName', 'middleName', 'middleNames', 'lastName', 'fullName', 'name'];
  const ADDR_KEYS = ['address1', 'address2', 'address3', 'addressLine1', 'addressLine2', 'town', 'city', 'county', 'address'];
  NAME_KEYS.forEach((k) => {
    if (typeof out[k] === 'string' && out[k]) out[k] = toProperNameCase(out[k]);
  });
  ADDR_KEYS.forEach((k) => {
    if (typeof out[k] === 'string' && out[k]) out[k] = toProperAddressCase(out[k]);
  });
  if (typeof out.postcode === 'string' && out.postcode) {
    out.postcode = normalizePostcode(out.postcode);
  }
  return out;
}
