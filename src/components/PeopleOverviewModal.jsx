import React, { useMemo, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Users, Eye } from 'lucide-react';
import { getPossibleDuplicateNameGroups } from '../lib/formPeopleSummary.js';
import PersonSummaryDetailModal from './PersonSummaryDetailModal.jsx';

/**
 * Full-screen style overlay with scrollable people list — keeps main form uncluttered (progressive disclosure).
 */
export default function PeopleOverviewModal({ open, onClose, entries }) {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const dupGroups = useMemo(() => getPossibleDuplicateNameGroups(entries || []), [entries]);
  const idToEntry = useMemo(() => {
    const m = new Map();
    (entries || []).forEach((e) => m.set(e.id, e));
    return m;
  }, [entries]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) setSelectedEntry(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape' && !selectedEntry) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose, selectedEntry]);

  if (!open) return null;

  /** Solicitor + client: same dark shell (dashboard rule — no light header/footer split). */
  const shell =
    'border border-slate-600 bg-slate-900 text-slate-100 shadow-2xl ring-1 ring-white/10';

  const node = (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/65 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-4"
      role="presentation"
      onClick={() => !selectedEntry && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="people-overview-title"
        className={`will-tool-people-overview-modal flex h-[100dvh] max-h-[100dvh] w-full max-w-lg flex-col sm:h-auto sm:max-h-[min(90dvh,800px)] sm:rounded-2xl ${shell}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="will-tool-people-overview-header flex shrink-0 items-center justify-between gap-3 border-b border-slate-700 bg-slate-950 px-4 py-3 sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-700 text-indigo-300">
              <Users className="h-5 w-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <h2 id="people-overview-title" className="text-base font-semibold leading-tight text-slate-100 sm:text-lg">
                People in this Will
              </h2>
              <p className="mt-0.5 text-xs text-slate-400">
                {entries?.length ?? 0} {entries?.length === 1 ? 'entry' : 'entries'} · optional reference only
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-400 hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="will-tool-people-overview-body min-h-0 flex-1 overflow-y-auto bg-slate-900 px-4 py-4 sm:px-5">
          {dupGroups.length > 0 && (
            <div
              className="mb-4 rounded-xl border border-amber-600/50 bg-amber-950/35 px-3 py-2.5 text-sm text-amber-100"
              role="status"
            >
              <p className="font-medium">Same name in more than one role</p>
              <p className="mt-1.5 text-xs leading-relaxed text-amber-100/85">
                This is often intentional (e.g. a partner or child named as both guardian and executor). Confirm with the
                client only if it might be a mistake. Professional firm lines repeated across roles are not shown here.
              </p>
              <ul className="mt-2 space-y-1 text-xs opacity-95">
                {dupGroups.map((ids, i) => (
                  <li key={i}>
                    {ids
                      .map((id) => idToEntry.get(id))
                      .filter(Boolean)
                      .map((e) => `${e.role}: ${e.title}`)
                      .join(' · ')}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <ul className="space-y-2">
            {(entries || []).map((e) => {
              const preview =
                e.lines.length > 0 ? `${e.lines[0].label}: ${e.lines[0].value}` : 'No additional fields';
              return (
                <li
                  key={e.id}
                  className="flex flex-col gap-2 rounded-xl border border-slate-600 bg-slate-800/80 p-3 hover:border-slate-500 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <span className="inline-flex rounded-full bg-indigo-500/25 px-2 py-0.5 text-xs font-semibold text-indigo-200 ring-1 ring-indigo-400/30">
                      {e.role}
                    </span>
                    <p className="mt-1.5 text-sm font-semibold text-slate-100 sm:text-base">{e.title}</p>
                    <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{preview}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedEntry(e)}
                    className="inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-500 bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-100 hover:bg-slate-700 sm:w-auto"
                  >
                    <Eye className="h-4 w-4" aria-hidden />
                    Details
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="will-tool-people-overview-footer shrink-0 border-t border-slate-700 bg-slate-950 px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Back to questionnaire
          </button>
        </div>
      </div>

      <PersonSummaryDetailModal
        open={!!selectedEntry}
        onClose={() => setSelectedEntry(null)}
        entry={selectedEntry}
      />
    </div>
  );

  return createPortal(node, document.body);
}
