import { describe, expect, it } from 'vitest';
import { buildClientSubmitReviewSections } from './clientSubmitReviewSummary.js';
import {
  MATTER_REVIEW_DECISION,
  SOLICITOR_REVIEW_PAYLOAD_KEYS,
  buildFollowUpClientEmail,
  buildMatterReviewSummary,
  buildReviewPackDocument,
  buildSolicitorReviewPayloadPatch,
  deriveMatterPipelineStatus,
  parseSolicitorReviewMeta,
  stripSolicitorReviewKeysFromPayload,
} from './matterReviewPack.js';
import { TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS } from './matterOutstanding.js';

const completeCapacityPayload = Object.fromEntries(
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.map((fieldId) => [
    fieldId,
    fieldId === 'physicalHealthDescription' ? 'Clear and orientated.' : 'Yes',
  ]),
);

describe('matterReviewPack', () => {
  it('parses solicitor review meta from solicitor_payload', () => {
    const meta = parseSolicitorReviewMeta(
      {
        [SOLICITOR_REVIEW_PAYLOAD_KEYS.INTERNAL_NOTES]: 'Internal only',
        [SOLICITOR_REVIEW_PAYLOAD_KEYS.RISK_NOTES]: 'Capacity concern',
        [SOLICITOR_REVIEW_PAYLOAD_KEYS.FOLLOW_UP_QUESTIONS]: '1. Confirm address\n2. Confirm executor',
        [SOLICITOR_REVIEW_PAYLOAD_KEYS.REVIEW_DECISION]: MATTER_REVIEW_DECISION.IN_REVIEW,
      },
      'Legacy notes',
    );
    expect(meta.internalNotes).toBe('Internal only');
    expect(meta.riskNotes).toBe('Capacity concern');
    expect(meta.followUpList).toEqual(['Confirm address', 'Confirm executor']);
    expect(meta.reviewDecision).toBe(MATTER_REVIEW_DECISION.IN_REVIEW);
  });

  it('derives awaiting ID before ready for PDF review', () => {
    const matter = {
      status: 'submitted',
      outstanding_verification: true,
      client_payload: {},
      solicitor_payload: {},
    };
    expect(deriveMatterPipelineStatus(matter).key).toBe('awaiting_id');
  });

  it('derives ready for PDF review when workflow is clear', () => {
    const matter = {
      status: 'submitted',
      outstanding_verification: false,
      client_payload: {
        ...completeCapacityPayload,
        firstName: 'Jane',
        lastName: 'Doe',
        executorData: [{ firstName: 'Bob', lastName: 'Smith' }],
        howResidueDistributed: 'ToSpouse',
      },
      solicitor_payload: {},
    };
    expect(deriveMatterPipelineStatus(matter).key).toBe('ready_for_pdf_review');
  });

  it('builds follow-up email with numbered questions', () => {
    const email = buildFollowUpClientEmail({
      clientName: 'Jane Doe',
      reference: 'REF-001',
      questions: ['Confirm your address', 'Confirm executor choice'],
    });
    expect(email).toContain('Dear Jane Doe');
    expect(email).toContain('REF-001');
    expect(email).toContain('1. Confirm your address');
    expect(email).toContain('2. Confirm executor choice');
    expect(email).toContain('Aristone');
    expect(email).not.toContain('data:image');
  });

  it('buildMatterReviewSummary includes workflow sections', () => {
    const sections = buildMatterReviewSummary({
      client_reference: 'REF-99',
      status: 'submitted',
      outstanding_verification: true,
      client_payload: { firstName: 'A', lastName: 'B' },
      solicitor_payload: {},
    });
    const ids = sections.map((s) => s.id);
    expect(ids).toContain('pdf_preflight');
    expect(ids).toContain('id_status');
  });

  it('review pack document excludes ID images and includes solicitor notes', () => {
    const doc = buildReviewPackDocument({
      client_reference: 'REF-2',
      client_name: 'Test Client',
      client_payload: {
        identityVerification: { photoId: 'data:image/png;base64,abc' },
      },
      solicitor_payload: {
        [SOLICITOR_REVIEW_PAYLOAD_KEYS.INTERNAL_NOTES]: 'Secret internal',
      },
    });
    expect(doc.solicitorNotes.internal).toBe('Secret internal');
    expect(JSON.stringify(doc)).not.toContain('data:image');
  });

  it('client submit review sections do not include solicitor review payload keys', () => {
    const payload = {
      firstName: 'Jane',
      lastName: 'Doe',
      executorData: [{ firstName: 'Ex', lastName: 'Ecutor' }],
      howResidueDistributed: 'ToSpouse',
      [SOLICITOR_REVIEW_PAYLOAD_KEYS.INTERNAL_NOTES]: 'Must not appear',
      [SOLICITOR_REVIEW_PAYLOAD_KEYS.RISK_NOTES]: 'Risk',
    };
    const stripped = stripSolicitorReviewKeysFromPayload(payload);
    const sections = buildClientSubmitReviewSections(stripped);
    const blob = JSON.stringify(sections);
    expect(blob).not.toContain('Must not appear');
    expect(blob).not.toContain('Risk');
  });

  it('buildSolicitorReviewPayloadPatch only sets known keys', () => {
    const patch = buildSolicitorReviewPayloadPatch({
      internalNotes: 'Note',
      reviewDecision: MATTER_REVIEW_DECISION.READY_FOR_SIGNING,
    });
    expect(patch[SOLICITOR_REVIEW_PAYLOAD_KEYS.INTERNAL_NOTES]).toBe('Note');
    expect(patch[SOLICITOR_REVIEW_PAYLOAD_KEYS.REVIEW_DECISION]).toBe(
      MATTER_REVIEW_DECISION.READY_FOR_SIGNING,
    );
  });
});
