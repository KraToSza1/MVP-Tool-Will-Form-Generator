import { describe, expect, it } from 'vitest';
import { pruneStaleBranchValues } from './pruneStaleBranchValues.js';

describe('pruneStaleBranchValues', () => {
  it('clears FLIT fields when residue distribution switches to AsShares', () => {
    const prev = {
      howResidueDistributed: 'IntoFLIT',
      lifeTenantDetails: 'Spouse',
      residualGiftsDetails: '',
    };
    const next = {
      ...prev,
      howResidueDistributed: 'AsShares',
      residualGiftsDetails: 'Children 50/50',
    };
    const result = pruneStaleBranchValues(prev, next);
    expect(result.howResidueDistributed).toBe('AsShares');
    expect(result.residualGiftsDetails).toBe('Children 50/50');
    expect(result.lifeTenantDetails).toBeNull();
  });

  it('clears guardian data when appointGuardians changes', () => {
    const prev = {
      appointGuardians: 'Yes',
      guardianshipDetailsData: [{ firstName: 'Jane' }],
    };
    const next = { ...prev, appointGuardians: 'No' };
    const result = pruneStaleBranchValues(prev, next);
    expect(result.appointGuardians).toBe('No');
    expect(result.guardianshipDetailsData).toEqual([]);
  });

  it('clears excluded persons when deliberatelyExcludingAnyone becomes No', () => {
    const prev = {
      deliberatelyExcludingAnyone: 'Yes',
      excludedPersonData: [{ firstName: 'Excluded', lastName: 'Person' }],
    };
    const next = { ...prev, deliberatelyExcludingAnyone: 'No' };
    const result = pruneStaleBranchValues(prev, next);
    expect(result.excludedPersonData).toEqual([]);
  });

  it('clears executor arrays when switching to Aristone quick pick', () => {
    const prev = {
      chooseAristoneExecutor: 'Other',
      executorData: [{ firstName: 'Bob', lastName: 'Smith' }],
    };
    const next = { ...prev, chooseAristoneExecutor: 'Aristone' };
    const result = pruneStaleBranchValues(prev, next);
    expect(result.chooseAristoneExecutor).toBe('Aristone');
    expect(result.executorData).toEqual([]);
  });

  it('clears property trust detail fields when includePropertyTrust becomes No', () => {
    const prev = {
      includePropertyTrust: 'Yes',
      propertyTrustDetails: 'Trust wording',
    };
    const next = { ...prev, includePropertyTrust: 'No' };
    const result = pruneStaleBranchValues(prev, next);
    expect(result.includePropertyTrust).toBe('No');
    expect(result.propertyTrustDetails).toBeNull();
  });

  it('does not mutate when controllers are unchanged', () => {
    const state = { howResidueDistributed: 'AsShares', residualGiftsDetails: 'A' };
    expect(pruneStaleBranchValues(state, { ...state })).toEqual(state);
  });

  it('keeps executor and guardian data on first-time autofill (controller set from empty)', () => {
    const prev = {};
    const next = {
      chooseAristoneExecutor: 'Individual',
      executorData: [{ firstName: 'David', lastName: 'Day' }],
      appointProfessionalExecutor: 'Yes',
      professionalExecutorSelection: 'Aristone',
      professionalExecutorData: ['Aristone Limited (trading as Aristone Solicitors)'],
      appointGuardians: 'Yes, but appoint different guardians for children',
      guardianFlowState: JSON.stringify({ children: [{ childFirstName: 'Leo', guardians: [] }] }),
      guardianshipDetailsData: 'I appoint Mrs Catherine Nancy…',
    };
    const result = pruneStaleBranchValues(prev, next);
    expect(result.executorData).toHaveLength(1);
    expect(result.guardianFlowState).toBeTruthy();
    expect(result.guardianshipDetailsData).toContain('Catherine');
  });
});
