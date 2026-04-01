/**
 * UK dd/mm/yyyy DOB → local Date (midnight).
 */
export function parseUkDate(dobStr) {
  if (dobStr == null || typeof dobStr !== 'string') return null;
  const m = String(dobStr).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  const y = Number(m[3]);
  if (!y || mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return null;
  return dt;
}

/** Age in whole years as of reference date (default: today, local). */
export function getAgeYearsFromDob(dobStr, asOf = new Date()) {
  const birth = parseUkDate(dobStr);
  if (!birth) return null;
  const ref = asOf instanceof Date ? asOf : new Date(asOf);
  let age = ref.getFullYear() - birth.getFullYear();
  const m = ref.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) age -= 1;
  return age;
}

export function executorDisplayName(item) {
  if (item == null) return 'This person';
  if (typeof item === 'string') {
    const s = item.trim();
    if (/aristone/i.test(s)) return 'Aristone Solicitors';
    return s || 'This person';
  }
  if (typeof item === 'object') {
    const t = [item.title, item.firstName, item.middleName, item.lastName].filter(Boolean).join(' ').trim();
    if (t) return t;
  }
  return 'This person';
}

export function isAristoneExecutorLine(item) {
  if (item == null) return false;
  if (typeof item === 'string') return /aristone/i.test(item);
  return false;
}

/** Rich person row from add-person modal (has structured fields). */
export function isRichPersonExecutorRow(item) {
  return item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Whether this executor row can act immediately (professional firm line, or age/tests pass).
 * canActAtAge: minimum age at which they may act per user choice; null = use default 18 for adults.
 */
export function canExecutorActImmediately({ item, ageYears, canActAtAge }) {
  if (isAristoneExecutorLine(item)) return true;
  if (typeof item === 'string' && !isRichPersonExecutorRow(item)) {
    // Legacy free-text line — assume can act if we can't compute age
    return true;
  }
  if (ageYears == null) return true;
  const threshold = typeof canActAtAge === 'number' && !Number.isNaN(canActAtAge) ? canActAtAge : 18;
  return ageYears >= threshold;
}
