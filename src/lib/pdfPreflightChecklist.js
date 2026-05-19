/**
 * Conservative PDF preflight for solicitors — reports pass / needs review, not legal approval.
 */
import {
  OUTSTANDING_CATEGORY,
  getMergedMatterPayload,
  getMatterOutstandingCategories,
  getMissingIdVerificationDocs,
  isMatterTestamentaryCapacityOutstanding,
} from './matterOutstanding.js';

/** Form section titles (must match questionnaire JSON). */
export const PREFLIGHT_SECTION = {
  PERSONAL: 'Personal Information',
  EXECUTORS: 'Trustees/Executors',
  RESIDUE: 'Estate Administration/Residue',
  TC: 'Testamentary Capacity',
};

const CRITICAL_KEY_TO_SECTION = {
  firstName: PREFLIGHT_SECTION.PERSONAL,
  lastName: PREFLIGHT_SECTION.PERSONAL,
  executorData: PREFLIGHT_SECTION.EXECUTORS,
  howResidueDistributed: PREFLIGHT_SECTION.RESIDUE,
};

const OUTSTANDING_TO_SECTION = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]: null,
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: PREFLIGHT_SECTION.TC,
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: 'Business Interests',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: 'Business Interests',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: 'Property Trust',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: 'Property Trust',
};

const PLACEHOLDER_PATTERN = /\[[^\]]{2,}\]|\{\{[^}]+\}\}|TODO|TBC|\[Office Address\]/i;

/** JSON / clause blobs — not user-facing bracket placeholders. */
const PLACEHOLDER_SCAN_SKIP_KEYS = new Set([
  'guardianFlowState',
  'guardianshipDetailsData',
  'substituteGuardianshipDetailsData',
]);

function scanPayloadForPlaceholders(payload, maxHits = 5) {
  const hits = [];
  const walk = (obj, path = '') => {
    if (hits.length >= maxHits || obj == null) return;
    if (typeof obj === 'string') {
      if (obj.length > 20 && obj.startsWith('data:image')) return;
      const leafKey = path.includes('.') ? path.slice(path.lastIndexOf('.') + 1) : path;
      if (PLACEHOLDER_SCAN_SKIP_KEYS.has(leafKey)) return;
      if (PLACEHOLDER_PATTERN.test(obj)) hits.push(path || 'form');
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof obj === 'object') {
      if (path === 'identityVerification') return;
      Object.entries(obj).forEach(([k, val]) => {
        if (!path && PLACEHOLDER_SCAN_SKIP_KEYS.has(k)) return;
        walk(val, path ? `${path}.${k}` : k);
      });
    }
  };
  walk(payload);
  return hits;
}

/** @returns {('firstName'|'lastName'|'executorData'|'howResidueDistributed')[]} */
export function getCriticalMissingFieldKeys(payload) {
  const missing = [];
  if (!trim(payload?.firstName)) missing.push('firstName');
  if (!trim(payload?.lastName)) missing.push('lastName');
  const executors = payload?.executorData;
  if (!Array.isArray(executors) || executors.length === 0) missing.push('executorData');
  if (!trim(payload?.howResidueDistributed)) missing.push('howResidueDistributed');
  return missing;
}

function hasCriticalClientFields(payload) {
  const keys = getCriticalMissingFieldKeys(payload);
  const labels = {
    firstName: 'First name',
    lastName: 'Last name',
    executorData: 'At least one executor',
    howResidueDistributed: 'Residue distribution choice',
  };
  return keys.map((k) => labels[k]);
}

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * @typedef {'pass' | 'warn' | 'fail'} PreflightStatus
 * @typedef {'link' | 'scroll_id' | 'scroll_checklist' | 'outstanding_modal' | 'none'} PreflightActionType
 * @typedef {{
 *   type: PreflightActionType,
 *   cta: string,
 *   to?: string,
 *   state?: object,
 *   outstandingCategory?: string,
 * }} PreflightAction
 * @typedef {{ id: string, label: string, status: PreflightStatus, detail: string, action?: PreflightAction }} PreflightItem
 */

/**
 * Where the solicitor should go to address this preflight item.
 * @param {{ id: string, status: PreflightStatus }} item
 * @param {{ matterId: string, matter?: object, mergedPayload?: object }} context
 * @returns {PreflightAction | undefined}
 */
