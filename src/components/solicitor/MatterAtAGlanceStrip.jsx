import React from 'react';
import { Link } from 'react-router-dom';
import { Copy, Download } from 'lucide-react';
import { getMatterAtAGlanceSummary } from '../../lib/matterWorkflowSummary.js';

const BADGE_TONE_CLASS = {
  rose: 'border-rose-200 bg-rose-100 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/50 dark:text-rose-100',
  amber: 'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/50 dark:text-amber-100',
  emerald: 'border-emerald-200 bg-emerald-100 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100',
};

function formatWhen(iso) {
  if (!iso) return 'Not available';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return 'Not available';
  }
}

export default function MatterAtAGlanceStrip({
  matter,
  compact = false,
  onCopySecureResume,
  onCopyReferenceEmail,
  resumeEmailHelperText,
  onDownloadClientPdf,
  clientPdfBusy = false,
  showQuickActions = false,
}) {
  const summary = getMatterAtAGlanceSummary(matter);
  const tc = summary.testamentaryCapacity;
  const gridClass = compact
    ? 'grid grid-cols-2 gap-2 text-xs'
    : 'mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div
      className={
        compact
          ? 'mt-2 rounded-lg border border-slate-200 bg-slate-50/90 p-3 dark:border-slate-600 dark:bg-slate-800/60'
          : 'rounded-xl border border-slate-200 bg-slate-50/90 p-4 dark:border-slate-600 dark:bg-slate-800/60'
      }
    >
      <div className={gridClass}>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Completion</span>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {summary.completionPercent != null ? `${summary.completionPercent}%` : 'Not available'}
          </p>
          {summary.completionHint ? (
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">{summary.completionHint}</p>
          ) : null}
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">ID verification</span>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{summary.idVerification.label}</p>
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Testamentary Capacity</span>
          <p className="font-semibold text-slate-900 dark:text-slate-100">{tc.label}</p>
          {tc.status === 'in_progress' && tc.missing?.length > 0 ? (
            <p className="mt-0.5 text-xs text-amber-800 dark:text-amber-200">
              Missing: {tc.missing.slice(0, 2).map((m) => m.label).join('; ')}
              {tc.missing.length > 2 ? '…' : ''}
            </p>
          ) : null}
        </div>
        <div>
          <span className="text-slate-500 dark:text-slate-400">Outstanding</span>
          <p className="font-semibold text-slate-900 dark:text-slate-100">
            {summary.outstandingCount === 0 ? 'None' : `${summary.outstandingCount} item(s)`}
          </p>
        </div>
        {!compact ? (
          <div>
            <span className="text-slate-500 dark:text-slate-400">Last activity</span>
            <p className="font-medium text-slate-800 dark:text-slate-200 break-words">{formatWhen(summary.lastActivity)}</p>
          </div>
        ) : null}
      </div>
      {summary.badges.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {summary.badges.map((b) => (
            <span
              key={b.key}
              className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${BADGE_TONE_CLASS[b.tone] || BADGE_TONE_CLASS.amber}`}
            >
              {b.label}
            </span>
          ))}
        </div>
      ) : null}
      {showQuickActions && matter?.id ? (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {onCopySecureResume ? (
              <button
                type="button"
                onClick={onCopySecureResume}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              >
                <Copy size={14} />
                Copy client resume email
              </button>
            ) : null}
            {onCopyReferenceEmail ? (
              <button
                type="button"
                onClick={onCopyReferenceEmail}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
                title="No secure resume link stored — copies reference-only email"
              >
                <Copy size={14} />
                Copy client reference email
              </button>
            ) : null}
            {onDownloadClientPdf ? (
              <button
                type="button"
                onClick={onDownloadClientPdf}
                disabled={clientPdfBusy}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              >
                <Download size={14} />
                {clientPdfBusy ? 'Generating…' : 'Client intake PDF'}
              </button>
            ) : null}
            <Link
              to={`/solicitor/matters/${matter.id}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Open matter
            </Link>
          </div>
          {resumeEmailHelperText ? (
            <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200/95 rounded-lg border border-amber-200 bg-amber-50/90 px-3 py-2 dark:border-amber-500/40 dark:bg-amber-950/35">
              {resumeEmailHelperText}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
