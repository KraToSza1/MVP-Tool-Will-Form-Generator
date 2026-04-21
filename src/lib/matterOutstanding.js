import { mergeMatterPayloads } from './formPayload.js';
import { getBprTrustClientIntent, isBprSolicitorPackageComplete } from './bprTrustClientIntent.js';

export const OUTSTANDING_CATEGORY = {
  ID_VERIFICATION: 'idVerification',
  BPR_TRUST_REQUIRED: 'bprTrustRequired',
  BPR_TRUST_REVIEW: 'bprTrustReview',
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

export function isMatterTestamentaryCapacityOutstanding(matter) {
  return !isTestamentaryCapacityComplete(getMergedMatterPayload(matter));
}

export function isMatterBprTrustRequiredOutstanding(matter) {
  const payload = getMergedMatterPayload(matter);
  return getBprTrustClientIntent(payload) === 'Yes' && !isBprSolicitorPackageComplete(payload);
}

export function isMatterBprTrustReviewOutstanding(matter) {
  const payload = getMergedMatterPayload(matter);
  return getBprTrustClientIntent(payload) === 'Unsure';
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
