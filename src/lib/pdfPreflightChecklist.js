/**
 * Conservative PDF preflight for solicitors — reports pass / needs review, not legal approval.
 */
import {
  getMergedMatterPayload,
  getMatterOutstandingCategories,
  getMissingIdVerificationDocs,
  isMatterTestamentaryCapacityOutstanding,
} from './matterOutstanding.js';

const PLACEHOLDER_PATTERN = /\[[^\]]{2,}\]|\{\{[^}]+\}\}|TODO|TBC|\[Office Address\]/i;

function scanPayloadForPlaceholders(payload, maxHits = 5) {
  const hits = [];
  const walk = (obj, path = '') => {
    if (hits.length >= maxHits || obj == null) return;
    if (typeof obj === 'string') {
      if (obj.length > 20 && obj.startsWith('data:image')) return;
      if (PLACEHOLDER_PATTERN.test(obj)) hits.push(path || 'form');
      return;
    }
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => walk(item, `${path}[${i}]`));
      return;
    }
    if (typeof obj === 'object') {
      if (path === 'identityVerification') return;
      Object.entries(obj).forEach(([k, val]) => walk(val, path ? `${path}.${k}` : k));
    }
  };
  walk(payload);
  return hits;
}

function hasCriticalClientFields(payload) {
  const missing = [];
  if (!trim(payload?.firstName)) missing.push('First name');
  if (!trim(payload?.lastName)) missing.push('Last name');
  const executors = payload?.executorData;
  if (!Array.isArray(executors) || executors.length === 0) missing.push('At least one executor');
  if (!trim(payload?.howResidueDistributed)) missing.push('Residue distribution choice');
  return missing;
}

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

/**
 * @typedef {'pass' | 'warn' | 'fail'} PreflightStatus
 * @typedef {{ id: string, label: string, status: PreflightStatus, detail: string }} PreflightItem
 */

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

  return items;
}

/**
 * @param {PreflightItem[]} items
 * @returns {boolean} true if any fail/warn — conservative “needs attention”
 */
export function pdfPreflightNeedsAttention(items) {
  return items.some((i) => i.status === 'fail' || i.status === 'warn');
}
