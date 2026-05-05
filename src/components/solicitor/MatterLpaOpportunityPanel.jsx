import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { normalizeLpaState } from '../../lib/lpaOpportunityLogic.js';

/** @param {{ row: { name: string, meta: string }}} props */
function AttorneyLine({ row }) {
  return (
    <li className="text-sm text-slate-800 dark:text-slate-200 wrap-break-word">
      <span className="font-semibold">{row.name}</span>
      {row.meta ? <span className="text-slate-600 dark:text-slate-400"> — {row.meta}</span> : null}
    </li>
  );
}

function formatPersonName(p) {
  if (!p || typeof p !== 'object') return '';
  const fn = String(p.firstName || p.first_name || '').trim();
  const ln = String(p.lastName || p.last_name || '').trim();
  const bits = [fn, ln].filter(Boolean);
  if (bits.length) return bits.join(' ');
  const full = String(p.fullName || p.name || '').trim();
  return full;
}

/** @param {unknown} payload */
export function pickNaturalAttorneyCandidates(payload) {
  if (!payload || typeof payload !== 'object') return [];
  const rows = [];
  const ex = /** @type {{ executorData?: unknown[] }} */ (payload).executorData;
  if (Array.isArray(ex)) {
    ex.forEach((p) => {
      const name = formatPersonName(p);
      if (name) rows.push({ name, meta: 'Executor — possible P&F attorney' });
    });
  }
  const g = /** @type {{ guardianData?: unknown[] }} */ (payload).guardianData;
  if (Array.isArray(g)) {
    g.forEach((p) => {
      const name = formatPersonName(p);
      if (name) rows.push({ name, meta: 'Guardian — possible H&W attorney' });
    });
  }
  return rows;
}

function triggerRowsFromLpa(lpa) {
  const t = lpa.lpa_triggers || {};
  const rows = [];
  if (t.businessInterests) {
    rows.push({
      label: 'Business interests',
      detail: 'Client confirmed business interests at intake',
      flag: 'Urgent — P&F LPA',
      tone: 'urgent',
    });
  }
  if (t.propertyTrust) rows.push({ label: 'Property trust', detail: 'Trust path selected', flag: 'P&F LPA alongside', tone: 'high' });
  if (t.minorChild) rows.push({ label: 'Minor children', detail: 'Under-18 dependent in guardian flow', flag: 'H&W LPA', tone: 'high' });
  if (t.singleNoPartner) rows.push({ label: 'No partner captured', detail: 'Single / widowed / divorced', flag: 'No default attorney', tone: 'high' });
  if (typeof t.age === 'number') {
    rows.push({
      label: 'Age from intake',
      detail: `${t.age} years old`,
      flag: t.age >= 65 ? 'Elevated priority window' : 'Standard',
      tone: t.age >= 65 ? 'high' : 'std',
    });
  }
  if (t.capacityConcern) rows.push({ label: 'Capacity', detail: 'TC concern flagged', flag: 'Urgent — LPA before capacity lost', tone: 'urgent' });
  return rows;
}

const FLAG_BADGE = {
  urgent: 'border-rose-400/70 bg-rose-500/10 text-rose-900 dark:border-rose-500/45 dark:bg-rose-500/15 dark:text-rose-50',
  high: 'border-amber-400/70 bg-amber-500/10 text-amber-950 dark:border-amber-500/35 dark:bg-amber-500/10 dark:text-amber-50',
  std: 'border-slate-400/70 bg-slate-500/10 text-slate-900 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-50',
};

/**
 * Solicitor-facing summary of client LPA prompts (stored on payload as `lpa_opportunity`).
 * @param {{ mergedPayload?: Record<string, unknown> }} props
 */
