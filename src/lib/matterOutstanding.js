import { mergeMatterPayloads } from './formPayload.js';
import { getBprTrustClientIntent, isBprSolicitorPackageComplete } from './bprTrustClientIntent.js';
import { getPropertyTrustClientIntent, isPropertyTrustSolicitorPackageComplete } from './propertyTrustClientIntent.js';

export const OUTSTANDING_CATEGORY = {
  ID_VERIFICATION: 'idVerification',
  BPR_TRUST_REQUIRED: 'bprTrustRequired',
  BPR_TRUST_REVIEW: 'bprTrustReview',
  PROPERTY_TRUST_REQUIRED: 'propertyTrustRequired',
  PROPERTY_TRUST_REVIEW: 'propertyTrustReview',
  TESTAMENTARY_CAPACITY: 'testamentaryCapacity',
};

/** Keys in payload.identityVerification for ID documents */
export const ID_VERIFICATION_DOC_KEYS = [
  'identityVerificationPhotoId',
  'identityVerificationProofOfAddress1',
  'identityVerificationProofOfAddress2',
  'identityVerificationSelfieWithId',
];

/** Human-readable labels for ID doc keys (for checklist) */
export const ID_VERIFICATION_DOC_LABELS = {
  identityVerificationPhotoId: 'Photo ID (passport or driving licence)',
  identityVerificationProofOfAddress1: 'Proof of address 1',
  identityVerificationProofOfAddress2: 'Proof of address 2',
  identityVerificationSelfieWithId: 'Selfie with ID',
};

export const TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS = [
  'physicalHealthDescription',
  'capacityConcerns',
  'hasTestamentaryCapacity',
  'satisfiedUnderstandsInstructions',
  'satisfiedAwareOfClaims',
  'otherPeoplePresent',
  'satisfiedNotUndulyInfluenced',
  'hasDisabilityImpactingSignRead',
];

/** Short labels for Testamentary Capacity required fields (for checklist pinpointing) */
export const TESTAMENTARY_CAPACITY_FIELD_LABELS = {
  physicalHealthDescription: "Testator's physical health",
  capacityConcerns: 'Capacity, confusion or memory concerns',
  hasTestamentaryCapacity: 'Testator has Testamentary Capacity?',
  satisfiedUnderstandsInstructions: 'Understands they are giving Will instructions?',
  satisfiedAwareOfClaims: 'Aware of who may have a claim on Estate?',
  otherPeoplePresent: 'Other people present when taking instructions?',
  satisfiedNotUndulyInfluenced: 'Not unduly influenced?',
  hasDisabilityImpactingSignRead: 'Disability impacting signing/reading?',
};

export function hasMeaningfulAnswer(value) {
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === 'object') return Object.keys(value).length > 0;
  return value != null;
}

export function getMergedMatterPayload(matter) {
  return mergeMatterPayloads(matter?.client_payload, matter?.solicitor_payload);
}

export function isMatterIdVerificationOutstanding(matter) {
  return Boolean(matter?.outstanding_verification);
}

export function isTestamentaryCapacityComplete(payload) {
  return TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.every((fieldId) => hasMeaningfulAnswer(payload?.[fieldId]));
}

/**
 * Testamentary Capacity answers may live on solicitor_payload (solicitor editor) or on
 * client_payload after questionnaire auto-fill / submit. Merged check avoids false "TC incomplete"
 * when demo data was saved with the client intake only.
 */
export function getTestamentaryCapacityPayloadForMatter(matter) {
  return getMergedMatterPayload(matter);
}

export function isMatterTestamentaryCapacityOutstanding(matter) {
  return !isTestamentaryCapacityComplete(getTestamentaryCapacityPayloadForMatter(matter));
}

export function isMatterBprTrustRequiredOutstanding(matter) {
  const payload = getMergedMatterPayload(matter);
  const biz = payload?.biz_has_interests;
  if (biz === 'yes' || biz === 'unsure') {
    return !isBprSolicitorPackageComplete(payload);
  }
  return getBprTrustClientIntent(payload) === 'Yes' && !isBprSolicitorPackageComplete(payload);
}

