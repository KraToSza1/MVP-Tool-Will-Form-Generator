import { describe, expect, it } from 'vitest';
import {
  OUTSTANDING_CATEGORY,
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS,
  countUrgentMatters,
  getMatterOutstandingCategories,
  hasMeaningfulAnswer,
  isMatterBprTrustRequiredOutstanding,
  isMatterBprTrustReviewOutstanding,
  isMatterPropertyTrustRequiredOutstanding,
  isMatterPropertyTrustReviewOutstanding,
  isMatterTestamentaryCapacityOutstanding,
  isMatterUrgent,
  isTestamentaryCapacityComplete,
  summarizeUrgentMatters,
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

  it('treats client payload TC answers as complete when solicitor_payload is empty (autofill demo)', () => {
    expect(isMatterTestamentaryCapacityOutstanding({
      client_payload: completeCapacityPayload,
      solicitor_payload: {},
    })).toBe(false);
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

  it('flags BPR trust review when client was unsure (legacy questionnaire)', () => {
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

  it('flags BPR trust required when biz disclosure yes and solicitor package incomplete', () => {
    const matter = {
      client_payload: { biz_has_interests: 'yes' },
      solicitor_payload: { bprTrustDetails: 'x', bprTrustScheduleNumber: '', bprTrustTerms: 'y' },
    };
    expect(isMatterBprTrustRequiredOutstanding(matter)).toBe(true);
  });

  it('does not flag BPR trust review when biz gateway is yes or unsure', () => {
    expect(
      isMatterBprTrustReviewOutstanding({
        client_payload: { biz_has_interests: 'yes' },
        solicitor_payload: {},
      })
    ).toBe(false);
    expect(
      isMatterBprTrustReviewOutstanding({
        client_payload: { biz_has_interests: 'unsure' },
        solicitor_payload: {},
      })
    ).toBe(false);
  });

  it('clears BPR trust required when solicitor completes package after biz disclosure', () => {
    expect(
      isMatterBprTrustRequiredOutstanding({
        client_payload: { biz_has_interests: 'unsure' },
        solicitor_payload: {
          bprTrustDetails: 'd',
          bprTrustScheduleNumber: '2',
          bprTrustTerms: 't',
        },
      })
    ).toBe(false);
  });

  it('flags property trust required when client chose Yes and solicitor fields are incomplete', () => {
    const matter = {
      client_payload: { includePropertyTrust: 'Yes' },
      solicitor_payload: { propertyTrustDetails: 'x', propertyTrustScheduleNumber: '', propertyTrustTerms: 'y' },
    };
    expect(isMatterPropertyTrustRequiredOutstanding(matter)).toBe(true);
  });

  it('flags property trust review when client was unsure', () => {
    const matter = {
      client_payload: { includePropertyTrust: 'Unsure' },
      solicitor_payload: {},
    };
    expect(isMatterPropertyTrustReviewOutstanding(matter)).toBe(true);
    expect(getMatterOutstandingCategories({
      outstanding_verification: false,
      client_payload: { includePropertyTrust: 'Unsure' },
      solicitor_payload: completeCapacityPayload,
    })).toEqual([OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]);
  });

  it('counts each urgent matter once in nav badge helpers (not sum of checklist lines)', () => {
    const multiLineMatter = {
      outstanding_verification: true,
      client_payload: { bprTrustClientIntent: 'Yes' },
      solicitor_payload: {},
    };
    const idOnlyMatter = {
      outstanding_verification: true,
      client_payload: completeCapacityPayload,
      solicitor_payload: completeCapacityPayload,
    };
    const clearMatter = {
      outstanding_verification: false,
      client_payload: completeCapacityPayload,
      solicitor_payload: completeCapacityPayload,
    };
    const completedMatter = {
      status: 'completed',
      outstanding_verification: true,
      client_payload: {},
      solicitor_payload: {},
    };

    expect(isMatterUrgent(multiLineMatter)).toBe(true);
    expect(getMatterOutstandingCategories(multiLineMatter).length).toBeGreaterThan(1);

    const matters = [multiLineMatter, idOnlyMatter, clearMatter, completedMatter];
    expect(countUrgentMatters(matters)).toBe(2);

    const summary = summarizeUrgentMatters(matters);
    expect(summary.matterCount).toBe(2);
    expect(summary.totalOutstandingItems).toBeGreaterThan(summary.matterCount);
    expect(summary.idOnlyMatterCount).toBe(1);
    expect(summary.solicitorWorkflowMatterCount).toBe(1);
  });
});
