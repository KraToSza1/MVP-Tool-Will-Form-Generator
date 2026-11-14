/**
 * Phase 2B — solicitor review pack: summary, pipeline status, follow-up email, printable pack.
 * Solicitor-only fields live on solicitor_payload (never client PDF).
 */
import { ARISTONE_PROFILE } from '../constants/aristoneSolicitors.js';
import { getBprTrustClientIntent, isBprSolicitorPackageComplete } from './bprTrustClientIntent.js';
import { buildClientSubmitReviewSections } from './clientSubmitReviewSummary.js';
import {
  OUTSTANDING_CATEGORY,
  getMergedMatterPayload,
  getMatterOutstandingCategories,
  isMatterIdVerificationOutstanding,
  isMatterTestamentaryCapacityOutstanding,
} from './matterOutstanding.js';
import {
  getIdVerificationStatus,
  getTestamentaryCapacityStatus,
} from './matterWorkflowSummary.js';
import { getPropertyTrustClientIntent } from './propertyTrustClientIntent.js';
import { buildPdfPreflightChecklist, pdfPreflightNeedsAttention } from './pdfPreflightChecklist.js';
import { normalizePersonEntry } from './formPeopleSummary.js';

import { SOLICITOR_REVIEW_PAYLOAD_KEYS, stripSolicitorReviewKeysFromPayload } from './formPayload.js';

/** Keys stored on solicitor_payload — defined in formPayload.js so the PDF generator can strip them cheaply. */
export { SOLICITOR_REVIEW_PAYLOAD_KEYS, stripSolicitorReviewKeysFromPayload };

export const MATTER_REVIEW_DECISION = {
  NEW: 'new',
  IN_REVIEW: 'in_review',
  AWAITING_CLIENT_INFO: 'awaiting_client_info',
  AWAITING_ID: 'awaiting_id',
  AWAITING_TESTAMENTARY_CAPACITY: 'awaiting_testamentary_capacity',
  READY_FOR_PDF_REVIEW: 'ready_for_pdf_review',
  READY_FOR_SIGNING: 'ready_for_signing',
  COMPLETED: 'completed',
};

const DECISION_LABELS = {
  [MATTER_REVIEW_DECISION.NEW]: 'New',
  [MATTER_REVIEW_DECISION.IN_REVIEW]: 'In review',
  [MATTER_REVIEW_DECISION.AWAITING_CLIENT_INFO]: 'Awaiting client info',
  [MATTER_REVIEW_DECISION.AWAITING_ID]: 'Awaiting ID',
  [MATTER_REVIEW_DECISION.AWAITING_TESTAMENTARY_CAPACITY]: 'Awaiting Testamentary Capacity',
  [MATTER_REVIEW_DECISION.READY_FOR_PDF_REVIEW]: 'Ready for PDF review',
  [MATTER_REVIEW_DECISION.READY_FOR_SIGNING]: 'Ready for signing',
  [MATTER_REVIEW_DECISION.COMPLETED]: 'Completed',
};

export const MATTER_PIPELINE_STATUS = {
  NEW: { key: 'new', label: 'New', tone: 'blue' },
  IN_REVIEW: { key: 'in_review', label: 'In review', tone: 'indigo' },
  AWAITING_CLIENT_INFO: { key: 'awaiting_client_info', label: 'Awaiting client info', tone: 'amber' },
  AWAITING_ID: { key: 'awaiting_id', label: 'Awaiting ID', tone: 'rose' },
  AWAITING_TC: { key: 'awaiting_testamentary_capacity', label: 'Awaiting TC', tone: 'amber' },
  READY_FOR_PDF_REVIEW: { key: 'ready_for_pdf_review', label: 'Ready for PDF review', tone: 'emerald' },
  READY_FOR_SIGNING: { key: 'ready_for_signing', label: 'Ready for signing', tone: 'emerald' },
  COMPLETED: { key: 'completed', label: 'Completed', tone: 'slate' },
};

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

function parseFollowUpQuestions(text) {
  const raw = trim(text);
  if (!raw) return [];
  return raw
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
    .filter(Boolean);
}

