import React, { useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { buildPdfPreflightChecklist, pdfPreflightNeedsAttention } from '../../lib/pdfPreflightChecklist.js';

const STATUS = {
  pass: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-700 dark:text-emerald-300',
    badgeClass:
      'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100',
    cardClass: 'border-emerald-200/80 bg-emerald-50/50 dark:border-emerald-500/30 dark:bg-emerald-950/20',
    hoverClass: 'hover:border-emerald-300 hover:shadow-md dark:hover:border-emerald-400/50',
    label: 'OK',
  },
  warn: {
    icon: AlertTriangle,
    iconClass: 'text-amber-700 dark:text-amber-300',
    badgeClass:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100',
    cardClass: 'border-amber-200/80 bg-amber-50/50 dark:border-amber-500/30 dark:bg-amber-950/20',
    hoverClass: 'hover:border-amber-300 hover:shadow-md dark:hover:border-amber-400/50',
    label: 'Needs review',
  },
  fail: {
    icon: AlertTriangle,
    iconClass: 'text-rose-700 dark:text-rose-300',
    badgeClass:
      'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/40 dark:text-rose-100',
    cardClass: 'border-rose-200/80 bg-rose-50/50 dark:border-rose-500/30 dark:bg-rose-950/20',
    hoverClass: 'hover:border-rose-300 hover:shadow-md dark:hover:border-rose-400/50',
    label: 'Action needed',
  },
};

function PreflightCard({ item, meta, action, onActivate }) {
  const Icon = meta.icon;
  const clickable = action && action.type !== 'none' && action.cta;

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <Icon size={20} className={`shrink-0 ${meta.iconClass}`} aria-hidden />
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badgeClass}`}
        >
          {meta.label}
        </span>
      </div>
      <h3 className="mt-2 text-sm font-semibold leading-snug text-slate-900 dark:text-slate-100">{item.label}</h3>
      <p className="mt-1 flex-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400 break-words">
        {item.detail}
      </p>
      {clickable ? (
        <p className="mt-2 inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-indigo-700 dark:text-indigo-300">
          {action.cta}
          <ArrowRight size={14} className="shrink-0" aria-hidden />
        </p>
      ) : null}
    </>
  );

  const className = `flex min-h-[120px] min-w-0 flex-col rounded-xl border p-3 text-left shadow-sm transition ${meta.cardClass} ${
    clickable ? `cursor-pointer ${meta.hoverClass} focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-slate-900` : ''
  }`;

  if (!clickable) {
    return (
      <article role="listitem" className={className}>
        {body}
      </article>
    );
  }

  return (
    <button type="button" role="listitem" className={className} onClick={() => onActivate(action)}>
      {body}
    </button>
  );
}

export default function PdfPreflightPanel({
  matter,
  mergedPayload,
  onScrollToId,
  onScrollToChecklist,
  onOpenOutstandingCategory,
}) {
  const navigate = useNavigate();
  const items = useMemo(
    () => buildPdfPreflightChecklist({ matter, mergedPayload }),
    [matter, mergedPayload],
  );
  const needsAttention = pdfPreflightNeedsAttention(items);

  const handleActivate = useCallback(
    (action) => {
      if (!action || action.type === 'none') return;
      if (action.type === 'link' && action.to) {
        navigate(action.to, { state: action.state ?? {} });
        return;
      }
      if (action.type === 'scroll_id') {
        onScrollToId?.();
        return;
      }
      if (action.type === 'scroll_checklist') {
        onScrollToChecklist?.();
        return;
      }
      if (action.type === 'outstanding_modal' && action.outstandingCategory) {
        onOpenOutstandingCategory?.(action.outstandingCategory);
      }
    },
    [navigate, onScrollToId, onScrollToChecklist, onOpenOutstandingCategory],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            PDF preflight
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Checklist before execution PDF — tap a card to go to where you can fix it.
          </p>
        </div>
        {needsAttention ? (
          <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-100">
            Review suggested
          </span>
        ) : (
          <span className="rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/40 dark:text-emerald-100">
            Looks ready
          </span>
        )}
      </div>
      <div
        className="mt-4 grid grid-cols-1 gap-3 min-w-0 sm:grid-cols-2 xl:grid-cols-3"
        role="list"
        aria-label="PDF preflight checks"
      >
        {items.map((item) => {
          const meta = STATUS[item.status] || STATUS.warn;
          return (
            <PreflightCard
              key={item.id}
              item={item}
              meta={meta}
              action={item.action}
              onActivate={handleActivate}
            />
          );
        })}
      </div>
    </div>
  );
}
