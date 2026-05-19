import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useParams, useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Check, Copy, Download, Eye, ExternalLink, FilePenLine, FileText, IdCard, Mail, Save, UserPlus, X, XCircle, Trash2 } from 'lucide-react';
import MatterStatusBadge from '../components/solicitor/MatterStatusBadge.jsx';
import MatterQuickActionModal from '../components/solicitor/MatterQuickActionModal.jsx';
import ConfirmModal from '../components/ConfirmModal.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import { assignMatter, deleteMatter, getMatterDetail, listStaffProfiles, MATTER_STATUS, updateMatterReminderDate, updateMatterStatus, updateSolicitorNotes } from '../lib/matters.js';
import { mergeMatterPayloads } from '../lib/formPayload.js';
import {
  isMatterTestamentaryCapacityOutstanding,
  getMatterOutstandingCategories,
  getMissingIdVerificationDocs,
  getMissingTestamentaryCapacityFields,
  ID_VERIFICATION_DOC_LABELS,
  TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS,
  TESTAMENTARY_CAPACITY_FIELD_LABELS,
  OUTSTANDING_CATEGORY,
  hasMeaningfulAnswer,
} from '../lib/matterOutstanding.js';
import {
  TESTAMENTARY_CAPACITY_SECTION_INDEX,
  TESTAMENTARY_CAPACITY_SECTION_TITLE,
} from '../constants/clientMode.js';
import FormPeopleSummaryPanel from '../components/FormPeopleSummaryPanel.jsx';
import MatterLpaOpportunityPanel from '../components/solicitor/MatterLpaOpportunityPanel.jsx';
import ClientEmailDraftModal from '../components/solicitor/ClientEmailDraftModal.jsx';
import MatterAtAGlanceStrip from '../components/solicitor/MatterAtAGlanceStrip.jsx';
import PdfPreflightPanel from '../components/solicitor/PdfPreflightPanel.jsx';
import {
  buildClientReferenceEmail,
  buildClientResumeEmail,
  buildClientResumeUrl,
  isSecureResumeUrlAvailable,
  RESUME_EMAIL_HELPER_NO_SECRET,
} from '../lib/resumeLinkEmail.js';
import { importPdfGeneratorModule, isStaleChunkLoadError } from '../utils/loadPdfGeneratorModule.js';

/** Public URL for the client Will Tool (for sharing with clients). */
function getClientWillToolUrl() {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/`;
}

/** Client-facing lines for solicitor chase emails — must stay in sync with `getMatterOutstandingCategories`. */
const OUTSTANDING_CLIENT_EMAIL_LINES = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]:
    'Provide or complete identity verification documents (photo ID, proof of address, etc.).',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]:
    'Finish Business Property Relief (BPR) Trust paperwork with your solicitor (details, schedule number, and terms).',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]:
    'Confirm whether a BPR Trust should be included once you have spoken with your solicitor.',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]:
    'Finish Property Trust wording with your solicitor (property details, schedule number, and terms).',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]:
    'Confirm whether a Property Trust should be included once you have spoken with your solicitor.',
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]:
    'Complete any remaining Testamentary Capacity or signing steps your solicitor still needs.',
};

function buildClientEmailBody(clientName, reference, toolUrl, outstandingCategories) {
  const bullets = outstandingCategories.map((c) => OUTSTANDING_CLIENT_EMAIL_LINES[c]).filter(Boolean);
  if (bullets.length) {
    return (
      `Dear ${clientName},\n\n` +
      `We are writing because there are still outstanding items on your Will matter (reference ${reference}) that need to be completed:\n\n` +
      bullets.map((b) => `- ${b}`).join('\n') +
      `\n\nPlease sign in to continue your questionnaire here:\n${toolUrl}\n\n` +
      `If you are unsure what to do next, reply to this email and we will guide you.\n\n` +
      `Kind regards`
    );
  }
  return (
    `Dear ${clientName},\n\n` +
    `Thank you for submitting your Will instructions.\n\n` +
    `You can complete or review your form here:\n${toolUrl}\n\n` +
    `If you have any questions, please contact us.\n\n` +
    `Kind regards`
  );
}

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
}

/** Format ISO date for datetime-local input (local time). */
function toLocalDatetime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day}T${h}:${min}`;
}

const SIGNING_DATE_FIELDS = [
  'executionDate',
  'dateSigned',
  'willSigningDate',
  'willExecutionDate',
  'dateOfExecution',
  'signingDate',
];

