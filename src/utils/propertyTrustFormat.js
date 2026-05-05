/**
 * Client-facing summary for Property Trust (guided) — for solicitor handoff, not the legal schedule text.
 */

import { validateUKPostcode } from './ukValidations.js';
import { normalizePtReason } from '../lib/propertyTrustGuidedComplete.js';

const TRUST_TYPE_LABEL = {
  'life-interest': 'Life interest trust',
  discretionary: 'Discretionary trust',
  'nil-rate-band': 'Nil-rate band trust',
  'not-sure': 'To be confirmed with solicitor',
};

const PT_TENURE_LABEL = {
  freehold: 'Freehold',
  leasehold: 'Leasehold',
  unsure: 'Not sure',
};

const PT_SHARE_LABEL = {
  sole_owner: 'Sole owner',
  tic_50: 'Tenants in common — 50%',
  tic_other: 'Tenants in common — other split',
  joint_tenants: 'Joint tenants',
  unsure: 'Not sure — will check',
};

const PT_RIGHTS_LABEL = {
  occupy_free: 'Live rent-free for life',
  occupy_or_rent: 'Occupy or let and keep income',
  income_only: 'Income only',
  discuss: 'Discuss with solicitor',
};

const PT_SALE_LABEL = {
  trustees_consent_reinvest: 'Sale with proceeds following life tenant',
  trustees_reinvest_new_property: 'Replacement property for life tenant',
  no_sale_without_all: 'No sale without full consent',
  discuss: 'Discuss with solicitor',
};

const PT_REMAINDER_LABEL = {
  children_equally: 'Children equally',
  children_specified: 'Children — proportions later',
  named_others: 'Named individuals — to confirm',
  residue: 'Into residue',
  discuss: 'Discuss at appointment',
};

const PT_OVER_LABEL = {
  yes_include: 'Include overreaching protection',
  discuss: 'Discuss with solicitor',
};

const PT_REASON_LABEL = {
  protect_children: 'Protect children’s inheritance',
  care_fees: 'Care fees / means-testing',
  iht: 'Inheritance tax efficiency',
  family_home: 'Keep spouse/partner in the home',
};

function trim(s) {
  if (s == null) return '';
  return String(s).trim();
}

function formatAddressLine(p) {
  if (!p || typeof p !== 'object') return '';
  const parts = [trim(p.addressLine1), trim(p.addressLine2), trim(p.town), trim(p.postcode)].filter(Boolean);
  return parts.join(', ');
}

/** Normalize for comparison (not for display). */
function normalizeForDedupe(s) {
  if (s == null || s === '') return '';
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/[.,;]+/g, '')
    .replace(/\s+/g, ' ');
}

function normalizePostcodeForDedupe(s) {
  if (s == null || s === '') return '';
  return String(s).trim().toUpperCase().replace(/\s/g, '');
}

/**
 * Same property often appears on testator, partner, gifts, and trust. Town/line2 are split inconsistently, so
 * we key on address line 1 + postcode only—enough to collapse "your address" / "partner" / repeated gift rows.
 * Distinct units at the same number should use different line 1 (e.g. include flat) or line 2.
 */
function addressCandidateDedupeKey(c) {
  const a1 = normalizeForDedupe(c?.addressLine1);
  const pc = normalizePostcodeForDedupe(c?.postcode);
  if (!a1 && !pc) return `id:${c?.id ?? 'unknown'}`;
  return `${a1}::${pc}`;
}

