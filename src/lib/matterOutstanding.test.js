import { describe, expect, it } from 'vitest';
import {
  OUTSTANDING_CATEGORY,
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS,
  getMatterOutstandingCategories,
  hasMeaningfulAnswer,
  isMatterBprTrustRequiredOutstanding,
  isMatterBprTrustReviewOutstanding,
  isMatterTestamentaryCapacityOutstanding,
  isTestamentaryCapacityComplete,
} from './matterOutstanding.js';

const completeCapacityPayload = Object.fromEntries(
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.map((fieldId) => [fieldId, fieldId === 'physicalHealthDescription' ? 'Clear and orientated.' : 'Yes'])
);

describe('matterOutstanding', () => {
  it('treats blank strings as unanswered', () => {
    expect(hasMeaningfulAnswer('')).toBe(false);
    expect(hasMeaningfulAnswer('   ')).toBe(false);
    expect(hasMeaningfulAnswer('Yes')).toBe(true);
  });

  it('marks Testamentary Capacity complete only when all required fields are answered', () => {
    expect(isTestamentaryCapacityComplete(completeCapacityPayload)).toBe(true);
    expect(isTestamentaryCapacityComplete({
      ...completeCapacityPayload,
      satisfiedAwareOfClaims: null,
    })).toBe(false);
  });

  it('marks a matter as Testamentary Capacity outstanding when required answers are missing', () => {
    expect(isMatterTestamentaryCapacityOutstanding({
      client_payload: {},
      solicitor_payload: {
        hasTestamentaryCapacity: 'Yes',
      },
    })).toBe(true);
  });

  it('returns both outstanding categories when verification and capacity are incomplete', () => {
    expect(getMatterOutstandingCategories({
      outstanding_verification: true,
      client_payload: {},
      solicitor_payload: {},
    })).toEqual([
      OUTSTANDING_CATEGORY.ID_VERIFICATION,
      OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY,
    ]);
  });

  it('clears outstanding categories when verification is complete and capacity answers are saved', () => {
    expect(getMatterOutstandingCategories({
      outstanding_verification: false,
      client_payload: {},
      solicitor_payload: completeCapacityPayload,
    })).toEqual([]);
  });

  it('flags BPR trust required when client chose Yes and solicitor fields are incomplete', () => {
    const matter = {
      client_payload: { bprTrustClientIntent: 'Yes' },
      solicitor_payload: { bprTrustDetails: 'x', bprTrustScheduleNumber: '', bprTrustTerms: 'y' },
    };
    expect(isMatterBprTrustRequiredOutstanding(matter)).toBe(true);
    expect(getMatterOutstandingCategories({
      outstanding_verification: false,
      client_payload: { bprTrustClientIntent: 'Yes' },
      solicitor_payload: {
        ...completeCapacityPayload,
        bprTrustDetails: 'x',
        bprTrustScheduleNumber: '',
        bprTrustTerms: 'y',
      },
    })).toEqual([OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]);
  });

  it('flags BPR trust review when client was unsure', () => {
    const matter = {
      client_payload: { bprTrustClientIntent: 'Unsure' },
      solicitor_payload: {},
    };
    expect(isMatterBprTrustReviewOutstanding(matter)).toBe(true);
    expect(getMatterOutstandingCategories({
      outstanding_verification: false,
      client_payload: { bprTrustClientIntent: 'Unsure' },
      solicitor_payload: completeCapacityPayload,
    })).toEqual([OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]);
  });
});
