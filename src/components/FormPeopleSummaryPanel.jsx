import React, { useMemo, useState } from 'react';
import { Users, PanelRightOpen } from 'lucide-react';
import { getFormPeopleEntries } from '../lib/formPeopleSummary.js';
import PeopleOverviewModal from './PeopleOverviewModal.jsx';

/**
 * Progressive disclosure: one compact row in the form flow; full people list opens in a modal overlay.
 * Stops the people block from pushing questionnaire content down (fits “supplementary reference” UX pattern).
 */
export default function FormPeopleSummaryPanel({ payload, variant = 'client' }) {
  const entries = useMemo(() => getFormPeopleEntries(payload), [payload]);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const isSolicitor = variant === 'solicitor';

  if (entries.length === 0) {
    if (isSolicitor) {
      return (
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-600 bg-slate-800/60 px-3 py-2.5 text-sm text-slate-300 sm:col-span-2">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          <span>No people recorded in the saved questionnaire yet.</span>
        </div>
      );
    }
    return null;
  }

  const count = entries.length;

  const stripClass =
    'mb-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-600 bg-slate-800/95 px-3 py-2.5 shadow-inner sm:px-4 sm:col-span-2';

  const textPrimary = 'text-slate-100';
  const textMuted = 'text-slate-400';
  const btnClass =
    'inline-flex shrink-0 items-center gap-2 rounded-lg border border-indigo-500/50 bg-indigo-600/30 px-3 py-2 text-sm font-semibold text-indigo-100 hover:bg-indigo-600/45 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';

  return (
    <>
      <div className={stripClass}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-indigo-300">
            <Users className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <p className={`text-sm font-semibold leading-tight ${textPrimary}`}>
              {count} {count === 1 ? 'person' : 'people'} in your answers
            </p>
            <p className={`text-xs leading-snug ${textMuted}`}>
              Reference only — open when you need it; your questions stay below.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOverviewOpen(true)}
          className={btnClass}
        >
          <PanelRightOpen className="h-4 w-4" aria-hidden />
          Review
        </button>
      </div>

      <PeopleOverviewModal open={overviewOpen} onClose={() => setOverviewOpen(false)} entries={entries} />
    </>
  );
}
