import { describe, expect, it } from 'vitest';
import { buildPdfPreflightChecklist, pdfPreflightNeedsAttention } from './pdfPreflightChecklist.js';

describe('pdfPreflightChecklist', () => {
  it('flags missing critical fields', () => {
    const items = buildPdfPreflightChecklist({
      matter: { outstanding_verification: false, solicitor_payload: {} },
      mergedPayload: { firstName: 'A' },
    });
    const critical = items.find((i) => i.id === 'critical_fields');
    expect(critical?.status).toBe('fail');
    expect(pdfPreflightNeedsAttention(items)).toBe(true);
  });

  it('passes when core fields and TC are complete', () => {
    const items = buildPdfPreflightChecklist({
      matter: {
        outstanding_verification: false,
        solicitor_payload: {
          physicalHealthDescription: 'OK',
          capacityConcerns: 'No',
          hasTestamentaryCapacity: 'Yes',
          satisfiedUnderstandsInstructions: 'Yes',
          satisfiedAwareOfClaims: 'Yes',
          otherPeoplePresent: 'No',
          satisfiedNotUndulyInfluenced: 'Yes',
          hasDisabilityImpactingSignRead: 'No',
        },
      },
      mergedPayload: {
        firstName: 'Jane',
        lastName: 'Doe',
        executorData: [{ firstName: 'Bob', lastName: 'Smith' }],
        howResidueDistributed: 'AsShares',
      },
    });
    const critical = items.find((i) => i.id === 'critical_fields');
    expect(critical?.status).toBe('pass');
  });
});
