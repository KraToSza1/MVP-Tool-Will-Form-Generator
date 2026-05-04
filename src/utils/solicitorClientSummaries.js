/**
 * Read-only intake lines for solicitor quick-action modals (merged client + solicitor payload).
 */

import { formatPropertyTrustClientSummaryFromState } from './propertyTrustFormat.js';
import { normalizePtReason } from '../lib/propertyTrustGuidedComplete.js';

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

const PT_TENURE_LABEL = {
  freehold: 'Freehold',
  leasehold: 'Leasehold',
  unsure: 'Not sure',
};

const PT_SHARE_LABEL = {
  sole_owner: 'Sole owner — entire property',
  tic_50: 'Tenants in common — 50% share',
  tic_other: 'Tenants in common — different split (to confirm)',
  joint_tenants: 'Joint tenants — severance may be needed',
  unsure: 'Not sure — will check',
};

const PT_RIGHTS_LABEL = {
  occupy_free: 'Live rent-free for life',
  occupy_or_rent: 'Live there or let and keep income',
  income_only: 'Income only (not occupation)',
  discuss: 'Discuss with solicitor',
};

const PT_SALE_LABEL = {
  trustees_consent_reinvest: 'Sale agreed — proceeds follow life tenant',
  trustees_reinvest_new_property: 'Trustees may buy replacement home',
  no_sale_without_all: 'No sale without all trustees + remainder consent',
  discuss: 'Discuss with solicitor',
};

const PT_REMAINDER_LABEL = {
  children_equally: 'Children equally',
  children_specified: 'Children — proportions at appointment',
  named_others: 'Named individuals — to confirm',
  residue: 'Fall into residue',
  discuss: 'Discuss at appointment',
};

const PT_OVER_LABEL = {
  yes_include: 'Include overreaching protection (recommended)',
  discuss: 'Discuss with solicitor',
};

const PT_REASON_LABEL = {
  protect_children: 'Protect children’s inheritance',
  care_fees: 'Care fees / means-testing',
  iht: 'Inheritance tax / nil-rate band',
  family_home: 'Keep spouse/partner in the home',
};

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

  const summary = formatPropertyTrustClientSummaryFromState(merged);
  if (summary) rows.push({ label: 'Client summary (auto)', value: summary });

  const notes = trim(merged.pt_notes);
  if (notes) rows.push({ label: 'Additional notes', value: notes });

  return rows;
}

/** Compact rows for clause stub (property trust) */
export function formatPropertyTrustStubLines(merged) {
  const base = formatPropertyTrustClientSummaryFromState(merged || {});
  const extras = [];
  const ten = trim(merged?.pt_tenure);
  if (ten) extras.push(`Tenure: ${PT_TENURE_LABEL[ten] || ten}`);
  const sh = trim(merged?.pt_ownership_share);
  if (sh) extras.push(`Ownership: ${PT_SHARE_LABEL[sh] || sh}`);
  const rt = trim(merged?.pt_life_tenant_rights);
  if (rt) extras.push(`Life tenant rights: ${PT_RIGHTS_LABEL[rt] || rt}`);
  const sl = trim(merged?.pt_sale_instruction);
  if (sl) extras.push(`If life tenant sells: ${PT_SALE_LABEL[sl] || sl}`);
  const rm = trim(merged?.pt_remainder_beneficiaries);
  if (rm) extras.push(`Remainder: ${PT_REMAINDER_LABEL[rm] || rm}`);
  const ov = trim(merged?.pt_overreaching);
  if (ov) extras.push(`Overreaching: ${PT_OVER_LABEL[ov] || ov}`);
  const reasons = normalizePtReason(merged?.pt_reason).map((r) => PT_REASON_LABEL[r] || r);
  if (reasons.length) extras.push(`Reasons: ${reasons.join('; ')}`);
  const fn = trim(merged?.propertyTrustLifeTenantFirstName);
  const ln = trim(merged?.propertyTrustLifeTenantLastName);
  const rel = trim(merged?.propertyTrustLifeTenantRelationship);
  const life = [fn, ln].filter(Boolean).join(' ');
  if (life) extras.push(`Life tenant: ${life}${rel ? ` (${rel})` : ''}`);

  return [base, extras.filter(Boolean).join('\n')].filter(Boolean).join('\n\n');
}

/**
 * @param {Record<string, unknown>} merged
 * @returns {string}
 */
export function buildBprTrustTermsStub(merged) {
  const lines = formatBusinessInterestsIntakeRows(merged || {});
  const body = lines.length
    ? lines.map((r) => `${r.label}: ${r.value}`).join('\n')
    : '(No structured business intake captured — replace with agreed terms.)';

  return `[Draft stub — not legal advice]\n\nBUSINESS PROPERTY RELIEF TRUST\n\n${body}\n\nTrustees to hold the qualifying business property on the agreed terms. Solicitor to replace this stub with final clause wording, schedule cross-reference, and any limitations.`;
}

/**
 * @param {Record<string, unknown>} merged
 * @returns {string}
 */
export function buildPropertyTrustTermsStub(merged) {
  const block = formatPropertyTrustStubLines(merged || {});
  return `[Draft stub — not legal advice]\n\nPROPERTY TRUST\n\n${block || '(No client property-trust intake captured.)'}\n\nSolicitor to replace with final trust wording, powers of trustees, overreaching provisions, and schedule reference as appropriate.`;
}
