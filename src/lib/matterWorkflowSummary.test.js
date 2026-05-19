import { describe, expect, it } from 'vitest';
import {
  WORKFLOW_BADGE,
  estimateMatterClientCompletionPercent,
  getMatterAtAGlanceSummary,
  getMatterWorkflowBadges,
  getTestamentaryCapacityStatus,
} from './matterWorkflowSummary.js';
import { TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS } from './matterOutstanding.js';

describe('matterWorkflowSummary', () => {
  it('estimates completion from current_step', () => {
    expect(estimateMatterClientCompletionPercent({ current_step: 0 })).toBeGreaterThan(0);
    expect(estimateMatterClientCompletionPercent({ current_step: null })).toBeNull();
  });

  it('returns ready badge when no outstanding categories', () => {
    const badges = getMatterWorkflowBadges({
      status: 'submitted',
      outstanding_verification: false,
      client_payload: {},
      solicitor_payload: Object.fromEntries(
        TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.map((id) => [id, 'Yes']),
      ),
    });
    expect(badges.some((b) => b.key === WORKFLOW_BADGE.READY_FOR_REVIEW)).toBe(true);
  });

  it('summarises TC as not started when solicitor payload empty', () => {
    const tc = getTestamentaryCapacityStatus({ solicitor_payload: {} });
    expect(tc.status).toBe('not_started');
  });

  it('builds at-a-glance summary with client name', () => {
    const s = getMatterAtAGlanceSummary({
      client_name: 'Jane Doe',
      client_reference: 'REF-1',
      current_step: 5,
      outstanding_verification: true,
      status: 'submitted',
      client_payload: {},
      solicitor_payload: {},
    });
    expect(s.clientName).toBe('Jane Doe');
    expect(s.reference).toBe('REF-1');
    expect(s.outstandingCount).toBeGreaterThan(0);
  });
});
