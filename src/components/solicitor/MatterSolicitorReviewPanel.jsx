import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, FileDown, Save } from 'lucide-react';
import { toast } from 'sonner';
import {
  MATTER_REVIEW_DECISION,
  buildFollowUpClientEmail,
  buildReviewPackDocument,
  buildReviewPackPrintHtml,
  buildSolicitorReviewPayloadPatch,
  getReviewDecisionLabel,
  parseSolicitorReviewMeta,
} from '../../lib/matterReviewPack.js';
import { patchMatterSolicitorPayload, updateSolicitorNotes } from '../../lib/matters.js';

const DECISION_OPTIONS = Object.values(MATTER_REVIEW_DECISION);

const textareaClass =
  'mt-2 w-full min-h-[88px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-400';

export default function MatterSolicitorReviewPanel({ matter, onMatterUpdated }) {
  const initial = useMemo(
    () => parseSolicitorReviewMeta(matter?.solicitor_payload, matter?.solicitor_notes),
    [matter?.solicitor_payload, matter?.solicitor_notes],
  );

  const [internalNotes, setInternalNotes] = useState(initial.internalNotes);
  const [riskNotes, setRiskNotes] = useState(initial.riskNotes);
  const [followUpQuestions, setFollowUpQuestions] = useState(initial.followUpQuestions);
  const [reviewDecision, setReviewDecision] = useState(initial.reviewDecision);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInternalNotes(initial.internalNotes);
    setRiskNotes(initial.riskNotes);
    setFollowUpQuestions(initial.followUpQuestions);
    setReviewDecision(initial.reviewDecision);
  }, [matter?.id, initial.internalNotes, initial.riskNotes, initial.followUpQuestions, initial.reviewDecision]);

  const dirty =
    internalNotes !== initial.internalNotes ||
    riskNotes !== initial.riskNotes ||
    followUpQuestions !== initial.followUpQuestions ||
    reviewDecision !== initial.reviewDecision;

  const clientName =
    matter?.client_name ||
    matter?.client_snapshot?.fullName ||
    [matter?.client_snapshot?.firstName, matter?.client_snapshot?.lastName].filter(Boolean).join(' ').trim() ||
    'Client';

  const handleSave = useCallback(async () => {
    if (!matter?.id) return;
    setSaving(true);
    const patch = buildSolicitorReviewPayloadPatch({
      internalNotes,
      riskNotes,
      followUpQuestions,
      reviewDecision,
    });
    const [payloadResult, notesResult] = await Promise.all([
      patchMatterSolicitorPayload(matter.id, patch),
      updateSolicitorNotes(matter.id, internalNotes),
    ]);
    setSaving(false);

    if (payloadResult.error || notesResult.error) {
      toast.error('Could not save review notes', {
        description: payloadResult.error || notesResult.error,
      });
      return;
    }

    const updated = payloadResult.data
      ? { ...payloadResult.data, solicitor_notes: notesResult.data?.solicitor_notes ?? internalNotes }
      : { ...matter, solicitor_notes: internalNotes, solicitor_payload: { ...matter.solicitor_payload, ...patch } };

    onMatterUpdated?.(updated);
    toast.success('Review notes saved');
  }, [matter, internalNotes, riskNotes, followUpQuestions, reviewDecision, onMatterUpdated]);

  const handleCopyFollowUpEmail = useCallback(async () => {
    const body = buildFollowUpClientEmail({
      clientName,
      reference: matter?.client_reference,
      questions: followUpQuestions,
    });
    try {
      await navigator.clipboard.writeText(body);
      toast.success('Follow-up email copied to clipboard');
    } catch {
      toast.error('Could not copy to clipboard');
    }
  }, [clientName, matter?.client_reference, followUpQuestions]);

  const handlePrintReviewPack = useCallback(() => {
    const doc = buildReviewPackDocument(matter);
    const html = buildReviewPackPrintHtml(doc);
    // No 'noopener' feature here: with it, window.open() returns null and we could never write the pack.
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('Pop-up blocked — allow pop-ups to print the review pack');
      return;
    }
    win.opener = null;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch {
        /* user can print manually */
      }
    }, 400);
  }, [matter]);

  if (!matter) return null;

  return (
    <section className="rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-slate-100">Solicitor review notes</h2>
          <p className="mt-1 text-sm text-slate-400">
            Internal only — never included in client intake or execution PDFs.
            {dirty ? (
              <span className="ml-1 font-medium text-amber-300"> Unsaved changes.</span>
            ) : null}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          <button
            type="button"
            onClick={handleCopyFollowUpEmail}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <Copy size={16} aria-hidden />
            Copy follow-up email
          </button>
          <button
            type="button"
            onClick={handlePrintReviewPack}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-indigo-500/50 bg-indigo-950/50 px-4 py-2.5 text-sm font-semibold text-indigo-100 hover:bg-indigo-900/60 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <FileDown size={16} aria-hidden />
            Print review pack
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div className="min-w-0">
          <label htmlFor="review-internal-notes" className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Internal notes
          </label>
          <textarea
            id="review-internal-notes"
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            rows={5}
            className={textareaClass}
            placeholder="Review notes, missing instructions, next steps…"
          />
        </div>
        <div className="min-w-0">
          <label htmlFor="review-risk-notes" className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Risk notes
          </label>
          <textarea
            id="review-risk-notes"
            value={riskNotes}
            onChange={(e) => setRiskNotes(e.target.value)}
            rows={5}
            className={textareaClass}
            placeholder="Capacity concerns, conflicts, vulnerable client flags…"
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <label htmlFor="review-follow-up" className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Follow-up questions for client
          </label>
          <textarea
            id="review-follow-up"
            value={followUpQuestions}
            onChange={(e) => setFollowUpQuestions(e.target.value)}
            rows={4}
            className={textareaClass}
            placeholder="One question per line — used in Copy follow-up email"
          />
        </div>
        <div className="min-w-0 lg:col-span-2">
          <label htmlFor="review-decision" className="text-xs font-bold uppercase tracking-wide text-slate-400">
            Review decision / workflow status
          </label>
          <select
            id="review-decision"
            value={reviewDecision}
            onChange={(e) => setReviewDecision(e.target.value)}
            className="mt-2 w-full min-h-[44px] rounded-xl border border-slate-600 bg-slate-950 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="">— Auto (from outstanding items) —</option>
            {DECISION_OPTIONS.map((key) => (
              <option key={key} value={key}>
                {getReviewDecisionLabel(key)}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Dashboard pipeline badge uses outstanding checklist first; this records your intended next step.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !dirty}
        className="mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >
        <Save size={16} aria-hidden />
        {saving ? 'Saving…' : 'Save review notes'}
      </button>
    </section>
  );
}
