import { describe, expect, it } from 'vitest';
import {
  PREFLIGHT_SECTION,
  buildPdfPreflightChecklist,
  pdfPreflightNeedsAttention,
  resolvePreflightItemAction,
} from './pdfPreflightChecklist.js';

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

  it('links missing executor to Trustees/Executors section', () => {
    const items = buildPdfPreflightChecklist({
      matter: { id: 'm-1', outstanding_verification: false, solicitor_payload: {} },
      mergedPayload: {
        firstName: 'Jane',
        lastName: 'Doe',
        howResidueDistributed: 'AsShares',
      },
    });
    const critical = items.find((i) => i.id === 'critical_fields');
    expect(critical?.action).toMatchObject({
      type: 'link',
      to: '/solicitor/matters/m-1/form',
      state: { openAtSectionTitle: PREFLIGHT_SECTION.EXECUTORS },
      cta: `Open ${PREFLIGHT_SECTION.EXECUTORS}`,
    });
  });

  it('scrolls to ID verification from id_verification warn', () => {
    const action = resolvePreflightItemAction(
      { id: 'id_verification', status: 'warn' },
      { matterId: 'm-2' },
    );
    expect(action).toEqual({ type: 'scroll_id', cta: 'Go to ID checklist' });
  });

  it('does not flag guardianFlowState JSON as a placeholder', () => {
    const items = buildPdfPreflightChecklist({
      matter: { id: 'm-gf', outstanding_verification: false, solicitor_payload: {} },
      mergedPayload: {
        firstName: 'Jane',
        lastName: 'Doe',
        executorData: [{ firstName: 'Bob', lastName: 'Smith' }],
        howResidueDistributed: 'AsShares',
        guardianFlowState: JSON.stringify({ children: [{ childFirstName: 'Leo', guardians: [] }] }),
      },
    });
    expect(items.find((i) => i.id === 'placeholders')?.status).toBe('pass');
  });

  it('routes outstanding workflow to ID scroll when verification is flagged', () => {
    const items = buildPdfPreflightChecklist({
      matter: { id: 'm-3', outstanding_verification: true, solicitor_payload: {} },
      mergedPayload: {
        firstName: 'Jane',
        lastName: 'Doe',
        executorData: [{ firstName: 'Bob' }],
        howResidueDistributed: 'AsShares',
      },
    });
    const workflow = items.find((i) => i.id === 'outstanding_workflow');
    expect(workflow?.action).toEqual({ type: 'scroll_id', cta: 'Go to ID verification' });
  });
});
