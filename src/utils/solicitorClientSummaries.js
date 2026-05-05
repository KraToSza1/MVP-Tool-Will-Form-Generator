/**
 * Read-only intake lines for solicitor quick-action modals (merged client + solicitor payload).
 */

import { getPropertyTrustSolicitorReviewRows } from './propertyTrustFormat.js';

function trim(s) {
  if (s == null) return '';
  return String(s).trim();
}

const BIZ_TYPE_LABEL = {
  shares_majority: 'Shares in a limited company — majority owner (over 50%)',
  shares_minority: 'Shares in a limited company — minority stake (under 50%)',
  director_only: 'Directorship only — no share ownership',
  sole_trader: 'Sole trader or self-employed',
  partnership: 'Business partnership (traditional)',
  llp: 'LLP interest',
  aim: 'AIM-listed shares or EIS investments',
  family_company: 'Family company (including dormant)',
  other: 'Other — client will explain',
};

const BIZ_PCT_LABEL = {
  100: '100% — owns entirely',
  majority: 'More than 50%',
  '25to50': '25% to 50%',
  under25: 'Under 25%',
  unsure: 'Not sure',
};

const BIZ_SOLE_LABEL = {
  sole: 'In client’s name alone',
  spouse: 'Jointly with spouse or partner',
  partners: 'Jointly with business partners',
};

const BIZ_DURATION_LABEL = {
  over2: 'More than 2 years',
  '1to2': 'Between 1 and 2 years',
  under1: 'Less than 1 year — recently acquired',
  unsure: 'Not sure',
};

const BIZ_VALUE_LABEL = {
  under100k: 'Under £100k',
  '100to250k': '£100k – £250k',
  '250to500k': '£250k – £500k',
  '500kto1m': '£500k – £1m',
  over1m: 'Over £1m',
  unsure: 'Not sure',
};

const BIZ_TRI = {
  yes: 'Yes',
  no: 'No',
  unsure: 'Not sure',
  discuss: 'Discuss with solicitor',
};

const BIZ_NATURE_LABEL = {
  trading: 'Actively trading',
  dormant: 'Dormant / not actively trading',
  mixed: 'Mixed — client will explain',
  unsure: 'Not sure',
};

const BIZ_BEN_LABEL = {
  children: 'Children',
  spouse_then_children: 'Spouse first, then children',
  wider_family: 'Wider family',
  other: 'Other — to be confirmed',
};

const BIZ_FALLBACK_LABEL = {
  residue: 'Fall into residue',
  spouse: 'Pass to spouse',
  children: 'Pass to children directly',
  discuss: 'Discuss with solicitor',
};

/**
 * @param {Record<string, unknown>} merged
 * @returns {{ label: string, value: string }[]}
 */
export function formatBusinessInterestsIntakeRows(merged) {
  if (!merged || typeof merged !== 'object') return [];
  const rows = [];

  const gw = trim(merged.biz_has_interests);
  if (gw) {
    rows.push({
      label: 'Business interests',
      value:
        gw === 'yes'
          ? 'Yes — client gave details'
          : gw === 'no'
            ? 'No business interests'
            : gw === 'unsure'
              ? 'Not sure — discuss before drafting'
              : gw,
    });
  }

  if (gw !== 'yes' && gw !== 'unsure') return rows;

  const t = trim(merged.biz_type);
  if (t) rows.push({ label: 'Type of interest', value: BIZ_TYPE_LABEL[t] || t });

  const op = trim(merged.biz_ownership_pct);
  if (op) rows.push({ label: 'Rough ownership %', value: BIZ_PCT_LABEL[op] || op });

  const os = trim(merged.biz_ownership_sole);
  if (os) rows.push({ label: 'Ownership holding', value: BIZ_SOLE_LABEL[os] || os });

  const dur = trim(merged.biz_duration);
  if (dur) rows.push({ label: 'How long owned', value: BIZ_DURATION_LABEL[dur] || dur });

  const val = trim(merged.biz_value);
  if (val) rows.push({ label: 'Estimated value', value: BIZ_VALUE_LABEL[val] || val });

  const ag = trim(merged.biz_agreement);
  if (ag) rows.push({ label: 'Shareholders’ / partnership agreement', value: BIZ_TRI[ag] || ag });

  const nat = trim(merged.biz_nature);
  if (nat) rows.push({ label: 'Trading status', value: BIZ_NATURE_LABEL[nat] || nat });

  const btc = trim(merged.biz_trustees_continue);
  if (btc) rows.push({ label: 'Trustees continuing the business', value: BIZ_TRI[btc] || btc });

  const bb = trim(merged.biz_beneficiaries);
  if (bb) rows.push({ label: 'Who benefits after death', value: BIZ_BEN_LABEL[bb] || bb });

  const st = trim(merged.biz_separate_trustee);
  if (st) rows.push({ label: 'Separate business trustee', value: BIZ_TRI[st] || st });

  const fb = trim(merged.biz_fallback);
  if (fb) rows.push({ label: 'If separate trustee cannot act', value: BIZ_FALLBACK_LABEL[fb] || fb });

  const notes = trim(merged.biz_notes);
  if (notes) rows.push({ label: 'Client notes', value: notes });

  return rows;
}

/**
 * @param {Record<string, unknown>} merged
 * @returns {{ label: string, value: string }[]}
 */
export function formatPropertyTrustIntakeRows(merged) {
  if (!merged || typeof merged !== 'object') return [];
  const rows = [];

  const inc = trim(merged.includePropertyTrust);
  const wants = trim(merged.pt_wants_trust);
  const gateway =
    wants === 'yes'
      ? 'Yes — include property trust'
      : wants === 'advise'
        ? 'Advise me — discuss before drafting'
        : wants === 'no'
          ? 'No property trust'
          : inc === 'Yes'
            ? 'Yes — include property trust'
            : inc === 'Unsure'
              ? 'Advise me — discuss before drafting'
              : inc === 'No'
                ? 'No property trust'
                : '';

  if (gateway) rows.push({ label: 'Property trust', value: gateway });

  if (inc !== 'Yes' && inc !== 'Unsure') return rows;

  const qa = getPropertyTrustSolicitorReviewRows(merged);
  rows.push(...qa);
  if (qa.length === 0) {
    rows.push({
      label: 'Questionnaire answers',
      value:
        'No structured property-trust answers were saved yet. Open the matter questionnaire or guided flow to capture them.',
    });
  }

  const notes = trim(merged.pt_notes);
  if (notes) rows.push({ label: 'Client’s additional notes (free text)', value: notes });

  return rows;
}