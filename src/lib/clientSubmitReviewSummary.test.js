import { describe, expect, it } from 'vitest';
import { ARISTONE_PROFILE } from '../constants/aristoneSolicitors.js';
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

  it('lists Aristone professional executor and individual executors', () => {
    const sections = buildClientSubmitReviewSections({
      chooseAristoneExecutor: 'Individual',
      executorData: [
        { title: 'Mr', firstName: 'David', lastName: 'Day' },
        { title: 'Ms', firstName: 'Laura', lastName: 'Lake' },
      ],
      appointProfessionalExecutor: 'Yes',
      professionalExecutorSelection: 'Aristone',
      professionalExecutorData: [ARISTONE_PROFILE.fullLegalFormat],
      chooseAristoneSubstituteExecutor: 'Aristone',
      substituteExecutorData: [ARISTONE_PROFILE.fullLegalFormat],
    });
    const exec = sections.find((s) => s.id === 'executors')?.lines ?? [];
    expect(exec.some((l) => l.includes('David Day'))).toBe(true);
    expect(exec.some((l) => l.includes('Aristone Limited'))).toBe(true);
    expect(exec.some((l) => l.includes('Substitute executor'))).toBe(true);
  });

  it('reads guardians from guardianFlowState when guardianData is empty', () => {
    const sections = buildClientSubmitReviewSections({
      appointGuardians: 'Yes, but appoint different guardians for children',
      guardianData: [],
      guardianFlowState: JSON.stringify({
        children: [
          {
            childFirstName: 'Leo',
            childLastName: 'Ellwood',
            guardians: [{ title: 'Mrs', firstName: 'Catherine', lastName: 'Nancy' }],
          },
        ],
      }),
    });
    const guard = sections.find((s) => s.id === 'guardians')?.lines ?? [];
    expect(guard.some((l) => l.includes('Leo Ellwood') && l.includes('Catherine Nancy'))).toBe(true);
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