/**
 * @param {object | null | undefined} solicitorPayload
 * @param {string | null | undefined} legacySolicitorNotes
 */
export function parseSolicitorReviewMeta(solicitorPayload, legacySolicitorNotes = '') {
  const sp = solicitorPayload && typeof solicitorPayload === 'object' ? solicitorPayload : {};
  const decision = trim(sp[SOLICITOR_REVIEW_PAYLOAD_KEYS.REVIEW_DECISION]);
  const validDecision = Object.values(MATTER_REVIEW_DECISION).includes(decision) ? decision : '';

  return {
    internalNotes: trim(sp[SOLICITOR_REVIEW_PAYLOAD_KEYS.INTERNAL_NOTES]) || trim(legacySolicitorNotes),
    riskNotes: trim(sp[SOLICITOR_REVIEW_PAYLOAD_KEYS.RISK_NOTES]),
    followUpQuestions: trim(sp[SOLICITOR_REVIEW_PAYLOAD_KEYS.FOLLOW_UP_QUESTIONS]),
    reviewDecision: validDecision,
    followUpList: parseFollowUpQuestions(sp[SOLICITOR_REVIEW_PAYLOAD_KEYS.FOLLOW_UP_QUESTIONS]),
  };
}

/**
 * @param {{ internalNotes?: string, riskNotes?: string, followUpQuestions?: string, reviewDecision?: string }} fields
 */
export function buildSolicitorReviewPayloadPatch(fields) {
  const patch = {};
  if (fields.internalNotes !== undefined) {
    patch[SOLICITOR_REVIEW_PAYLOAD_KEYS.INTERNAL_NOTES] = trim(fields.internalNotes);
  }
  if (fields.riskNotes !== undefined) {
    patch[SOLICITOR_REVIEW_PAYLOAD_KEYS.RISK_NOTES] = trim(fields.riskNotes);
  }
  if (fields.followUpQuestions !== undefined) {
    patch[SOLICITOR_REVIEW_PAYLOAD_KEYS.FOLLOW_UP_QUESTIONS] = trim(fields.followUpQuestions);
  }
  if (fields.reviewDecision !== undefined) {
    const d = trim(fields.reviewDecision);
    patch[SOLICITOR_REVIEW_PAYLOAD_KEYS.REVIEW_DECISION] = Object.values(MATTER_REVIEW_DECISION).includes(d)
      ? d
      : '';
  }
  return patch;
}

function bprTrustSummaryLines(payload) {
  const intent = getBprTrustClientIntent(payload);
  if (intent === 'Yes') {
    const complete = isBprSolicitorPackageComplete(payload);
    return [
      complete
        ? 'BPR trust — client requested; solicitor package complete'
        : 'BPR trust — client requested; solicitor package incomplete',
    ];
  }
  if (intent === 'Unsure') return ['BPR trust — client unsure; solicitor review needed'];
  if (intent === 'No') return ['No BPR trust'];
  return ['Not recorded'];
}

function propertyTrustSummaryLines(payload) {
  const intent = getPropertyTrustClientIntent(payload);
  if (intent === 'Yes') return ['Property trust — client requested'];
  if (intent === 'Unsure') return ['Property trust — client unsure; solicitor review needed'];
  if (intent === 'No') return ['No property trust'];
  return ['Not recorded'];
}

function beneficiariesSummaryLines(payload) {
  const lines = [];
  const specific = Array.isArray(payload?.specificGiftsList) ? payload.specificGiftsList : [];
  const property = Array.isArray(payload?.propertyGiftsList) ? payload.propertyGiftsList : [];
  if (specific.length > 0) {
    const names = specific
      .slice(0, 6)
      .map((g) => {
        const recipient = g?.recipient || g?.beneficiary || g;
        const { title } = normalizePersonEntry(recipient);
        return title && title !== '(unnamed)' ? title : 'Unnamed beneficiary';
      });
    lines.push(`Specific gifts (${specific.length}): ${names.join('; ')}`);
  }
  if (property.length > 0) {
    lines.push(`Property gifts (${property.length}) recorded`);
  }
  const residue = trim(payload?.residualGiftsDetails || payload?.howResidueDistributed);
  if (residue && lines.length === 0) {
    lines.push(residue.length > 200 ? `${residue.slice(0, 197)}…` : residue);
  }
  if (lines.length === 0) return ['Not recorded'];
  return lines;
}

