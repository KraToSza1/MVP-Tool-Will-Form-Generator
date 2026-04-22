/**
 * Strict legal-style formatting for executor / trustee / digital-executor appointment lines (Will + PDF).
 * Does not affect PDF layout — output strings only.
 */
import {
  formatExcludedPersonForClause,
  EXCLUDED_PERSON_FIELD_SPECS,
  normalizeCountySpellingInLine,
} from './excludedPersonFormat.js';

function pickAllowedPersonFields(item) {
  const out = {};
  for (const spec of EXCLUDED_PERSON_FIELD_SPECS) {
    const v = item[spec.key];
    if (v != null && String(v).trim() !== '') out[spec.key] = String(v).trim();
  }
  return out;
}

const DEMO_STRIP = [
  /\s*\(demo\s+autofill[^)]*\)/gi,
  /\s*[—–-]\s*Will Tool demo(\s*data)?/gi,
  /\s*[—–-]\s*Digital executor.*$/i,
  /\s*\bdemo\s+autofill\b/gi,
];

/**
 * Legacy plain-string rows: strip demo/noise, emails, obvious phone/uuid tokens; normalize county.
 * If nothing usable remains, returns '' (omitted from joined list — safest for uncontrolled blobs).
 */
export function formatLegacyAppointmentString(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  DEMO_STRIP.forEach((re) => {
    s = s.replace(re, '');
  });
  s = s.replace(/\S+@\S+/g, ' ');
  s = s.replace(/\b(?:\+44|0)\d[\d\s\-()]{8,}\b/g, ' ');
  s = s.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '');
  s = normalizeCountySpellingInLine(s);
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length > 400) {
    const cut = s.slice(0, 400);
    const lastComma = cut.lastIndexOf(',');
    s = lastComma > 60 ? cut.slice(0, lastComma) : cut.trim();
  }
  return s.trim();
}

/**
 * One row: structured object → allowed fields only + {@link formatExcludedPersonForClause};
 * plain string → {@link formatLegacyAppointmentString}.
 */
export function formatAppointmentPersonForClause(item) {
  if (item == null) return '';
  if (typeof item === 'string') return formatLegacyAppointmentString(item);
  if (typeof item === 'object') {
    const picked = pickAllowedPersonFields(item);
    return formatExcludedPersonForClause(picked);
  }
  return '';
}

export function formatAppointmentPersonListForClause(arr) {
  if (!Array.isArray(arr)) return '';
  return arr.map(formatAppointmentPersonForClause).filter(Boolean).join('; ');
}

/**
 * Professional executor/trustee "Other" free-text: keep firm-style address lines only — strip emails,
 * labelled contact slots, phones; normalize county; cap length at a comma when possible.
 */
export function formatProfessionalOtherDetailsForClause(raw) {
  if (raw == null || typeof raw !== 'string') return '';
  let s = raw.trim();
  if (!s) return '';
  s = s.replace(/\S+@\S+/g, ' ');
  s = s.replace(/\b(?:tel|phone|mobile|email|contact)\s*[:#]\s*[^\s,;]+/gi, ' ');
  s = s.replace(/\b(?:\+44|0)\d[\d\s\-()]{8,}\b/g, ' ');
  s = normalizeCountySpellingInLine(s);
  s = s.replace(/\s{2,}/g, ' ').trim();
  if (s.length > 400) {
    const cut = s.slice(0, 400);
    const lastComma = cut.lastIndexOf(',');
    s = lastComma > 80 ? cut.slice(0, lastComma) : cut.trim();
  }
  return s.trim();
}