function dedupeAddressCandidates(candidates) {
  const seen = new Set();
  const out = [];
  for (const item of candidates) {
    if (!item || typeof item !== 'object') continue;
    const k = addressCandidateDedupeKey(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

/** UK postcode on last line — best-effort split for partner free-text address. */
function splitPartnerAddressBlob(blob) {
  const raw = trim(blob);
  if (!raw) return null;
  const lines = raw.split(/\r?\n/).map((l) => trim(l)).filter(Boolean);
  if (!lines.length) return null;

  const lastLine = trim(lines[lines.length - 1]);
  const lastLooksLikePostcode = validateUKPostcode(lastLine);

  let postcode = '';
  let body = lines;
  if (lastLooksLikePostcode) {
    postcode = lastLine;
    body = lines.slice(0, -1);
  }

  const addressLine1 = body[0] || raw;
  const addressLine2 = body[1] || '';
  const town = body.length > 2 ? body.slice(2).join(', ') : '';

  return { addressLine1, addressLine2, town, postcode };
}

/**
 * @param {Record<string, unknown>} formValues
 * @returns {{ id: string, label: string, addressLine1: string, addressLine2: string, town: string, postcode: string, tenure: string }[]}
 */
export function getPropertyAddressCandidates(formValues) {
  if (!formValues || typeof formValues !== 'object') return [];
  const out = [];

  const a1 =
    trim(formValues.personalinformationAddressAddress1) ||
    trim(formValues.address1);
  if (a1) {
    const line2 =
      trim(formValues.personalinformationAddressAddress2) ||
      trim(formValues.address2);
    const line3 =
      trim(formValues.personalinformationAddressAddress3) ||
      trim(formValues.address3);
    const pc =
      trim(formValues.personalinformationAddressPostcode) ||
      trim(formValues.postcode);
    out.push({
      id: '__testator_home__',
      label: `${a1}, ${[line2, line3, pc].filter(Boolean).join(', ')} (your address)`.replace(', ,', ','),
      addressLine1: a1,
      addressLine2: line2,
      town: line3 || line2,
      postcode: pc,
      tenure: '',
    });
  }

  const pAddr1 = trim(formValues.partnerAddress1);
  if (pAddr1) {
    const pLine2 = trim(formValues.partnerAddress2);
    const pLine3 = trim(formValues.partnerAddress3);
    const pPc = trim(formValues.partnerPostcode);
    out.push({
      id: '__partner_home__',
      label: `${[pAddr1, pLine2, pLine3, pPc].filter(Boolean).join(', ')} (partner / spouse)`,
      addressLine1: pAddr1,
      addressLine2: pLine2,
      town: pLine3,
      postcode: pPc,
      tenure: '',
    });
  } else {
    const blobSplit = splitPartnerAddressBlob(formValues.partnerAddress);
    if (blobSplit && blobSplit.addressLine1) {
      const { addressLine1, addressLine2, town, postcode } = blobSplit;
      const labelTail = [addressLine2, town, postcode].filter(Boolean).join(', ');
      out.push({
        id: '__partner_home__',
        label: labelTail ? `${addressLine1}, ${labelTail} (partner / spouse)` : `${addressLine1} (partner / spouse)`,
        addressLine1,
        addressLine2,
        town,
        postcode,
        tenure: '',
      });
    }
  }

  const gifts = formValues.propertyGiftsList;
  if (Array.isArray(gifts)) {
    gifts.forEach((g, i) => {
      if (!g || typeof g !== 'object') return;
      const line1 = trim(g.addressLine1);
      if (!line1) return;
      const gTenure = trim(g.tenure);
      const id = g.id != null && String(g.id) !== '' ? `gift:${g.id}` : `gift:idx:${i}`;
      const addrShort = [line1, trim(g.town), trim(g.postcode)].filter(Boolean).join(', ');
      out.push({
        id,
        label: gTenure ? `${addrShort} (${gTenure})` : addrShort,
        addressLine1: line1,
        addressLine2: trim(g.addressLine2),
        town: trim(g.town),
        postcode: trim(g.postcode),
        tenure: gTenure,
      });
    });
  }

  const trustList = formValues.propertyTrustPropertiesList;
  if (Array.isArray(trustList)) {
    trustList.forEach((p, i) => {
      if (!p || typeof p !== 'object') return;
      const line1 = trim(p.addressLine1);
      if (!line1) return;
      const tTen = trim(p.tenure);
      const id = p.id != null && String(p.id) !== '' ? `ptrust:${p.id}` : `ptrust:idx:${i}`;
      const addrShort = [line1, trim(p.town), trim(p.postcode)].filter(Boolean).join(', ');
      out.push({
        id,
        label: tTen
          ? `Property already in this trust — ${addrShort} (${tTen})`
          : `Property already in this trust — ${addrShort}`,
        addressLine1: line1,
        addressLine2: trim(p.addressLine2),
        town: trim(p.town),
        postcode: trim(p.postcode),
        tenure: tTen,
      });
    });
  }

  return dedupeAddressCandidates(out);
}

/**
 * @param {Record<string, unknown>} formValues
 * @returns {string}
 */
export function formatPropertyTrustClientSummaryFromState(formValues) {
  if (!formValues || typeof formValues !== 'object') return '';
  const typeKey = trim(formValues.propertyTrustType);
  const typeLabel = TRUST_TYPE_LABEL[typeKey] || (typeKey ? typeKey : '');

  const fn = trim(formValues.propertyTrustLifeTenantFirstName);
  const ln = trim(formValues.propertyTrustLifeTenantLastName);
  const rel = trim(formValues.propertyTrustLifeTenantRelationship);
  const life = [fn, ln].filter(Boolean).join(' ');
  const lifeLine = life
    ? `Life tenant: ${life}${rel ? ` (${rel})` : ''}.`
    : '';

  const props = formValues.propertyTrustPropertiesList;
  const list = Array.isArray(props) ? props : [];
  const propLines = list
    .map((p) => formatAddressLine(p))
    .filter(Boolean)
    .map((line, i) => `Property ${i + 1}: ${line}.`);

  const parts = [];
  if (typeLabel) parts.push(`Trust type: ${typeLabel}.`);
  if (lifeLine) parts.push(lifeLine);
  if (propLines.length) parts.push(...propLines);

  const tenure = trim(formValues.pt_tenure);
  if (tenure) parts.push(`Tenure (main property): ${PT_TENURE_LABEL[tenure] || tenure}.`);

  const share = trim(formValues.pt_ownership_share);
  if (share) parts.push(`Ownership: ${PT_SHARE_LABEL[share] || share}.`);

  const rights = trim(formValues.pt_life_tenant_rights);
  if (rights) parts.push(`Life tenant rights: ${PT_RIGHTS_LABEL[rights] || rights}.`);

  const sale = trim(formValues.pt_sale_instruction);
  if (sale) parts.push(`If life tenant sells or moves: ${PT_SALE_LABEL[sale] || sale}.`);

  const remainder = trim(formValues.pt_remainder_beneficiaries);
  if (remainder) parts.push(`Remainder beneficiaries: ${PT_REMAINDER_LABEL[remainder] || remainder}.`);

  const over = trim(formValues.pt_overreaching);
  if (over) parts.push(`Overreaching: ${PT_OVER_LABEL[over] || over}.`);

  const reasons = normalizePtReason(formValues.pt_reason).map((r) => PT_REASON_LABEL[r] || r);
  if (reasons.length) parts.push(`Reasons: ${reasons.join('; ')}.`);

  const notes = trim(formValues.pt_notes);
  if (notes) parts.push(`Notes: ${notes}`);

  return parts.join(' ').trim();
}

/**
 * Structured question / answer lines for solicitor review (e.g. quick-action modal).
 * One row per client answer — readable for drafting; not a single compressed paragraph.
 * @param {Record<string, unknown>} formValues
 * @returns {{ label: string, value: string }[]}
 */
export function getPropertyTrustSolicitorReviewRows(formValues) {
  if (!formValues || typeof formValues !== 'object') return [];
  const rows = [];

  const typeKey = trim(formValues.propertyTrustType);
  if (typeKey) {
    rows.push({
      label: 'What type of property trust does the client want?',
      value: TRUST_TYPE_LABEL[typeKey] || typeKey,
    });
  }

  const fn = trim(formValues.propertyTrustLifeTenantFirstName);
  const ln = trim(formValues.propertyTrustLifeTenantLastName);
  const rel = trim(formValues.propertyTrustLifeTenantRelationship);
  const name = [fn, ln].filter(Boolean).join(' ');
  if (name || rel) {
    const bits = [];
    if (name) bits.push(name);
    if (rel) bits.push(`Relationship: ${rel}`);
    rows.push({
      label: 'Who is the life tenant?',
      value: bits.join('\n'),
    });
  }

  const list = Array.isArray(formValues.propertyTrustPropertiesList)
    ? formValues.propertyTrustPropertiesList
    : [];
  list.forEach((p, i) => {
    if (!p || typeof p !== 'object') return;
    const line = formatAddressLine(p);
    const line1 = trim(p.addressLine1);
    if (!line && !line1) return;
    const tRaw = trim(p.tenure);
    const tenureBit = tRaw ? `Tenure noted for this property: ${PT_TENURE_LABEL[tRaw] || tRaw}` : '';
    const value = [line || line1, tenureBit].filter(Boolean).join('\n');
    rows.push({
      label:
        list.length > 1 ? `Property ${i + 1} — address going into the trust` : 'Property address going into the trust',
      value,
    });
  });

  const tenure = trim(formValues.pt_tenure);
  if (tenure) {
    rows.push({
      label: 'Main trust property — tenure (how the title is held)',
      value: PT_TENURE_LABEL[tenure] || tenure,
    });
  }

  const share = trim(formValues.pt_ownership_share);
  if (share) {
    rows.push({
      label: 'Ownership / share (sole, tenants in common, joint tenants, etc.)',
      value: PT_SHARE_LABEL[share] || share,
    });
  }

  const rights = trim(formValues.pt_life_tenant_rights);
  if (rights) {
    rows.push({
      label: 'Life tenant’s rights during their lifetime',
      value: PT_RIGHTS_LABEL[rights] || rights,
    });
  }

  const sale = trim(formValues.pt_sale_instruction);
  if (sale) {
    rows.push({
      label: 'If the life tenant sells or moves — client’s preference',
      value: PT_SALE_LABEL[sale] || sale,
    });
  }

  const remainder = trim(formValues.pt_remainder_beneficiaries);
  if (remainder) {
    rows.push({
      label: 'Who inherits after the life interest ends?',
      value: PT_REMAINDER_LABEL[remainder] || remainder,
    });
  }

  const over = trim(formValues.pt_overreaching);
  if (over) {
    rows.push({
      label: 'Overreaching / protection on sale',
      value: PT_OVER_LABEL[over] || over,
    });
  }

  const reasons = normalizePtReason(formValues.pt_reason);
  if (reasons.length) {
    const text = reasons.map((r) => `• ${PT_REASON_LABEL[r] || r}`).join('\n');
    rows.push({
      label: 'Why does the client want this trust?',
      value: text,
    });
  }

  return rows;
}

/**
 * Draft solicitor wording from client's structured trust properties (schedule/terms still added by solicitor).
 * @param {Record<string, unknown>} formValues
 * @returns {string}
 */
export function buildPropertyTrustDetailsDraftFromClient(formValues) {
  const list = Array.isArray(formValues?.propertyTrustPropertiesList)
    ? formValues.propertyTrustPropertiesList
    : [];
  const lines = list.map((p) => formatAddressLine(p)).filter(Boolean);
  if (!lines.length) return '';
  if (lines.length === 1) {
    return `The trust property at ${lines[0]}.`;
  }
  const numbered = lines.map((l, i) => `${i + 1}) ${l}`);
  return `The trust properties are: ${numbered.join('; ')}.`;
}