export function resolvePreflightItemAction(item, { matterId, matter, mergedPayload }) {
  if (!matterId) return undefined;

  switch (item.id) {
    case 'critical_fields': {
      if (item.status === 'pass') {
        return {
          type: 'link',
          to: `/solicitor/matters/${matterId}/form`,
          state: {},
          cta: 'Open questionnaire',
        };
      }
      const keys = getCriticalMissingFieldKeys(mergedPayload ?? getMergedMatterPayload(matter));
      const sectionTitle = CRITICAL_KEY_TO_SECTION[keys[0]] || PREFLIGHT_SECTION.PERSONAL;
      return {
        type: 'link',
        to: `/solicitor/matters/${matterId}/form`,
        state: { openAtSectionTitle: sectionTitle },
        cta: `Open ${sectionTitle}`,
      };
    }
    case 'placeholders':
      return {
        type: 'link',
        to: `/solicitor/matters/${matterId}/form`,
        state: { openAtSectionTitle: PREFLIGHT_SECTION.PERSONAL },
        cta: 'Review answers in editor',
      };
    case 'testamentary_capacity':
      return {
        type: 'link',
        to: `/solicitor/matters/${matterId}/form`,
        state: { openAtSectionTitle: PREFLIGHT_SECTION.TC },
        cta: 'Open Testamentary Capacity',
      };
    case 'id_verification':
      if (item.status === 'pass') {
        return { type: 'scroll_id', cta: 'View ID documents' };
      }
      return { type: 'scroll_id', cta: 'Go to ID checklist' };
    case 'outstanding_workflow': {
      const categories = matter ? getMatterOutstandingCategories(matter) : [];
      const first = categories[0];
      if (first === OUTSTANDING_CATEGORY.ID_VERIFICATION) {
        return { type: 'scroll_id', cta: 'Go to ID verification' };
      }
      if (first && OUTSTANDING_TO_SECTION[first]) {
        return {
          type: 'link',
          to: `/solicitor/matters/${matterId}/form`,
          state: { openAtSectionTitle: OUTSTANDING_TO_SECTION[first] },
          cta: `Open ${OUTSTANDING_TO_SECTION[first]}`,
        };
      }
      if (first) {
        return { type: 'outstanding_modal', outstandingCategory: first, cta: 'Quick fix outstanding item' };
      }
      return { type: 'scroll_checklist', cta: 'Open document checklist' };
    }
    case 'execution_witnesses':
      return {
        type: 'link',
        to: `/solicitor/matters/${matterId}/form`,
        state: { openAtSectionTitle: 'Testamentary Capacity' },
        cta: 'Open signing & witnesses',
      };
    case 'client_pdf_scope':
      return { type: 'none', cta: '' };
    default:
      return undefined;
  }
}

/**
 * @param {{ matter?: object, mergedPayload?: object }} opts
 * @returns {PreflightItem[]}
 */
export function buildPdfPreflightChecklist({ matter, mergedPayload: mergedOverride }) {
  const merged = mergedOverride ?? getMergedMatterPayload(matter);
  const outstanding = matter ? getMatterOutstandingCategories(matter) : [];
  const items = [];

  const criticalMissing = hasCriticalClientFields(merged);
  items.push({
    id: 'critical_fields',
    label: 'Critical client fields present',
    status: criticalMissing.length === 0 ? 'pass' : 'fail',
    detail:
      criticalMissing.length === 0
        ? 'Core testator, executor, and residue fields are present.'
        : `Missing or empty: ${criticalMissing.join(', ')}.`,
  });

  const placeholders = scanPayloadForPlaceholders(merged);
  items.push({
    id: 'placeholders',
    label: 'No unresolved placeholders in saved answers',
    status: placeholders.length === 0 ? 'pass' : 'warn',
    detail:
      placeholders.length === 0
        ? 'No bracket-style placeholders detected in saved data.'
        : `Needs review — possible placeholders in: ${placeholders.slice(0, 3).join(', ')}${placeholders.length > 3 ? '…' : ''}.`,
  });

  const tcOutstanding = matter ? isMatterTestamentaryCapacityOutstanding(matter) : true;
  items.push({
    id: 'testamentary_capacity',
    label: 'Testamentary Capacity complete (solicitor section)',
    status: tcOutstanding ? 'warn' : 'pass',
    detail: tcOutstanding
      ? 'Complete Testamentary Capacity on Review & edit answers before final execution PDF.'
      : 'All required Testamentary Capacity fields are saved.',
  });

  const idMissing = getMissingIdVerificationDocs(merged);
  const idFlagged = matter?.outstanding_verification || idMissing.length > 0;
  items.push({
    id: 'id_verification',
    label: 'ID verification reviewed',
    status: idFlagged ? 'warn' : 'pass',
    detail: idFlagged
      ? 'ID still marked outstanding or documents missing — confirm before execution.'
      : 'ID verification marked complete on the matter.',
  });

  items.push({
    id: 'execution_witnesses',
    label: 'Execution PDF includes testator + witness areas',
    status: 'pass',
    detail:
      'Solicitor execution PDF includes attestation and witness sections (client intake PDF does not).',
  });

  items.push({
    id: 'client_pdf_scope',
    label: 'Client intake PDF excludes solicitor-only fields',
    status: 'pass',
    detail:
      'Use “Client intake PDF” for the client-facing copy; execution PDF is for your file and signing.',
  });

  if (outstanding.length > 0) {
    items.push({
      id: 'outstanding_workflow',
      label: 'Outstanding workflow items cleared',
      status: 'warn',
      detail: `${outstanding.length} outstanding item(s) on this matter — resolve or accept before final PDF.`,
    });
  }

  return items.map((entry) => ({
    ...entry,
    action: resolvePreflightItemAction(entry, {
      matterId: matter?.id,
      matter,
      mergedPayload: merged,
    }),
  }));
}

/**
 * @param {PreflightItem[]} items
 * @returns {boolean} true if any fail/warn — conservative “needs attention”
 */
export function pdfPreflightNeedsAttention(items) {
  return items.some((i) => i.status === 'fail' || i.status === 'warn');
}
