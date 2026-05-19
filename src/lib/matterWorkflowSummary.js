/**
 * Solicitor workflow labels: at-a-glance status, badges, and completion estimates.
 * Uses real matter / payload data only — no invented fields.
 */
import { CLIENT_VISIBLE_MAX_SECTION_INDEX } from '../constants/clientMode.js';
import {
  OUTSTANDING_CATEGORY,
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS,
  getMergedMatterPayload,
  getMissingIdVerificationDocs,
  getMissingTestamentaryCapacityFields,
  getMatterOutstandingCategories,
  hasMeaningfulAnswer,
  isMatterIdVerificationOutstanding,
  isMatterTestamentaryCapacityOutstanding,
  isTestamentaryCapacityComplete,
} from './matterOutstanding.js';

/** Human-readable workflow badges for dashboard / matter detail. */
export const WORKFLOW_BADGE = {
  ID_MISSING: 'id_missing',
  TC_INCOMPLETE: 'tc_incomplete',
  PROPERTY_TRUST: 'property_trust',
  BPR_TRUST: 'bpr_trust',
  PDF_NEEDS_REVIEW: 'pdf_needs_review',
  READY_FOR_REVIEW: 'ready_for_review',
};

const CATEGORY_TO_BADGE = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]: {
    key: WORKFLOW_BADGE.ID_MISSING,
    label: 'ID missing',
    tone: 'rose',
  },
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: {
    key: WORKFLOW_BADGE.TC_INCOMPLETE,
    label: 'TC incomplete',
    tone: 'amber',
  },
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: {
    key: WORKFLOW_BADGE.BPR_TRUST,
    label: 'BPR incomplete',
    tone: 'rose',
  },
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: {
    key: WORKFLOW_BADGE.BPR_TRUST,
    label: 'BPR needs review',
    tone: 'amber',
  },
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: {
    key: WORKFLOW_BADGE.PROPERTY_TRUST,
    label: 'Property trust incomplete',
    tone: 'rose',
  },
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: {
    key: WORKFLOW_BADGE.PROPERTY_TRUST,
    label: 'Property trust needs review',
    tone: 'amber',
  },
};

/**
 * @param {object | null | undefined} matter
 * @returns {number | null} 0–100 estimate from saved current_step, or null if unknown
 */
export function estimateMatterClientCompletionPercent(matter) {
  const step = matter?.current_step;
  if (typeof step !== 'number' || Number.isNaN(step) || step < 0) return null;
  const totalSections = CLIENT_VISIBLE_MAX_SECTION_INDEX + 1;
  if (totalSections <= 0) return null;
  return Math.min(100, Math.max(0, Math.round(((step + 1) / totalSections) * 100)));
}

/**
 * @param {object | null | undefined} matter
 * @returns {{ status: 'complete' | 'in_progress' | 'not_started', label: string, missingCount: number }}
 */
export function getIdVerificationStatus(matter) {
  const payload = getMergedMatterPayload(matter);
  const missing = getMissingIdVerificationDocs(payload);
  if (!isMatterIdVerificationOutstanding(matter) && missing.length === 0) {
    return { status: 'complete', label: 'Complete', missingCount: 0 };
  }
  if (missing.length >= 4) {
    return { status: 'not_started', label: 'Not started', missingCount: missing.length };
  }
  return { status: 'in_progress', label: 'In progress', missingCount: missing.length };
}

/**
 * @param {object | null | undefined} matter
 * @returns {{ status: 'complete' | 'in_progress' | 'not_started', label: string, missing: { fieldId: string, label: string }[] }}
 */
export function getTestamentaryCapacityStatus(matter) {
  const solicitorPayload =
    matter?.solicitor_payload && typeof matter.solicitor_payload === 'object'
      ? matter.solicitor_payload
      : {};
  const missing = getMissingTestamentaryCapacityFields(matter);
  const anyAnswered = TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.some((id) =>
    hasMeaningfulAnswer(solicitorPayload[id]),
  );

  if (isTestamentaryCapacityComplete(solicitorPayload)) {
    return { status: 'complete', label: 'Complete', missing: [] };
  }
  if (!anyAnswered) {
    return { status: 'not_started', label: 'Not started', missing };
  }
  return { status: 'in_progress', label: 'In progress', missing };
}

/**
 * @param {object | null | undefined} matter
 * @returns {{ key: string, label: string, tone: string }[]}
 */
export function getMatterWorkflowBadges(matter) {
  if (!matter) return [];
  const categories = getMatterOutstandingCategories(matter);
  const badges = [];
  const seen = new Set();

  for (const category of categories) {
    const meta = CATEGORY_TO_BADGE[category];
    if (!meta || seen.has(meta.key)) continue;
    seen.add(meta.key);
    badges.push(meta);
  }

  if (categories.length > 0 && !seen.has(WORKFLOW_BADGE.PDF_NEEDS_REVIEW)) {
    badges.push({
      key: WORKFLOW_BADGE.PDF_NEEDS_REVIEW,
      label: 'PDF needs review',
      tone: 'amber',
    });
    seen.add(WORKFLOW_BADGE.PDF_NEEDS_REVIEW);
  }

  if (categories.length === 0 && (matter.status === 'submitted' || matter.status === 'verification_pending')) {
    badges.push({
      key: WORKFLOW_BADGE.READY_FOR_REVIEW,
      label: 'Ready for solicitor review',
      tone: 'emerald',
    });
  }

  return badges;
}

/**
 * @param {object | null | undefined} matter
 * @returns {boolean}
 */
export function isMatterReadyForSolicitorReview(matter) {
  if (!matter) return false;
  return getMatterOutstandingCategories(matter).length === 0;
}

/**
 * Compact summary for dashboard cards and matter header.
 * @param {object | null | undefined} matter
 */
export function getMatterAtAGlanceSummary(matter) {
  if (!matter) {
    return {
      clientName: 'Not available',
      reference: 'Not available',
      lastActivity: null,
      completionPercent: null,
      idVerification: { status: 'not_started', label: 'Not available', missingCount: 0 },
      testamentaryCapacity: { status: 'not_started', label: 'Not available', missing: [] },
      outstandingCount: 0,
      badges: [],
      sessionRef: null,
    };
  }

  const clientName =
    matter.client_name ||
    matter.client_snapshot?.fullName ||
    [matter.client_snapshot?.firstName, matter.client_snapshot?.lastName].filter(Boolean).join(' ').trim() ||
    'Not available';

  return {
    clientName,
    reference: matter.client_reference || 'Not available',
    lastActivity: matter.last_activity_at || matter.updated_at || matter.submitted_at || null,
    completionPercent: estimateMatterClientCompletionPercent(matter),
    idVerification: getIdVerificationStatus(matter),
    testamentaryCapacity: getTestamentaryCapacityStatus(matter),
    outstandingCount: getMatterOutstandingCategories(matter).length,
    badges: getMatterWorkflowBadges(matter),
    sessionRef: matter.session_ref || null,
    status: matter.status,
    tcOutstanding: isMatterTestamentaryCapacityOutstanding(matter),
  };
}