/**
 * @param {object | null | undefined} matter
 * @returns {{ key: string, label: string, tone: string }}
 */
export function deriveMatterPipelineStatus(matter) {
  if (!matter) return MATTER_PIPELINE_STATUS.NEW;

  const meta = parseSolicitorReviewMeta(matter.solicitor_payload, matter.solicitor_notes);
  const categories = getMatterOutstandingCategories(matter);
  const hasId = categories.includes(OUTSTANDING_CATEGORY.ID_VERIFICATION);
  const hasTc = categories.includes(OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY);
  const hasFollowUp = meta.followUpList.length > 0;

  if (matter.status === 'completed' || meta.reviewDecision === MATTER_REVIEW_DECISION.COMPLETED) {
    return MATTER_PIPELINE_STATUS.COMPLETED;
  }
  if (hasId) return MATTER_PIPELINE_STATUS.AWAITING_ID;
  if (hasTc) return MATTER_PIPELINE_STATUS.AWAITING_TC;
  if (
    meta.reviewDecision === MATTER_REVIEW_DECISION.AWAITING_CLIENT_INFO ||
    hasFollowUp
  ) {
    return MATTER_PIPELINE_STATUS.AWAITING_CLIENT_INFO;
  }
  if (categories.length === 0) {
    if (matter.status === 'in_review') return MATTER_PIPELINE_STATUS.READY_FOR_SIGNING;
    return MATTER_PIPELINE_STATUS.READY_FOR_PDF_REVIEW;
  }
  if (matter.status === 'in_review' || meta.reviewDecision === MATTER_REVIEW_DECISION.IN_REVIEW) {
    return MATTER_PIPELINE_STATUS.IN_REVIEW;
  }
  return MATTER_PIPELINE_STATUS.NEW;
}

/**
 * Read-only review summary sections for Matter Detail.
 * @param {object | null | undefined} matter
 */
