import { mergeMatterPayloads } from './formPayload.js';

export const OUTSTANDING_CATEGORY = {
  ID_VERIFICATION: 'idVerification',
  TESTAMENTARY_CAPACITY: 'testamentaryCapacity',
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

export function getMatterOutstandingCategories(matter) {
  const categories = [];

  if (isMatterIdVerificationOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.ID_VERIFICATION);
  }

  if (isMatterTestamentaryCapacityOutstanding(matter)) {
    categories.push(OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY);
  }

  return categories;
}
