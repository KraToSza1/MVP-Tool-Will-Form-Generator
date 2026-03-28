import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, User } from 'lucide-react';

/**
 * Read-only modal for full person / role details from FormPeopleSummaryPanel.
 */
export default function PersonSummaryDetailModal({ open, onClose, entry }) {
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
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !entry) return null;

  const panel =
    'border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/10';
  const muted = 'text-slate-400';
  const dtCls = 'text-slate-400';
  const ddCls = 'text-slate-100';
  const badge = 'bg-indigo-500/20 text-indigo-200 ring-1 ring-indigo-500/40';

  const node = (
    <div
      className="fixed inset-0 z-[110] flex items-end justify-center bg-black/60 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="person-summary-modal-title"
        className={`will-tool-person-summary-modal flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl ${panel}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="will-tool-person-summary-header flex shrink-0 items-start justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <span
              className={`will-tool-person-summary-badge inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge}`}
            >
              {entry.role}
            </span>
            <h2
              id="person-summary-modal-title"
              className="mt-2 text-lg font-semibold leading-snug text-slate-100 sm:text-xl"
            >
              {entry.title}
            </h2>
            <p className={`mt-1 text-xs ${muted}`}>Full details as entered on the questionnaire.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="will-tool-person-summary-body min-h-0 flex-1 overflow-y-auto bg-slate-900 px-4 py-4 sm:px-5">
          {entry.lines.length === 0 ? (
            <p className={`flex items-center gap-2 text-sm ${muted}`}>
              <User className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
              No extra fields beyond the name above.
            </p>
          ) : (
            <dl className="grid gap-3 sm:grid-cols-1">
              {entry.lines.map(({ label, value }, idx) => (
                <div
                  key={`${label}-${idx}`}
                  className="will-tool-person-summary-row rounded-xl border border-slate-700 bg-slate-800 px-3 py-2.5"
                >
                  <dt className={`text-xs font-medium uppercase tracking-wide ${dtCls}`}>{label}</dt>
                  <dd className={`mt-1 text-sm leading-relaxed ${ddCls} wrap-break-word`}>{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <div className="will-tool-person-summary-footer shrink-0 border-t border-slate-700 bg-slate-950 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 sm:w-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(node, document.body);
}