export function buildMatterReviewSummary(matter) {
  if (!matter) return [];

  const payload = getMergedMatterPayload(matter);
  const clientSections = buildClientSubmitReviewSections(payload);
  const pipeline = deriveMatterPipelineStatus(matter);
  const idStatus = getIdVerificationStatus(matter);
  const tcStatus = getTestamentaryCapacityStatus(matter);
  const preflight = buildPdfPreflightChecklist({ matter, mergedPayload: payload });
  const preflightOverall = pdfPreflightNeedsAttention(preflight)
    ? 'Needs review before execution PDF'
    : 'Preflight clear';
  const outstanding = getMatterOutstandingCategories(matter);

  const contactEmail =
    trim(matter.client_email) ||
    trim(payload?.email) ||
    trim(matter.client_snapshot?.email) ||
    'Not recorded';
  const contactPhone =
    trim(matter.client_phone) ||
    trim(payload?.mobile || payload?.phoneNumber) ||
    'Not recorded';

  const sectionMap = Object.fromEntries(clientSections.map((s) => [s.id, s]));

  return [
    {
      id: 'matter',
      title: 'Matter',
      lines: [
        `Reference: ${matter.client_reference || 'Not recorded'}`,
        `Workflow: ${pipeline.label}`,
        `Database status: ${matter.status || 'unknown'}`,
        `Email: ${contactEmail}`,
        `Phone: ${contactPhone}`,
      ],
    },
    {
      id: 'executors',
      title: 'Executors',
      lines: sectionMap.executors?.lines || ['Not recorded'],
    },
    {
      id: 'guardians',
      title: 'Guardians',
      lines: sectionMap.guardians?.lines || ['Not recorded'],
    },
    {
      id: 'beneficiaries',
      title: 'Beneficiaries & gifts',
      lines: beneficiariesSummaryLines(payload),
    },
    {
      id: 'residue',
      title: 'Residue split',
      lines: sectionMap.beneficiaries?.lines || ['Not recorded'],
    },
    {
      id: 'property_trust',
      title: 'Property trust',
      lines: propertyTrustSummaryLines(payload),
    },
    {
      id: 'bpr',
      title: 'BPR / business trust',
      lines: bprTrustSummaryLines(payload),
    },
    {
      id: 'exclusions',
      title: 'Deliberate exclusions',
      lines: sectionMap.exclusions?.lines || ['Not recorded'],
    },
    {
      id: 'funeral',
      title: 'Funeral wishes',
      lines: sectionMap.funeral?.lines || ['Not recorded'],
    },
    {
      id: 'id_status',
      title: 'ID status',
      lines: [
        isMatterIdVerificationOutstanding(matter)
          ? `Outstanding — ${idStatus.missingCount} document(s) missing`
          : `Complete — ${idStatus.label}`,
      ],
    },
    {
      id: 'tc_status',
      title: 'Testamentary Capacity',
      lines: [
        isMatterTestamentaryCapacityOutstanding(matter)
          ? `Incomplete — ${tcStatus.missing.length} field(s) remaining`
          : `Complete — ${tcStatus.label}`,
      ],
    },
    {
      id: 'pdf_preflight',
      title: 'PDF preflight',
      lines: [
        `Overall: ${preflightOverall}`,
        ...preflight.slice(0, 6).map((item) => `${item.status === 'pass' ? '✓' : '○'} ${item.label}`),
      ],
    },
    {
      id: 'outstanding',
      title: 'Outstanding checklist',
      lines:
        outstanding.length === 0
          ? ['All workflow items clear']
          : outstanding.map((c) => c.replace(/_/g, ' ')),
    },
  ];
}

/**
 * @param {{ clientName?: string, reference?: string, questions?: string[] | string, firmName?: string }} opts
 */
export function buildFollowUpClientEmail(opts = {}) {
  const clientName = trim(opts.clientName) || 'Client';
  const reference = trim(opts.reference) || 'your matter';
  const firmName = trim(opts.firmName) || ARISTONE_PROFILE.firmName || 'Aristone Solicitors';
  const questions = Array.isArray(opts.questions)
    ? opts.questions.filter(Boolean)
    : parseFollowUpQuestions(opts.questions);

  let body =
    `Dear ${clientName},\n\n` +
    `Thank you for completing your Will questionnaire.\n\n` +
    `Before we can finalise your instructions (reference ${reference}), please confirm the following:\n\n`;

  if (questions.length === 0) {
    body += '1. [Add your follow-up questions in the solicitor notes panel]\n\n';
  } else {
    body += questions.map((q, i) => `${i + 1}. ${q}`).join('\n') + '\n\n';
  }

  body +=
    `Please reply to this email with your answers, or contact our office if anything is unclear.\n\n` +
    `Kind regards,\n${firmName}`;

  return body;
}

/**
 * Printable / review pack document model (no ID images, no secrets).
 * @param {object | null | undefined} matter
 * @param {{ generatedAt?: Date }} [opts]
 */
