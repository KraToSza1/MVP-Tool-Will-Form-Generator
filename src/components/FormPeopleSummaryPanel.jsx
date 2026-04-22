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
        <div className="flex items-start gap-3 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-700 sm:col-span-2 dark:border-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
          <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          <span>No people recorded in the saved questionnaire yet.</span>
        </div>
      );
    }
    return null;
  }

  const count = entries.length;

  /* Light: same language as monetary-gifts tiles (indigo/slate). Dark: navy strip + light text */
  const stripClass =
    'mb-3 flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl border border-indigo-100 bg-indigo-50/90 px-3 py-2.5 shadow-inner sm:px-4 sm:col-span-2 dark:border-slate-600 dark:bg-slate-800/95';

  const textPrimary = 'text-slate-800 dark:text-slate-100';
  const textMuted = 'text-slate-600 dark:text-slate-400';
  const btnClass =
    'inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-indigo-500/50 dark:bg-indigo-600/30 dark:text-indigo-100 dark:shadow-none dark:hover:bg-indigo-600/50 dark:focus-visible:ring-indigo-400 dark:focus-visible:ring-offset-slate-900';

  return (
    <>
      <div className={stripClass}>
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600 dark:bg-slate-700 dark:text-indigo-300">
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
