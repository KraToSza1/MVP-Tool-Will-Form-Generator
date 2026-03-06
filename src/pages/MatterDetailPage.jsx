import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Download, ExternalLink, FilePenLine, FileText, IdCard, Save } from 'lucide-react';
import MatterStatusBadge from '../components/solicitor/MatterStatusBadge.jsx';
import { useFormDefinition } from '../context/FormDefinitionContext.jsx';
import { assignMatter, getMatterDetail, listStaffProfiles, MATTER_STATUS, updateMatterStatus, updateSolicitorNotes } from '../lib/matters.js';
import { mergeMatterPayloads } from '../lib/formPayload.js';

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Date(value).toLocaleString();
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

function IdDocPreview({ label, dataUrl }) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const isImage = dataUrl.startsWith('data:image/');
  const isPdf = dataUrl.startsWith('data:application/pdf');
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-3 flex flex-wrap items-start gap-3">
        {isImage && (
          <img
            src={dataUrl}
            alt={label}
            className="max-h-40 rounded-lg border border-slate-200 object-contain"
          />
        )}
        {isPdf && (
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <FileText size={20} className="text-red-600" />
            <span className="text-sm font-medium text-slate-700">PDF document</span>
          </div>
        )}
        <a
          href={dataUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-100 px-3 py-2 text-sm font-medium text-indigo-800 hover:bg-indigo-200"
        >
          <ExternalLink size={14} />
          {isImage ? 'Open full size' : 'Open document'}
        </a>
      </div>
    </div>
  );
}

export default function MatterDetailPage() {
  const { matterId } = useParams();
  const [matter, setMatter] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [solicitorNotes, setSolicitorNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [staffProfiles, setStaffProfiles] = useState([]);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const clientIdSectionRef = useRef(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getMatterDetail(matterId), listStaffProfiles()]).then(([detailResult, staffResult]) => {
      if (!active) return;
      if (detailResult.error) {
        toast.error('Could not load matter', { description: detailResult.error });
      } else {
        setMatter(detailResult.matter || null);
        setActivity(detailResult.activity || []);
        setSolicitorNotes(detailResult.matter?.solicitor_notes || '');
      }

      if (staffResult.error) {
        toast.error('Could not load staff list', { description: staffResult.error });
      } else {
        setStaffProfiles(staffResult.data || []);
      }

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
  const { formData } = useFormDefinition();

  const idDocs = useMemo(() => {
    const iv = mergedPayload?.identityVerification;
    if (!iv || typeof iv !== 'object') return [];
    return Object.entries(ID_DOC_LABELS)
      .map(([key, label]) => ({ key, label, dataUrl: iv[key] }))
      .filter((d) => d.dataUrl);
  }, [mergedPayload?.identityVerification]);

  const scrollToClientId = () => {
    setTimeout(() => {
      clientIdSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleDownloadPDF = async () => {
    if (!matter || !mergedPayload || Object.keys(mergedPayload).length === 0) {
      toast.error('No form data', { description: 'This matter has no saved form data yet. Open the form and save, or wait for the client to submit.' });
      return;
    }
    setIsGeneratingPDF(true);
    const toastId = toast.loading('Generating PDF...');
    try {
      const pdfModule = await import('../components/PDFGeneratorJSPDF.js');
      const generatePDFWithJSPDF = pdfModule.generatePDFWithJSPDF;
      if (!generatePDFWithJSPDF) {
        toast.error('PDF generator not available', { id: toastId, description: 'Could not load PDF generator. Try refreshing the page.' });
        return;
      }
      const pdfResult = await generatePDFWithJSPDF(mergedPayload, {}, { isClientPDF: false, formSchema: formData });
      const doc = pdfResult?.doc || pdfResult;
      const criticalIssues = pdfResult?.criticalIssues || [];
      const hasCriticalIssues = pdfResult?.hasCriticalIssues || false;

      if (hasCriticalIssues && criticalIssues.length > 0) {
        toast.error('PDF blocked', {
          id: toastId,
          description: `${criticalIssues.length} critical issue(s). Complete required fields in the form first.`,
          duration: 8000,
        });
        return;
      }

      if (!doc || typeof doc.output !== 'function') {
        toast.error('PDF generation failed', { id: toastId, description: 'No document was produced.' });
        return;
      }

      const firstName = mergedPayload.firstName || matter?.client_snapshot?.firstName || '';
      const lastName = mergedPayload.lastName || matter?.client_snapshot?.lastName || '';
      const testatorName = [firstName, lastName].filter(Boolean).join('-') || matter?.client_reference || 'Will';
      const date = new Date().toISOString().split('T')[0];
      const filename = `${testatorName}-Last-Will-${date}.pdf`;

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

      toast.success('PDF downloaded', {
        id: toastId,
        description: `Saved as ${filename}. Review for completeness before execution.`,
      });
    } catch (err) {
      const msg = err?.message || 'Unknown error';
      toast.error('PDF failed', { id: toastId, description: msg });
    } finally {
      setIsGeneratingPDF(false);
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
    const result = await assignMatter(matter.id, assignedSolicitorId);
    if (result.error) {
      toast.error('Could not assign matter', { description: result.error });
      return;
    }
    setMatter((prev) => prev ? { ...prev, assigned_solicitor_id: result.data?.assigned_solicitor_id || null } : prev);
    toast.success('Assignment updated', { description: assignedSolicitorId ? 'Matter reassigned successfully.' : 'Matter unassigned.' });
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
        <Link to="/solicitor" className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900">
          <ArrowLeft size={16} />
          Back to dashboard
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={isGeneratingPDF || !mergedPayload || Object.keys(mergedPayload).length === 0}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Generate and download the will PDF from current client and solicitor data"
          >
            {isGeneratingPDF ? (
              <>
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" aria-hidden />
                Generating…
              </>
            ) : (
              <>
                <Download size={16} />
                Download PDF
              </>
            )}
          </button>
          <Link
            to={`/solicitor/matters/${matter.id}/form`}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            title="Edit client answers and complete Testamentary Capacity"
          >
            <FilePenLine size={16} />
            Edit questionnaire
          </Link>
        </div>
      </div>
      <p className="text-sm text-slate-600 -mt-2">
        <strong>Edit questionnaire</strong> lets you change any client answers, complete Testamentary Capacity, and save to the matter. <strong>Download PDF</strong> builds the will from saved data for review.
      </p>

      <section className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Matter</p>
              <h1 className="mt-2 text-2xl font-bold text-slate-900">{matter.client_reference}</h1>
              <p className="mt-1 text-sm text-slate-600">Submitted {formatDate(matter.submitted_at)}</p>
            </div>
            <MatterStatusBadge status={matter.status} />
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
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.client_phone || clientSnapshot.phoneNumber || 'Not captured'}</p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Verification</p>
              <p className="mt-2 text-sm font-medium text-slate-900">{matter.outstanding_verification ? 'Outstanding' : 'Complete'}</p>
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
            <div className="rounded-xl bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Assigned solicitor</p>
              <select
                value={matter.assigned_solicitor_id || ''}
                onChange={handleAssignmentChange}
                className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Unassigned</option>
                {staffProfiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>
                    {profile.display_name || profile.email} ({profile.role})
                  </option>
                ))}
              </select>
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
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-slate-900">Solicitor notes</p>
          <p className="text-sm text-slate-600 mt-1">Internal notes remain outside the client-facing intake workflow.</p>
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
    </div>
  );
}