function parseDateLike(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const text = String(value).trim();
  if (!text) return null;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const d = new Date(`${text}T09:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function inferTestatorSignedAt(payload, matter) {
  const source = payload && typeof payload === 'object' ? payload : {};
  for (const key of SIGNING_DATE_FIELDS) {
    const d = parseDateLike(source[key]);
    if (d) return d;
  }
  return parseDateLike(matter?.submitted_at);
}

function addWeeks(date, weeks) {
  const next = new Date(date);
  next.setDate(next.getDate() + (weeks * 7));
  return next;
}

/** Map activity action + metadata to plain English for lawyers. */
function describeActivity(item) {
  const action = item.action || '';
  const actor = (item.actor_type || '').toLowerCase();
  const meta = item.metadata || {};
  const actorLabel = actor === 'solicitor' ? 'Solicitor' : actor === 'client' ? 'Client' : 'System';

  if (action === 'submitted') {
    return {
      title: 'Client submitted their form',
      summary: 'The client completed the intake form and submitted it. Ready for your review. Check that ID verification and answers are complete.',
      actorLabel,
    };
  }

  if (action === 'status_changed' && meta.status) {
    const status = meta.status;
    const statusLabels = {
      submitted: 'Submitted',
      verification_pending: 'ID needed',
      in_review: 'In progress',
      completed: 'Completed',
    };
    const statusExplanations = {
      submitted: 'Matter is with you; client has sent their form. Review and request ID if needed.',
      verification_pending: 'Client has not yet provided ID or verification documents. Follow up for photo ID (e.g. passport or driving licence).',
      in_review: 'You are reviewing. You can complete Testamentary Capacity and any missing answers in the form.',
      completed: 'Matter marked complete. Ready for execution.',
    };
    const label = statusLabels[status] || status;
    const explanation = statusExplanations[status] || 'Status was updated.';
    return {
      title: `Status set to "${label}"`,
      summary: explanation,
      actorLabel,
    };
  }

  if (action === 'matter_assigned') {
    const id = meta.assigned_solicitor_id;
    return {
      title: id ? 'Matter assigned to a solicitor' : 'Matter unassigned',
      summary: id ? 'A solicitor was assigned to this matter.' : 'Assignment was removed; matter is unassigned.',
      actorLabel,
    };
  }

  if (action === 'solicitor_saved_draft') {
    const step = meta.current_step;
    return {
      title: 'Progress saved on the form',
      summary: step != null ? `You saved the form at step ${step + 1}. Testamentary Capacity or other sections can be completed later.` : 'Draft form progress was saved.',
      actorLabel,
    };
  }

  if (action === 'solicitor_notes_updated') {
    return {
      title: 'Internal notes updated',
      summary: 'Solicitor notes for this matter were updated.',
      actorLabel,
    };
  }

  if (action === 'client_email_sent') {
    const preview = meta.subject_preview ? String(meta.subject_preview) : '';
    return {
      title: 'Email sent to client',
      summary: preview
        ? `An update email was sent from Microsoft 365: ${preview}.`
        : 'An update email was sent to the client from Microsoft 365.',
      actorLabel,
    };
  }

  return {
    title: action.replace(/_/g, ' ') || 'Activity',
    summary: null,
    actorLabel,
  };
}

const ID_DOC_LABELS = {
  identityVerificationPhotoId: 'Photo ID (passport or driving licence)',
  identityVerificationProofOfAddress1: 'Proof of address 1',
  identityVerificationProofOfAddress2: 'Proof of address 2',
  identityVerificationSelfieWithId: 'Selfie with ID',
};

/**
 * Renders a single ID doc from `identityVerification` (already loaded on the matter from Supabase).
 * Large `data:` URLs do not work reliably in `<a target="_blank">`, so we open a modal instead.
 */
function IdDocPreview({ label, dataUrl }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  if (!dataUrl || typeof dataUrl !== 'string') return null;

  const isHttp = /^https?:\/\//i.test(dataUrl);
  const pathForExt = (isHttp ? dataUrl.split('?')[0] : dataUrl) || dataUrl;
  const isPdf =
    dataUrl.startsWith('data:application/pdf') || /\.pdf(\?|#|$)/i.test(pathForExt);
  const isImage = dataUrl.startsWith('data:image/') || (isHttp && !isPdf);
  const downloadName = `id-doc-${String(label)
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase() || 'document'}.${isPdf ? 'pdf' : 'jpg'}`;

  const modal =
    open &&
    createPortal(
      <div
        className="fixed inset-0 z-[200] flex min-h-0 items-center justify-center bg-black/75 p-3 sm:p-4"
        role="presentation"
        onClick={close}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="flex max-h-[min(90vh,900px)] w-full max-w-5xl min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-600 bg-slate-900 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex shrink-0 min-h-[44px] items-center justify-between gap-2 border-b border-slate-700 px-3 py-2 sm:px-4 sm:py-3">
            <p className="min-w-0 break-words pr-2 text-sm font-semibold text-slate-100">{label}</p>
            <button
              type="button"
              onClick={close}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
              aria-label="Close"
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="min-h-0 min-w-0 flex-1 overflow-auto bg-slate-950/80 p-2 sm:p-4">
            {isPdf ? (
              <iframe
                title={label}
                src={dataUrl}
                className="h-[min(80vh,800px)] w-full min-w-0 max-w-full rounded-lg border border-slate-700 bg-slate-900"
              />
            ) : isImage ? (
              <img
                src={dataUrl}
                alt={label}
                className="mx-auto max-h-[min(85vh,880px)] w-auto max-w-full object-contain"
              />
            ) : (
              <p className="text-slate-300">Preview is not available for this file type. Use download or open in a new tab.</p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-700 bg-slate-900 px-3 py-2 sm:px-4">
            {dataUrl.startsWith('data:') && (isImage || isPdf) ? (
              <a
                href={dataUrl}
                download={downloadName}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-500 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <Download size={16} />
                Download
              </a>
            ) : null}
            {isHttp ? (
              <a
                href={dataUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-500 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              >
                <ExternalLink size={16} />
                Open in new tab
              </a>
            ) : null}
          </div>
        </div>
      </div>,
      document.body
    );

  return (
    <>
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-3 flex min-w-0 flex-wrap items-start gap-3">
          {isImage && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="shrink-0 cursor-zoom-in rounded-lg border-0 bg-transparent p-0 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
              aria-label={`View full size: ${label}`}
            >
              <img
                src={dataUrl}
                alt={label}
                className="pointer-events-none max-h-40 rounded-lg border border-slate-200 object-contain"
              />
            </button>
          )}
          {isPdf && (
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <FileText size={20} className="shrink-0 text-red-600" aria-hidden />
              <span className="text-sm font-medium text-slate-700">PDF document</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex min-h-[44px] min-w-0 items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2.5 text-sm font-medium text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <ExternalLink size={16} className="shrink-0" />
            {isImage ? 'View full size' : isPdf ? 'View document' : 'View'}
          </button>
        </div>
      </div>
      {modal}
    </>
  );
}

export default function MatterDetailPage() {
  const { matterId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [matter, setMatter] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solicitorNotes, setSolicitorNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isGeneratingClientPDF, setIsGeneratingClientPDF] = useState(false);
  const [reminderDate, setReminderDate] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [quickActionCategory, setQuickActionCategory] = useState(null);
  const [clientEmailDraftOpen, setClientEmailDraftOpen] = useState(false);
  const clientIdSectionRef = useRef(null);

  const handleConfirmDelete = async () => {
    if (!matter) return;
    const ref = matter.client_reference || matter.id;
    setDeleteConfirmOpen(false);
    setDeleting(true);
    const result = await deleteMatter(matter.id);
    setDeleting(false);
    if (result.error) {
      toast.error('Could not delete matter', { description: result.error });
      return;
    }
    toast.success('Matter deleted', { description: `"${ref}" has been removed.` });
    navigate('/solicitor');
  };

  const notesDirty = matter != null && solicitorNotes !== (matter.solicitor_notes ?? '');
  useEffect(() => {
    if (!notesDirty) return;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue =
        'You have unsaved changes to solicitor notes. If you leave or refresh now, those edits may be lost.';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [notesDirty]);

  useEffect(() => {
    let active = true;
    setMatter(null);
    setActivity([]);
    setSolicitorNotes('');
    setReminderDate('');
    setLoading(true);
    setDeleteConfirmOpen(false);
    console.log('[WillTool Flow] Solicitor opening matter', { matterId, phase: 'solicitor_matter_open_start' });
    Promise.all([getMatterDetail(matterId), listStaffProfiles()]).then(([detailResult, staffResult]) => {
      if (!active) return;
      if (detailResult.error) {
        console.warn('[WillTool Flow] Matter load failed', { matterId, error: detailResult.error });
        toast.error('Could not load matter', { description: detailResult.error });
        setMatter(null);
      } else {
        setMatter(detailResult.matter || null);
        setActivity(detailResult.activity || []);
        setSolicitorNotes(detailResult.matter?.solicitor_notes || '');
        const rd = detailResult.matter?.reminder_date;
        setReminderDate(toLocalDatetime(rd));
        console.log('[WillTool Flow] Matter and activity loaded for solicitor', { matterId, clientRef: detailResult.matter?.client_reference, status: detailResult.matter?.status, activityCount: (detailResult.activity || []).length });
      }

      if (staffResult.error) {
        console.warn('[WillTool Flow] Staff list load failed', { error: staffResult.error });
        toast.error('Could not load staff list', { description: staffResult.error });
      } else {
        setStaffProfiles(staffResult.data || []);
      }

      setLoading(false);
    }).catch((err) => {
      if (!active) return;
      console.warn('[WillTool Flow] Matter load error', { matterId, err });
      toast.error('Could not load matter', { description: err?.message || 'Network or server error.' });
      setMatter(null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [matterId]);

  const clientSnapshot = useMemo(() => matter?.client_snapshot || {}, [matter]);
  const mergedPayload = useMemo(
    () => mergeMatterPayloads(matter?.client_payload, matter?.solicitor_payload),
    [matter?.client_payload, matter?.solicitor_payload]
  );
  const testamentaryCapacityComplete = useMemo(() => !isMatterTestamentaryCapacityOutstanding(matter), [matter]);
  const testatorSignedAt = useMemo(() => inferTestatorSignedAt(mergedPayload, matter), [mergedPayload, matter]);
  const sixWeekDueDateIso = useMemo(
    () => (testatorSignedAt ? addWeeks(testatorSignedAt, 6).toISOString() : null),
    [testatorSignedAt],
  );
  const sixWeekDueDateLocal = useMemo(
    () => (sixWeekDueDateIso ? toLocalDatetime(sixWeekDueDateIso) : ''),
    [sixWeekDueDateIso],
  );
  const { formData } = useFormDefinition();
  const testamentaryCapacitySectionIndex = useMemo(() => {
    const i = formData?.formSections?.findIndex((s) => s.formSection === TESTAMENTARY_CAPACITY_SECTION_TITLE);
    return i >= 0 ? i : TESTAMENTARY_CAPACITY_SECTION_INDEX;
  }, [formData?.formSections]);

  const idDocs = useMemo(() => {
    const iv = mergedPayload?.identityVerification;
    if (!iv || typeof iv !== 'object') return [];
    return Object.entries(ID_DOC_LABELS)
      .map(([key, label]) => ({ key, label, dataUrl: iv[key] }))
      .filter((d) => d.dataUrl);
  }, [mergedPayload?.identityVerification]);

  const tcAnswerRows = useMemo(() => {
    return TESTAMENTARY_CAPACITY_REQUIRED_FIELD_IDS.map((fieldId) => {
      const value = mergedPayload?.[fieldId];
      const text = Array.isArray(value) ? value.join(', ') : String(value ?? '').trim();
      return {
        fieldId,
        label: TESTAMENTARY_CAPACITY_FIELD_LABELS[fieldId] || fieldId,
        answered: hasMeaningfulAnswer(value),
        valueText: text,
      };
    });
  }, [mergedPayload]);

  const scrollToClientId = () => {
    setTimeout(() => {
      clientIdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const scrollToDocumentChecklist = () => {
    setTimeout(() => {
      document.getElementById('matter-document-checklist')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  useEffect(() => {
    if (!matter || !location.state?.scrollToIdDocs) return;
    scrollToClientId();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matter, location.state?.scrollToIdDocs]);

  useEffect(() => {
    if (!matter || matter.reminder_date || reminderDate || !sixWeekDueDateLocal) return;
    setReminderDate(sixWeekDueDateLocal);
  }, [matter, reminderDate, sixWeekDueDateLocal]);

  const handleDownloadPDF = async () => {
    console.log('[WillTool Flow] Solicitor generating PDF for matter', { matterId, phase: 'solicitor_pdf_start' });
    console.log('[MatterDetailPage PDF] handleDownloadPDF called', {
      matterId,
      hasMatter: !!matter,
      matterClientPayloadKeys: matter?.client_payload ? Object.keys(matter.client_payload) : [],
      matterSolicitorPayloadKeys: matter?.solicitor_payload ? Object.keys(matter.solicitor_payload) : [],
      mergedPayloadKeys: mergedPayload ? Object.keys(mergedPayload) : [],
      mergedPayloadKeyCount: mergedPayload ? Object.keys(mergedPayload).length : 0,
      hasFormData: !!formData,
      formDataSectionsCount: formData?.formSections?.length ?? 0,
    });

    if (!matter || !mergedPayload || Object.keys(mergedPayload).length === 0) {
      console.warn('[MatterDetailPage PDF] Aborting: no form data', { matter: !!matter, mergedPayloadKeys: mergedPayload ? Object.keys(mergedPayload).length : 0 });
      toast.error('No form data', { description: 'This matter has no saved form data yet. Open the form and save, or wait for the client to submit.' });
      return;
    }
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generating PDF...');
    try {
      console.log('[MatterDetailPage PDF] Loading PDF module...');
      const pdfModule = await importPdfGeneratorModule();
      const generatePDFWithJSPDF = pdfModule.generatePDFWithJSPDF;
      console.log('[MatterDetailPage PDF] PDF module loaded', { hasGeneratePDFWithJSPDF: !!generatePDFWithJSPDF });
      if (!generatePDFWithJSPDF) {
        toast.error('PDF generator not available', { id: toastId, description: 'Could not load PDF generator. Try refreshing the page.' });
        return;
      }
      console.log('[MatterDetailPage PDF] Calling generatePDFWithJSPDF with mergedPayload keys:', Object.keys(mergedPayload), 'formSchema:', !!formData);
      const pdfResult = await generatePDFWithJSPDF(mergedPayload, {}, { isClientPDF: false, formSchema: formData });
      console.log('[MatterDetailPage PDF] generatePDFWithJSPDF returned', {
        resultKeys: pdfResult ? Object.keys(pdfResult) : [],
        hasDoc: !!(pdfResult?.doc || pdfResult),
        docOutputType: typeof (pdfResult?.doc || pdfResult)?.output,
        hasCriticalIssues: pdfResult?.hasCriticalIssues,
        criticalIssuesLength: (pdfResult?.criticalIssues || []).length,
      });

      const doc = pdfResult?.doc || pdfResult;
      const criticalIssues = pdfResult?.criticalIssues || [];
      const hasCriticalIssues = pdfResult?.hasCriticalIssues || false;

      if (hasCriticalIssues && criticalIssues.length > 0) {
        console.warn('[MatterDetailPage PDF] PDF blocked by critical issues', { criticalIssues });
        const firstIssue = criticalIssues[0];
        const issueText = (firstIssue?.issue || 'incomplete').replace(/^CRITICAL:\s*/i, '').substring(0, 120) + ((firstIssue?.issue && firstIssue.issue.length > 120) ? '…' : '');
        const location = [firstIssue?.section, firstIssue?.field].filter(Boolean).join(' – ');
        const issueDetail = location ? `${location}: ${issueText}` : (firstIssue?.issue || 'Complete required fields in the form first.').substring(0, 200);
        toast.error('PDF blocked', {
          id: toastId,
          description: criticalIssues.length === 1
            ? issueDetail
            : `${criticalIssues.length} critical issue(s). First: ${issueDetail}`,
          duration: 10000,
        });
        return;
      }

      if (!doc || typeof doc.output !== 'function') {
        console.error('[MatterDetailPage PDF] No valid doc produced', { doc: !!doc, outputType: typeof doc?.output });
        toast.error('PDF generation failed', { id: toastId, description: 'No document was produced.' });
        return;
      }

      const firstName = mergedPayload.firstName || matter?.client_snapshot?.firstName || '';
      const lastName = mergedPayload.lastName || matter?.client_snapshot?.lastName || '';
      const testatorName = [firstName, lastName].filter(Boolean).join('-') || matter?.client_reference || 'Will';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${testatorName}-Last-Will-${date}.pdf`;

      console.log('[MatterDetailPage PDF] Creating blob and triggering download', { filename });
      const pdfArrayBuffer = doc.output('arraybuffer');
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.type = 'application/pdf';
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);

      console.log('[WillTool Flow] Solicitor PDF downloaded', { matterId, filename, phase: 'solicitor_pdf_download' });
      console.log('[MatterDetailPage PDF] Download complete', { filename });
      toast.success('PDF downloaded', {
        id: toastId,
        description: `Saved as ${filename}. Review for completeness before execution.`,
      });
    } catch (err) {
      console.error('[MatterDetailPage PDF] Error during PDF generation or download', {
        message: err?.message,
        name: err?.name,
        stack: err?.stack,
        cause: err?.cause,
        fullError: String(err),
      });
      if (isStaleChunkLoadError(err)) {
        toast.error('App was just updated', {
          id: toastId,
          description:
            'Refresh this page, then try the PDF again. This happens when a new version was published while this tab stayed open.',
          duration: 14_000,
          action: {
            label: 'Refresh page',
            onClick: () => window.location.reload(),
          },
        });
      } else {
        const msg = err?.message || 'Unknown error';
        toast.error('PDF failed', { id: toastId, description: msg });
      }
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadClientPDF = async () => {
    if (!matter || !mergedPayload || Object.keys(mergedPayload).length === 0) {
      toast.error('No form data', { description: 'This matter has no saved form data yet.' });
      return;
    }
    setIsGeneratingClientPDF(true);
    const toastId = toast.loading('Generating client intake PDF...');
    try {
      const pdfModule = await importPdfGeneratorModule();
      const generatePDFWithJSPDF = pdfModule.generatePDFWithJSPDF;
      if (!generatePDFWithJSPDF) {
        toast.error('PDF generator not available', { id: toastId });
        return;
      }
      const pdfResult = await generatePDFWithJSPDF(mergedPayload, {}, { isClientPDF: true, formSchema: formData });
      const doc = pdfResult?.doc || pdfResult;
      if (!doc || typeof doc.output !== 'function') {
        toast.error('PDF generation failed', { id: toastId });
        return;
      }
      const firstName = mergedPayload.firstName || matter?.client_snapshot?.firstName || '';
      const lastName = mergedPayload.lastName || matter?.client_snapshot?.lastName || '';
      const testatorName = [firstName, lastName].filter(Boolean).join('-') || matter?.client_reference || 'Will';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${testatorName}-Client-Intake-${date}.pdf`;
      const pdfArrayBuffer = doc.output('arraybuffer');
      const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toast.success('Client intake PDF downloaded', { id: toastId, description: filename });
    } catch (err) {
      const msg = err?.message || 'Unknown error';
      toast.error('PDF failed', { id: toastId, description: msg });
    } finally {
      setIsGeneratingClientPDF(false);
    }
  };

  const secureResumeAvailable = useMemo(() => {
    if (!matter) return false;
    const secret = matter.session_secret;
    return isSecureResumeUrlAvailable({ sessionRef: matter.session_ref, sessionSecret: secret });
  }, [matter]);

  const copyClientName = useMemo(() => {
    if (!matter) return 'Client';
    return (
      matter.client_name ||
      matter.client_snapshot?.fullName ||
      [matter.client_snapshot?.firstName, matter.client_snapshot?.lastName].filter(Boolean).join(' ').trim() ||
      'Client'
    );
  }, [matter]);

  const handleCopySecureResumeEmail = async () => {
    if (!matter || !secureResumeAvailable) return;
    const resumeUrl = buildClientResumeUrl({
      origin: typeof window !== 'undefined' ? window.location.origin : '',
      sessionRef: matter.session_ref,
      sessionSecret: matter.session_secret,
    });
    if (!resumeUrl) {
      toast.error('Secure resume link unavailable', { description: RESUME_EMAIL_HELPER_NO_SECRET });
      return;
    }
    const body = buildClientResumeEmail({ clientName: copyClientName, resumeUrl });
    try {
      await navigator.clipboard.writeText(body);
      toast.success('Resume email copied', {
        description: 'Includes a working secure link. Paste into your email client.',
      });
    } catch {
      toast.error('Could not copy', { description: 'Allow clipboard access for this site.' });
    }
  };

  const handleCopyReferenceEmail = async () => {
    if (!matter?.session_ref && !matter?.client_reference) {
      toast.error('No reference', { description: 'This matter has no client reference to include in an email.' });
      return;
    }
    const body = buildClientReferenceEmail({
      clientName: copyClientName,
      clientReference: matter.client_reference,
      sessionRef: matter.session_ref,
    });
    try {
      await navigator.clipboard.writeText(body);
      toast.success('Reference email copied', {
        description: 'No resume URL included — client must use their original secure link.',
      });
    } catch {
      toast.error('Could not copy', { description: 'Allow clipboard access for this site.' });
    }
  };

  const handleStatusChange = async (nextStatus) => {
    if (!matter) return;
    if (nextStatus === MATTER_STATUS.COMPLETED && !window.confirm('Mark this matter as complete? It will move to Completed status.')) return;

    const changes = {
      reviewed_at: nextStatus === MATTER_STATUS.IN_REVIEW ? new Date().toISOString() : matter.reviewed_at,
      completed_at: nextStatus === MATTER_STATUS.COMPLETED ? new Date().toISOString() : matter.completed_at,
      verification_completed_at: nextStatus === MATTER_STATUS.VERIFICATION_PENDING
        ? null
        : matter.verification_completed_at,
      outstanding_verification: nextStatus === MATTER_STATUS.VERIFICATION_PENDING,
      last_activity_at: new Date().toISOString(),
    };

    console.log('[WillTool Flow] Solicitor changing matter status', { matterId: matter.id, nextStatus });
    const result = await updateMatterStatus(matter.id, nextStatus, changes);
    if (result.error) {
      toast.error('Status update failed', { description: result.error });
      return;
    }

    setMatter((prev) => prev ? { ...prev, ...result.data } : prev);
    toast.success('Matter updated', { description: `Status set to ${nextStatus.replaceAll('_', ' ')}.` });
  };

  const handleSaveNotes = async () => {
    if (!matter) return;
    setSavingNotes(true);
    console.log('[WillTool Flow] Solicitor saving notes', { matterId: matter.id });
    const result = await updateSolicitorNotes(matter.id, solicitorNotes);
    setSavingNotes(false);
    if (result.error) {
      toast.error('Could not save notes', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, solicitor_notes: result.data?.solicitor_notes || solicitorNotes } : prev);
    toast.success('Notes saved', { description: 'Solicitor notes updated for this matter.' });
  };

  const handleAssignmentChange = async (event) => {
    if (!matter) return;
    const assignedSolicitorId = event.target.value || null;
    console.log('[WillTool Flow] Solicitor assigning matter', { matterId: matter.id, assignedSolicitorId });
    const result = await assignMatter(matter.id, assignedSolicitorId);
    if (result.error) {
      toast.error('Could not assign matter', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, assigned_solicitor_id: result.data?.assigned_solicitor_id || null } : prev);
    toast.success('Assignment updated', { description: assignedSolicitorId ? 'Matter reassigned successfully.' : 'Matter unassigned.' });
  };

  const handleAssignToMe = async () => {
    if (!matter || !user?.id) return;
    console.log('[WillTool Flow] Solicitor assigning matter to self', { matterId: matter.id });
    const result = await assignMatter(matter.id, user.id);
    if (result.error) {
      toast.error('Could not assign matter', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, assigned_solicitor_id: user.id } : prev);
    toast.success('Assigned to you', { description: 'This matter is now assigned to you.' });
  };

  const handleCopyClientLink = async () => {
    const url = getClientWillToolUrl();
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied', { description: 'Will Tool client link copied to clipboard. Paste into an email to send to the client.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy to clipboard.' });
    }
  };

  const handleCopyReference = async () => {
    if (!matter?.client_reference) return;
    try {
      await navigator.clipboard.writeText(matter.client_reference);
      toast.success('Reference copied', { description: 'Client reference copied to clipboard.' });
    } catch {
      toast.error('Copy failed', { description: 'Could not copy to clipboard.' });
    }
  };

  const clientEmail = matter?.client_email || clientSnapshot?.email || '';
  const clientName = matter?.client_name || clientSnapshot?.fullName || 'Client';
  const outstandingCategoriesForEmail = useMemo(
    () => (matter ? getMatterOutstandingCategories(matter) : []),
    [matter],
  );

  const emailDraft = useMemo(() => {
    if (!clientEmail || !matter) return null;
    const toolUrl = getClientWillToolUrl();
    const ref = matter.client_reference || 'your matter';
    const subjectText =
      outstandingCategoriesForEmail.length > 0
        ? `Your Will — outstanding items (${ref})`
        : `Your Will — next steps (${ref})`;
    const bodyText = buildClientEmailBody(clientName, ref, toolUrl, outstandingCategoriesForEmail);
    const subjectEnc = encodeURIComponent(subjectText);
    const bodyEnc = encodeURIComponent(bodyText);
    return {
      matterId: matter.id,
      recipientName: clientName,
      to: clientEmail,
      subjectText,
      bodyText,
      outlookWebHref: `https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(clientEmail)}&subject=${subjectEnc}&body=${bodyEnc}`,
    };
  }, [clientEmail, clientName, matter, outstandingCategoriesForEmail]);

  const handleReminderDateChange = async (e) => {
    const value = e.target.value;
    setReminderDate(value);
    if (!matter) return;
    const iso = value ? new Date(value).toISOString() : null;
    console.log('[WillTool Flow] Solicitor saving reminder date', { matterId: matter.id, reminderDate: iso || null });
    const result = await updateMatterReminderDate(matter.id, iso);
    if (result.error) {
      toast.error('Could not save reminder date', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, reminder_date: result.data?.reminder_date ?? iso } : prev);
    if (value) toast.success('Reminder set', { description: 'Reminder date saved.' });
    else toast.success('Reminder cleared', { description: 'Reminder date removed.' });
  };

  const handleSetSixWeekDueDate = async () => {
    if (!matter) return;
    if (!sixWeekDueDateIso || !sixWeekDueDateLocal) {
      toast.error('No signing date found', {
        description: 'Add/sign the execution date first, then set the 6-week due date.',
      });
      return;
    }
    setReminderDate(sixWeekDueDateLocal);
    const result = await updateMatterReminderDate(matter.id, sixWeekDueDateIso);
    if (result.error) {
      toast.error('Could not save reminder date', { description: result.error });
      return;
    }
    setMatter((prev) => (prev ? { ...prev, reminder_date: result.data?.reminder_date ?? sixWeekDueDateIso } : prev));
    toast.success('Due date set', { description: 'Reminder date set to 6 weeks after testator signing.' });
  };

  const openQuickAction = (category) => {
    setQuickActionCategory(category);
  };

  const closeQuickAction = () => {
    setQuickActionCategory(null);
  };

  const handleQuickActionSaved = (updatedMatter) => {
    if (!updatedMatter) return;
    setMatter(updatedMatter);
  };

  if (loading) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading matter...</div>;
  }

  if (!matter) {
    return <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Matter not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/solicitor" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
            <ArrowLeft size={16} />
            Back to dashboard
          </Link>
          <a
            href={getClientWillToolUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Opens the generic public Will Tool in a new tab. It does not load this matter’s saved answers — use Review & edit answers for that."
          >
            <Eye size={14} aria-hidden />
            Open public intake
          </a>
          <button
            type="button"
            onClick={handleCopyClientLink}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            title="Copy Will Tool link to send to client"
          >
            <Copy size={14} />
            Copy client link
          </button>
          {emailDraft && (
            <button
              type="button"
              onClick={() => setClientEmailDraftOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Preview the client email, open Microsoft Outlook on the web, or copy the draft"
            >
              <Mail size={14} />
              Email client
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadClientPDF}
            disabled={isGeneratingClientPDF || !mergedPayload || Object.keys(mergedPayload).length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100 disabled:opacity-50 disabled:cursor-not-allowed dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-100"
            title="Intake-only PDF for the client (no execution / witness pages)"
          >
            {isGeneratingClientPDF ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent" aria-hidden />
                Generating…
              </>
            ) : (
              <>
                <Download size={16} />
                Client intake PDF
              </>
            )}
          </button>
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF || !mergedPayload || Object.keys(mergedPayload).length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            title="Generate and download the execution will PDF from current client and solicitor data"
          >
            {isGeneratingPDF ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" aria-hidden />
                Generating…
              </>
            ) : (
              <>
                <Download size={16} />
                Execution PDF
              </>
            )}
          </button>
          {matter.status === MATTER_STATUS.SUBMITTED || matter.status === MATTER_STATUS.VERIFICATION_PENDING ? (
            <button
              type="button"
              onClick={() => handleStatusChange(MATTER_STATUS.IN_REVIEW)}
              className="inline-flex items-center gap-2 rounded-xl border border-indigo-300 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-900 hover:bg-indigo-100 dark:border-indigo-500/50 dark:bg-indigo-950/40 dark:text-indigo-100"
              title="Mark as under solicitor review"
            >
              <Check size={16} />
              Mark reviewed
            </button>
          ) : null}
          <Link
            to={`/solicitor/matters/${matter.id}/form`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 dark:focus:ring-offset-slate-950 focus:ring-offset-white"
            title="Solicitor questionnaire for this matter only — change answers, Testamentary Capacity, and save to the matter."
          >
            <FilePenLine size={16} aria-hidden />
            Review &amp; edit answers
          </Link>
          <button
            type="button"
            onClick={() => setDeleteConfirmOpen(true)}
            disabled={deleting}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            title="Delete this matter (cannot be undone)"
          >
            {deleting ? (
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-red-400 border-t-transparent" aria-hidden />
            ) : (
              <Trash2 size={16} />
            )}
            Delete matter
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400 -mt-2 [&_strong]:text-slate-900 [&_strong]:dark:text-slate-200">
        <strong>Open public intake</strong> is the generic client website in a new tab — it does{' '}
        <strong>not</strong> show this matter’s saved form. <strong>Review &amp; edit answers</strong> is your
        workspace for <strong>this</strong> matter (change answers, Testamentary Capacity, remote signing).{' '}
        <strong>Download PDF</strong> builds the execution will from saved data. Use <strong>Client intake PDF</strong> for the client-facing copy.
      </p>

      <MatterAtAGlanceStrip
        matter={matter}
        showQuickActions
        onCopySecureResume={secureResumeAvailable ? handleCopySecureResumeEmail : undefined}
        onCopyReferenceEmail={
          !secureResumeAvailable && (matter.session_ref || matter.client_reference)
            ? handleCopyReferenceEmail
            : undefined
        }
        resumeEmailHelperText={
          !secureResumeAvailable && matter.session_ref ? RESUME_EMAIL_HELPER_NO_SECRET : undefined
        }
        onDownloadClientPdf={handleDownloadClientPDF}
        clientPdfBusy={isGeneratingClientPDF}
      />

      <PdfPreflightPanel
        matter={matter}
        mergedPayload={mergedPayload}
        onScrollToId={scrollToClientId}
        onScrollToChecklist={scrollToDocumentChecklist}
        onOpenOutstandingCategory={openQuickAction}
      />

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Matter</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900">{matter.client_reference}</h1>
                <button
                  type="button"
                  onClick={handleCopyReference}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  title="Copy reference"
                >
                  <Copy size={12} />
                  Copy ref
                </button>
              </div>
              <p className="mt-1 text-sm text-slate-600">Received {formatDate(matter.submitted_at)}</p>
            </div>
            <MatterStatusBadge status={matter.status} />
          </div>

          <div id="matter-document-checklist"
            className="document-checklist mt-6 rounded-2xl border border-slate-200 bg-slate-50/90 shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-100/80 px-5 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600">Document checklist</h2>
              <p className="mt-0.5 text-xs text-slate-500">What’s done and what’s still needed for this matter</p>
            </div>
            <div className="divide-y divide-slate-200">
              {/* 1. ID received */}
              <div className={`document-checklist-item flex flex-col gap-2 px-5 py-4 ${matter.outstanding_verification ? 'bg-amber-50/70' : 'bg-white'}`}>
                <div className="flex items-start gap-3">
                  {matter.outstanding_verification ? (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100" aria-hidden>
                      <XCircle size={18} className="text-amber-700" />
                    </div>
                  ) : (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100" aria-hidden>
                      <Check size={18} className="text-emerald-700" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">ID received</p>
                    {matter.outstanding_verification ? (
                      <>
                        <p className="mt-1 text-sm text-slate-600">The following documents are missing or not yet received:</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
                          {getMissingIdVerificationDocs(mergedPayload).map((key) => (
                            <li key={key}>{ID_VERIFICATION_DOC_LABELS[key] || key}</li>
                          ))}
                        </ul>
                        <button type="button" onClick={scrollToClientId} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded">
                          <IdCard size={16} />
                          View ID documents section
                        </button>
                        <button
                          type="button"
                          onClick={() => openQuickAction(OUTSTANDING_CATEGORY.ID_VERIFICATION)}
                          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          Quick edit ID verification
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="mt-0.5 text-sm text-slate-600">All required ID documents have been received.</p>
                        <button
                          type="button"
                          onClick={() => openQuickAction(OUTSTANDING_CATEGORY.ID_VERIFICATION)}
                          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          Edit verification notes
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {/* 2. Instructions complete */}
              <div className="document-checklist-item flex flex-col gap-2 px-5 py-4 bg-white">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100" aria-hidden>
                    <Check size={18} className="text-emerald-700" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">Instructions complete (client submitted)</p>
                    <p className="mt-0.5 text-sm text-slate-600">Client has completed and submitted the questionnaire.</p>
                    <Link
                      to={`/solicitor/matters/${matter.id}/form`}
                      className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <FilePenLine size={16} />
                      Edit instructions now
                    </Link>
                  </div>
                </div>
              </div>
              {/* 3. Testamentary Capacity */}
              <div className={`document-checklist-item flex flex-col gap-2 px-5 py-4 ${!testamentaryCapacityComplete ? 'bg-amber-50/70' : 'bg-white'}`}>
                <div className="flex items-start gap-3">
                  {testamentaryCapacityComplete ? (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100" aria-hidden>
                      <Check size={18} className="text-emerald-700" />
                    </div>
                  ) : (
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100" aria-hidden>
                      <XCircle size={18} className="text-amber-700" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">Testamentary Capacity</p>
                    {testamentaryCapacityComplete ? (
                      <>
                        <p className="mt-0.5 text-sm text-slate-600">All required capacity questions have been completed.</p>
                        <button
                          type="button"
                          onClick={() => openQuickAction(OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY)}
                          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          Edit TC answers
                        </button>
                        <details className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10">
                          <summary className="cursor-pointer text-sm font-semibold text-emerald-900 dark:text-emerald-200">Review saved answers</summary>
                          <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                            {tcAnswerRows.map((row) => (
                              <li key={row.fieldId} className="rounded-lg border border-emerald-100 bg-white/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/70">
                                <p className="font-medium text-slate-900 dark:text-slate-100">{row.label}</p>
                                <p className="mt-1 text-slate-700 dark:text-slate-300">{row.valueText || 'Not answered'}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </>
                    ) : (
                      <>
                        <p className="mt-1 text-sm text-slate-600">The following questions are still unanswered:</p>
                        <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-700">
                          {getMissingTestamentaryCapacityFields(matter).map(({ fieldId, label }) => (
                            <li key={fieldId}>{label}</li>
                          ))}
                        </ul>
                        <Link
                          to={`/solicitor/matters/${matter.id}/form`}
                          state={{ openAtSection: testamentaryCapacitySectionIndex }}
                          className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-700 hover:text-indigo-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                        >
                          <FilePenLine size={16} />
                          Open form at Testamentary Capacity
                        </Link>
                        <button
                          type="button"
                          onClick={() => openQuickAction(OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY)}
                          className="mt-2 inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm font-semibold text-indigo-900 hover:bg-indigo-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          Quick edit TC answers
                        </button>
                        <details className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
                          <summary className="cursor-pointer text-sm font-semibold text-amber-900 dark:text-amber-200">Review saved answers</summary>
                          <ul className="mt-2 space-y-2 text-sm text-slate-700 dark:text-slate-300">
                            {tcAnswerRows.map((row) => (
                              <li key={row.fieldId} className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2 dark:border-slate-600 dark:bg-slate-800/70">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium text-slate-900 dark:text-slate-100">{row.label}</p>
                                  {!row.answered ? (
                                    <span className="rounded-full border border-amber-200 bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/15 dark:text-amber-200">
                                      Missing
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-slate-700 dark:text-slate-300">{row.valueText || 'Not answered'}</p>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Client name</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_name || clientSnapshot.fullName || 'Unknown client'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_email || clientSnapshot.email || 'Not captured'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Phone</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_phone || clientSnapshot.phoneNumber || clientSnapshot.mobile || mergedPayload?.mobile || mergedPayload?.phoneNumber || 'Not captured'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.outstanding_verification ? 'ID needed' : 'Complete'}</p>
            </div>
            <div className="client-id-docs-card rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/80 p-4 sm:col-span-2">
              <p className="client-id-docs-card-title text-xs font-semibold uppercase tracking-wide text-indigo-600">Client ID documents</p>
              <button
                type="button"
                onClick={scrollToClientId}
                className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                title={idDocs.length > 0 ? `View ${idDocs.length} uploaded document(s)` : 'View ID documents area (none uploaded yet)'}
              >
                <IdCard size={18} aria-hidden />
                {idDocs.length > 0
                  ? `View ${idDocs.length} document${idDocs.length === 1 ? '' : 's'}`
                  : 'View ID documents (none uploaded yet)'}
              </button>
            </div>
            <FormPeopleSummaryPanel payload={mergedPayload} variant="solicitor" />
            <MatterLpaOpportunityPanel mergedPayload={mergedPayload} />

            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned solicitor</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={matter.assigned_solicitor_id || ''}
                  onChange={handleAssignmentChange}
                  className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Unassigned</option>
                  {staffProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.display_name || profile.email} ({profile.role})
                    </option>
                  ))}
                </select>
                {user?.id && !matter.assigned_solicitor_id && (
                  <button
                    type="button"
                    onClick={handleAssignToMe}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    title="Assign this matter to yourself"
                  >
                    <UserPlus size={16} />
                    Assign to me
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Update status</p>
            <p className="mt-1 text-xs text-slate-600">Move matter through your workflow.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.SUBMITTED)} title="Client has submitted; awaiting review" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:border-slate-400">Submitted</button>
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.VERIFICATION_PENDING)} title="ID or verification required" className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-medium text-amber-900 hover:border-amber-400">ID needed</button>
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.IN_REVIEW)} title="Under your review" className="rounded-xl border border-indigo-300 px-4 py-2 text-sm font-medium text-indigo-900 hover:border-indigo-400">In progress</button>
              <button type="button" onClick={() => handleStatusChange(MATTER_STATUS.COMPLETED)} title="Matter finished; ready for execution" className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-900 hover:border-emerald-400">Mark complete</button>
            </div>
            <div className="mt-4">
              <label htmlFor="reminder-date" className="block text-xs font-semibold uppercase tracking-wide text-slate-500">Reminder / due date</label>
              <input
                id="reminder-date"
                type="datetime-local"
                value={reminderDate}
                onChange={handleReminderDateChange}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSetSixWeekDueDate}
                  className="inline-flex min-h-[44px] items-center rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-900 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  Set to +6 weeks from signing
                </button>
                <p className="text-xs text-slate-500 wrap-break-word">
                  {testatorSignedAt
                    ? `Signing date source: ${testatorSignedAt.toLocaleString()}`
                    : 'No signing date found yet; using manual reminder date until execution date is captured.'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Solicitor notes</p>
          <p className="text-sm text-slate-600 mt-1">Internal notes remain outside the client-facing intake workflow. {notesDirty && <span className="font-medium text-amber-700">Unsaved changes — save before leaving.</span>}</p>
          <textarea
            value={solicitorNotes}
            onChange={(event) => setSolicitorNotes(event.target.value)}
            rows={12}
            className="mt-4 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Record review notes, missing instructions, verification follow-up, or execution reminders."
          />
          <button
            type="button"
            onClick={handleSaveNotes}
            disabled={savingNotes}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60"
          >
            <Save size={16} />
            {savingNotes ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      </section>

      <section
        ref={clientIdSectionRef}
        id="client-id-documents"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h2 className="text-lg font-semibold text-slate-900">Client ID documents</h2>
        <p className="mt-1 text-sm text-slate-600">
          Documents uploaded by the client during identity verification. Check here for photo ID, proof of address, and selfie.
        </p>
        {idDocs.length > 0 ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {idDocs.map(({ key, label, dataUrl }) => (
              <IdDocPreview key={key} label={label} dataUrl={dataUrl} />
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-6 text-center">
            <IdCard size={32} className="mx-auto text-slate-400" aria-hidden />
            <p className="mt-3 text-sm font-medium text-slate-700">No ID documents uploaded yet</p>
            <p className="mt-1 text-xs text-slate-500">
              This client has not yet completed identity verification. Ask them to upload photo ID, proof of address, and selfie in the intake form.
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Activity history</h2>
        <p className="mt-1 text-sm text-slate-600">What happened on this matter and what the client might still need to do.</p>
        <div className="mt-4 space-y-3">
          {activity.length === 0 ? (
            <p className="text-sm text-slate-600">No activity has been recorded yet.</p>
          ) : activity.map((item) => {
            const { title, summary, actorLabel } = describeActivity(item);
            return (
              <div key={item.id} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-900">{title}</p>
                  <p className="text-xs text-slate-500 shrink-0">{formatDate(item.created_at)}</p>
                </div>
                <p className="mt-1 text-xs text-slate-500">{actorLabel}</p>
                {summary ? (
                  <p className="mt-2 text-sm text-slate-700">{summary}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      {matter && (
        <ConfirmModal
          open={deleteConfirmOpen}
          onClose={() => setDeleteConfirmOpen(false)}
          onConfirm={handleConfirmDelete}
          title="Permanently remove this matter?"
          confirmLabel="Remove matter"
          cancelLabel="Cancel"
          variant="danger"
        >
          <p className="font-medium text-slate-900">Reference: {matter.client_reference || matter.id}</p>
          <p className="mt-2 text-slate-700">
            All client data, solicitor notes, and activity for this matter will be deleted. This cannot be undone.
          </p>
        </ConfirmModal>
      )}
      <ClientEmailDraftModal
        open={clientEmailDraftOpen && !!emailDraft}
        onClose={() => setClientEmailDraftOpen(false)}
        draft={emailDraft}
      />
      <MatterQuickActionModal
        open={!!quickActionCategory}
        onClose={closeQuickAction}
        matter={matter}
        category={quickActionCategory}
        onSaved={handleQuickActionSaved}
      />
    </div>
  );
}
