import { describe, expect, it } from 'vitest';
import { buildClientSubmitReviewSections } from './clientSubmitReviewSummary.js';

describe('clientSubmitReviewSummary', () => {
  it('includes testator and executor sections', () => {
    const sections = buildClientSubmitReviewSections({
      title: 'Mr',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      executorData: [{ firstName: 'Bob', lastName: 'Smith' }],
      howResidueDistributed: 'AsShares',
    });
    expect(sections.find((s) => s.id === 'testator')?.lines[0]).toContain('Jane Doe');
    expect(sections.find((s) => s.id === 'executors')?.lines[0]).toContain('Bob Smith');
  });

  it('reports ID upload status without image data', () => {
    const sections = buildClientSubmitReviewSections({
      identityVerification: {},
    });
    const idSection = sections.find((s) => s.id === 'id');
    expect(idSection?.lines[0]).toMatch(/upload/i);
    expect(JSON.stringify(sections)).not.toMatch(/data:image/);
  });
});