export default function MatterLpaOpportunityPanel({ mergedPayload }) {
  const lpa = normalizeLpaState(mergedPayload?.lpa_opportunity);
  const hasSignal =
    (lpa.lpa_priority && lpa.lpa_priority !== 'none')
    || (lpa.lpa_seeds_shown && lpa.lpa_seeds_shown.length > 0)
    || Object.keys(lpa.lpa_triggers || {}).length > 0
    || lpa.lpa_client_response;

  const trigRows = useMemo(() => triggerRowsFromLpa(lpa), [lpa]);
  const attorneys = useMemo(() => pickNaturalAttorneyCandidates(mergedPayload || {}), [mergedPayload]);

  const types = Array.isArray(lpa.lpa_types_recommended)
    ? lpa.lpa_types_recommended.map((x) =>
        x === 'property_financial' ? 'Property & financial affairs' : x === 'health_welfare' ? 'Health & welfare' : String(x),
      )
    : [];

  const responseLabel =
    lpa.lpa_client_response === 'interested'
      ? 'Client asked to add LPA to appointment'
      : lpa.lpa_client_response === 'has_one'
        ? 'Client reports they already have a valid LPA'
        : lpa.lpa_client_response === 'declined'
          ? 'Client declined / no thanks (may still advise)'
          : 'No response captured';

  const raiseWhen =
    lpa.lpa_priority === 'urgent'
      ? 'Before or at the start of the appointment — do not delay'
      : lpa.lpa_priority === 'high'
        ? 'At the appointment — frame alongside the will discussion'
        : 'At the end of the appointment or in the covering letter';

  if (!hasSignal) {
    return (
      <div className="matter-lpa-card rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2 dark:border-slate-600 dark:bg-slate-800/70">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-slate-500 dark:text-slate-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">LPA opportunity</p>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              No contextual LPA prompts were recorded on this submission (or intake predates this feature).
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="matter-lpa-card rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 sm:col-span-2 dark:border-indigo-500/40 dark:bg-indigo-500/10">
      <div className="flex items-start gap-2">
        <ClipboardList className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600 dark:text-indigo-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-900 dark:text-indigo-100">LPA opportunity (from questionnaire)</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-indigo-300/90 bg-white px-3 py-1 text-xs font-bold text-indigo-900 dark:border-indigo-500/50 dark:bg-slate-900/60 dark:text-indigo-100">
              Priority: {lpa.lpa_priority || 'none'}
            </span>
            <span className="inline-flex rounded-full border border-slate-300/90 bg-white px-3 py-1 text-xs font-semibold text-slate-800 dark:border-slate-500/50 dark:bg-slate-900/60 dark:text-slate-100">
              {responseLabel}
            </span>
          </div>

          {trigRows.length ? (
            <ul className="mt-4 space-y-3">
              {trigRows.map((row) => (
                <li
                  key={row.label}
                  className="rounded-xl border bg-white px-3 py-2.5 dark:border-slate-600 dark:bg-slate-900/55"
                >
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{row.label}</p>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">{row.detail}</p>
                    </div>
                    <span
                      className={`inline-flex shrink-0 self-start rounded-full border px-2.5 py-1 text-[11px] font-bold ${FLAG_BADGE[row.tone] || FLAG_BADGE.std}`}
                    >
                      {row.flag}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : null}

          {types.length ? (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Suggested LPA types</p>
              <ul className="mt-2 list-disc pl-5 text-sm text-slate-800 dark:text-slate-200">
                {types.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {attorneys.length ? (
            <div className="mt-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">Natural attorney prompts (executors / guardians)</p>
              <ul className="mt-2 space-y-1">
                {attorneys.slice(0, 12).map((r) => (
                  <AttorneyLine key={`${r.name}-${r.meta}`} row={r} />
                ))}
              </ul>
            </div>
          ) : null}

          {Array.isArray(lpa.lpa_seeds_shown) && lpa.lpa_seeds_shown.length ? (
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer font-semibold text-slate-700 dark:text-slate-300">Seeds logged ({lpa.lpa_seeds_shown.length})</summary>
              <p className="mt-2 wrap-break-word text-slate-600 dark:text-slate-400">{lpa.lpa_seeds_shown.join(', ')}</p>
            </details>
          ) : null}

          <p className="mt-4 border-t border-indigo-200/80 pt-3 text-xs italic text-slate-700 dark:border-indigo-500/30 dark:text-slate-300">
            When to raise: {raiseWhen}
          </p>
        </div>
      </div>
    </div>
  );
}
