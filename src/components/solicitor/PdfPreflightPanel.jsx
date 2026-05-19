import React, { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { buildPdfPreflightChecklist, pdfPreflightNeedsAttention } from '../../lib/pdfPreflightChecklist.js';

const STATUS = {
  pass: { icon: CheckCircle2, className: 'text-emerald-700 dark:text-emerald-300', label: 'OK' },
  warn: { icon: AlertTriangle, className: 'text-amber-700 dark:text-amber-300', label: 'Needs review' },
  fail: { icon: AlertTriangle, className: 'text-rose-700 dark:text-rose-300', label: 'Action needed' },
};

export default function PdfPreflightPanel({ matter, mergedPayload }) {
  const items = useMemo(
    () => buildPdfPreflightChecklist({ matter, mergedPayload }),
    [matter, mergedPayload],
  );
  const needsAttention = pdfPreflightNeedsAttention(items);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-600 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">
            PDF preflight
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            Checklist before execution PDF — not a substitute for legal review.
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
      <ul className="mt-4 space-y-2">
        {items.map((item) => {
          const meta = STATUS[item.status] || STATUS.warn;
          const Icon = meta.icon;
          return (
            <li
              key={item.id}
              className="flex gap-2 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50"
            >
              <Icon size={18} className={`mt-0.5 shrink-0 ${meta.className}`} aria-hidden />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {item.label} 
                  <span className={`text-xs font-normal ${meta.className}`}>({meta.label})</span>
                </p>
                <p className="text-xs text-slate-600 dark:text-slate-400 break-words">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
