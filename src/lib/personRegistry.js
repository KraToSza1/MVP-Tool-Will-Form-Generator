/**
 * Central contact registry + candidate list for "same person" prefill in PersonRecordModal.
 * Stored on form payload as `contactRegistry` (array of { id, ...person fields }).
 */

import { PEOPLE_ARRAY_KEYS } from './formPeopleSummary.js';
import { emptyPersonRecord } from '../utils/personRecordSpecs.js';

export const CONTACT_REGISTRY_KEY = 'contactRegistry';

const LOG =
  typeof import.meta !== 'undefined' &&
  (import.meta.env?.DEV || import.meta.env?.VITE_DEBUG_PERSON_FLOW === 'true');

function logPerson(...args) {
  if (LOG) console.log('[WillTool Person]', ...args);
}

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

function newContactId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function ensureContactRegistry(formValues) {
  const raw = formValues?.[CONTACT_REGISTRY_KEY];
  return Array.isArray(raw) ? raw : [];
}

/**
 * Merge trimmed person record into registry (dedupe by id).
 * @param {Record<string, unknown>} prevFormValues
 * @param {Record<string, unknown>} personRecord — row going into a *Data array (may include _personRecordId)
 * @returns {Record<string, unknown>}
 */
export function upsertRegistryContact(prevFormValues, personRecord) {
  const id = personRecord._personRecordId || newContactId();
  const entry = {
    id,
    savedAt: new Date().toISOString(),
  };
  for (const k of Object.keys(personRecord)) {
    if (k.startsWith('_')) continue;
    entry[k] = personRecord[k];
  }
  const fp = personFingerprint(entry);
  const reg = ensureContactRegistry(prevFormValues).filter((e) => {
    if (!e) return false;
    if (e.id === id) return false;
    if (fp && personFingerprint(e) === fp) return false;
    return true;
  });
  reg.push(entry);
  logPerson('registry_upsert', { id, registrySize: reg.length });
  return {
    ...prevFormValues,
    [CONTACT_REGISTRY_KEY]: reg,
  };
}

function labelFromData(data) {
  if (!data || typeof data !== 'object') return '(unnamed)';
  const n = [data.title, data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ').trim();
  if (n) return n;
  if (data.knownAs) return trim(data.knownAs);
  if (data.fullName) return trim(data.fullName);
  return '(unnamed)';
}

function personFingerprint(data) {
  if (!data || typeof data !== 'object') return '';
  return [
    trim(data.firstName),
    trim(data.lastName),
    trim(data.dateOfBirth),
  ].join('|').toLowerCase();
}

function buildTestatorRecord(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const fn = trim(payload.firstName);
  const ln = trim(payload.lastName);
  const full = trim(payload.fullName);
  if (!fn && !ln && !full) return null;
  return {
    ...emptyPersonRecord(),
    title: trim(payload.title),
    firstName: fn,
    middleName: trim(payload.middleName),
    lastName: ln,
    dateOfBirth: trim(payload.dateOfBirth),
    gender: trim(payload.gender),
    mobile: trim(payload.mobile),
    email: trim(payload.email),
    address1: trim(payload.address1),
    address2: trim(payload.address2),
    address3: trim(payload.address3),
    postcode: trim(payload.postcode),
    occupation: trim(payload.occupation),
    nationalityCountry: trim(payload.nationalityCountry),
    countryOfResidence: trim(payload.countryOfResidence),
  };
}

function buildPartnerRecord(payload) {
  if (!payload || typeof payload !== 'object') return null;
  const fn = trim(payload.partnerFirstName);
  const ln = trim(payload.partnerLastName);
  const full = trim(payload.partnerFullName);
  if (!fn && !ln && !full) return null;
  return {
    ...emptyPersonRecord(),
    title: trim(payload.partnerTitle),
    firstName: fn,
    middleName: trim(payload.partnerMiddleName),
    lastName: ln,
    knownAs: trim(payload.partnerKnownAs),
    dateOfBirth: trim(payload.partnerDateOfBirth),
    gender: trim(payload.partnerGender),
    mobile: trim(payload.partnerMobile),
    email: trim(payload.partnerEmail),
    address1: trim(payload.partnerAddress1),
    address2: trim(payload.partnerAddress2),
    address3: trim(payload.partnerAddress3),
    postcode: trim(payload.partnerPostcode),
    occupation: trim(payload.partnerOccupation),
    nationalityCountry: trim(payload.partnerNationalityCountry),
    countryOfResidence: trim(payload.partnerCountryOfResidence),
    relationship: 'Partner / spouse (from intake)',
  };
}

/**
 * Options for "Use someone already entered" in PersonRecordModal.
 * @returns {{ id: string, label: string, source: string, data: Record<string, string> }[]}
 */
export function getContactCandidates(formValues) {
  if (!formValues || typeof formValues !== 'object') return [];

  const out = [];
  const seenIds = new Set();
  const seenFingerprints = new Set();

  const push = (id, label, source, data) => {
    if (!data || typeof data !== 'object') return;
    const idKey = `${source}:${id}`;
    if (seenIds.has(idKey)) return;
    seenIds.add(idKey);
    const fp = personFingerprint(data);
    if (fp && seenFingerprints.has(fp)) return;
    if (fp) seenFingerprints.add(fp);
    out.push({ id, label, source, data: { ...data } });
  };

  for (const c of ensureContactRegistry(formValues)) {
    if (c?.id) {
      const { id, savedAt: _s, ...rest } = c;
      push(id, `${labelFromData(rest)} (saved contact)`, 'registry', rest);
    }
  }

  const testator = buildTestatorRecord(formValues);
  if (testator) {
    push('__testator__', `Testator — ${labelFromData(testator)}`, 'testator', testator);
  }

  const partner = buildPartnerRecord(formValues);
  if (partner) {
    push('__partner__', `Partner / spouse — ${labelFromData(partner)}`, 'partner', partner);
  }

  for (const { key } of PEOPLE_ARRAY_KEYS) {
    const raw = formValues[key];
    if (!raw) continue;
    const arr = Array.isArray(raw) ? raw : [raw];
    arr.forEach((item, i) => {
      if (item == null || typeof item !== 'object') return;
      const lab = labelFromData(item);
      push(`scan:${key}:${i}`, `${key} #${i + 1} — ${lab}`, `array:${key}`, { ...emptyPersonRecord(), ...item });
    });
  }

  logPerson('candidates_built', { count: out.length, keys: out.map((o) => o.id) });
  return out;
}

export function trimPersonRecord(draft) {
  const o = {};
  for (const [k, v] of Object.entries(draft)) {
    const t = trim(v);
    if (t) o[k] = t;
  }
  return o;
}

export function validatePersonRecordMin(o) {
  const fn = trim(o.firstName);
  const ln = trim(o.lastName);
  const a1 = trim(o.address1);
  const pc = trim(o.postcode);
  return !!(fn && ln) && !!(a1 || pc);
}

/**
 * Prepare stored row + registry id for a *Data array.
 */
export function finalizePersonRecordForSave(draft, prefillSourceId) {
  const trimmed = trimPersonRecord(draft);
  const id = newContactId();
  const row = {
    ...trimmed,
    _personRecordId: id,
    _prefillSource: prefillSourceId || undefined,
  };
  logPerson('finalize_save', {
    personRecordId: id,
    prefillSource: prefillSourceId || null,
    keys: Object.keys(trimmed),
  });
  return row;
}