export function isMatterBprTrustReviewOutstanding(matter) {
  const payload = getMergedMatterPayload(matter);
  const biz = payload?.biz_has_interests;
  if (biz === 'yes' || biz === 'unsure') return false;
  return getBprTrustClientIntent(payload) === 'Unsure';
}

export function isMatterPropertyTrustRequiredOutstanding(matter) {
  const payload = getMergedMatterPayload(matter);
  return getPropertyTrustClientIntent(payload) === 'Yes' && !isPropertyTrustSolicitorPackageComplete(payload);
}

export function isMatterPropertyTrustReviewOutstanding(matter) {
  const payload = getMergedMatterPayload(matter);
  return getPropertyTrustClientIntent(payload) === 'Unsure';
}

/**
 * One matter counts as urgent at most once in nav badges / urgent lists — even if it has
 * several outstanding lines (ID + BPR + TC, etc.).
 */
export function isMatterUrgent(matter) {
  if (!matter) return false;
  if (matter.status === 'completed') return false;
  return getMatterOutstandingCategories(matter).length > 0;
}

/**
 * @param {object[] | null | undefined} matters
 * @returns {number} Count of matters (clients), not sum of outstanding checklist lines.
 */
export function countUrgentMatters(matters) {
  return (matters || []).filter(isMatterUrgent).length;
}

/**
 * @param {object[] | null | undefined} matters
 * @returns {{
 *   matterCount: number,
 *   totalOutstandingItems: number,
 *   idOnlyMatterCount: number,
 *   solicitorWorkflowMatterCount: number,
 * }}
 */
export function summarizeUrgentMatters(matters) {
  const urgentList = (matters || []).filter(isMatterUrgent);
  let totalOutstandingItems = 0;
  let idOnlyMatterCount = 0;
  let solicitorWorkflowMatterCount = 0;

  for (const matter of urgentList) {
    const categories = getMatterOutstandingCategories(matter);
    totalOutstandingItems += categories.length;
    const hasSolicitorWork = categories.some((c) => c !== OUTSTANDING_CATEGORY.ID_VERIFICATION);
    if (hasSolicitorWork) solicitorWorkflowMatterCount += 1;
    else if (categories.includes(OUTSTANDING_CATEGORY.ID_VERIFICATION)) idOnlyMatterCount += 1;
  }

  return {
    matterCount: urgentList.length,
    totalOutstandingItems,
    idOnlyMatterCount,
    solicitorWorkflowMatterCount,
  };
}

export function getMatterOutstandingCategories(matter) {
  const categories = [];

  if (isMatterIdVerificationOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.ID_VERIFICATION);
  }

  if (isMatterBprTrustRequiredOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED);
  }

  if (isMatterBprTrustReviewOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW);
  }

  if (isMatterPropertyTrustRequiredOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED);
  }

  if (isMatterPropertyTrustReviewOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW);
  }

  if (isMatterTestamentaryCapacityOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY);
  }

  return categories;
}

/**
 * Returns which ID verification documents are missing (no or empty value).
 * @param {object} payload - merged client + solicitor payload
 * @returns {string[]} - array of ID_VERIFICATION_DOC_KEYS that are missing
 */
export function getMissingIdVerificationDocs(payload) {
  const iv = payload?.identityVerification;
  if (!iv || typeof iv !== 'object') {
    return [...ID_VERIFICATION_DOC_KEYS];
  }
  return ID_VERIFICATION_DOC_KEYS.filter((key) => !hasMeaningfulAnswer(iv[key]));
}

/**
 * Returns which Testamentary Capacity required fields are missing (for pinpointing).
 * @param {object} matter - matter with client_payload, solicitor_payload
 * @returns {{ fieldId: string, label: string }[]}
 */
export function getMissingTestamentaryCapacityFields(matter) {
  const payload = getMergedMatterPayload(matter);
  return TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.filter(
    (fieldId) => !hasMeaningfulAnswer(payload?.[fieldId])
  ).map((fieldId) => ({
    fieldId,
    label: TESTAMENTARY_CAPACITY_FIELD_LABELS[fieldId] || fieldId,
  }));
}