export function buildReviewPackDocument(matter, opts = {}) {
  const generatedAt = opts.generatedAt instanceof Date ? opts.generatedAt : new Date();
  const payload = matter ? getMergedMatterPayload(matter) : {};
  const meta = matter
    ? parseSolicitorReviewMeta(matter.solicitor_payload, matter.solicitor_notes)
    : parseSolicitorReviewMeta({});
  const summary = buildMatterReviewSummary(matter);
  const preflight = matter ? buildPdfPreflightChecklist({ matter, mergedPayload: payload }) : [];
  const pipeline = deriveMatterPipelineStatus(matter);

  return {
    title: `Matter review pack — ${matter?.client_reference || 'Unknown'}`,
    generatedAt: generatedAt.toISOString(),
    generatedAtLabel: generatedAt.toLocaleString(),
    matterReference: matter?.client_reference || 'Not recorded',
    clientName:
      matter?.client_name ||
      [payload?.firstName, payload?.lastName].filter(Boolean).join(' ').trim() ||
      'Not recorded',
    pipelineLabel: pipeline.label,
    summarySections: summary,
    outstandingCategories: matter ? getMatterOutstandingCategories(matter) : [],
    preflightItems: preflight.map(({ id, label, status, detail }) => ({ id, label, status, detail })),
    solicitorNotes: {
      internal: meta.internalNotes || 'None',
      risk: meta.riskNotes || 'None',
      followUpQuestions: meta.followUpQuestions || 'None',
      reviewDecision: meta.reviewDecision
        ? DECISION_LABELS[meta.reviewDecision] || meta.reviewDecision
        : 'Not set',
    },
    pdfStatus: {
      intake: 'Use Client intake PDF from matter detail (not embedded here)',
      execution: 'Use Execution PDF from matter detail (not embedded here)',
    },
  };
}

/**
 * Escape HTML for printable pack.
 */
function escHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {ReturnType<typeof buildReviewPackDocument>} doc
 */
export function buildReviewPackPrintHtml(doc) {
  const sectionsHtml = (doc.summarySections || [])
    .map(
      (sec) =>
        `<section class="pack-section"><h2>${escHtml(sec.title)}</h2><ul>${sec.lines
          .map((line) => `<li>${escHtml(line)}</li>`)
          .join('')}</ul></section>`,
    )
    .join('');

  const preflightHtml = (doc.preflightItems || [])
    .map(
      (p) =>
        `<li><strong>${escHtml(p.status)}</strong> — ${escHtml(p.label)}: ${escHtml(p.detail)}</li>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escHtml(doc.title)}</title>
  <style>
    body { font-family: Georgia, 'Times New Roman', serif; color: #0f172a; margin: 2rem; line-height: 1.45; }
    h1 { font-size: 1.35rem; margin-bottom: 0.25rem; }
    .meta { font-size: 0.9rem; color: #475569; margin-bottom: 1.5rem; }
    .pack-section { margin-bottom: 1.25rem; page-break-inside: avoid; }
    .pack-section h2 { font-size: 1rem; text-transform: uppercase; letter-spacing: 0.04em; color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.25rem; }
    ul { margin: 0.4rem 0 0 1.1rem; padding: 0; }
    li { margin: 0.2rem 0; }
    .notes-box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 0.75rem 1rem; border-radius: 6px; white-space: pre-wrap; }
    @media print { body { margin: 1rem; } }
  </style>
</head>
<body>
  <h1>${escHtml(doc.title)}</h1>
  <p class="meta">Generated ${escHtml(doc.generatedAtLabel)} · Client: ${escHtml(doc.clientName)} · Status: ${escHtml(doc.pipelineLabel)}</p>
  ${sectionsHtml}
  <section class="pack-section"><h2>Solicitor notes (internal)</h2>
    <p><strong>Internal notes</strong></p><div class="notes-box">${escHtml(doc.solicitorNotes.internal)}</div>
    <p><strong>Risk notes</strong></p><div class="notes-box">${escHtml(doc.solicitorNotes.risk)}</div>
    <p><strong>Follow-up questions</strong></p><div class="notes-box">${escHtml(doc.solicitorNotes.followUpQuestions)}</div>
    <p><strong>Review decision</strong>: ${escHtml(doc.solicitorNotes.reviewDecision)}</p>
  </section>
  <section class="pack-section"><h2>PDF preflight</h2><ul>${preflightHtml}</ul></section>
  <section class="pack-section"><h2>PDF documents</h2><ul>
    <li>${escHtml(doc.pdfStatus.intake)}</li>
    <li>${escHtml(doc.pdfStatus.execution)}</li>
  </ul></section>
  <p class="meta">Internal use only — not for client distribution. ID images are not included.</p>
</body>
</html>`;
}

export function getReviewDecisionLabel(decision) {
  return DECISION_LABELS[decision] || decision || 'Not set';
}
