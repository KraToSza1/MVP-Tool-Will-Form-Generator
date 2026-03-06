import React from 'react';

const STYLES = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-blue-100 text-blue-800 border-blue-200',
  verification_pending: 'bg-amber-100 text-amber-900 border-amber-200',
  in_review: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

const LABELS = {
  draft: 'Draft',
  submitted: 'Submitted',
  verification_pending: 'ID needed',
  in_review: 'In progress',
  completed: 'Completed',
};

const TOOLTIPS = {
  draft: 'Client has not submitted yet.',
  submitted: 'Client submitted. Awaiting your review.',
  verification_pending: 'Client ID or verification required. Chase documents or verify.',
  in_review: 'You are reviewing. Testamentary Capacity can be completed.',
  completed: 'Matter finished. Ready for execution.',
};

export default function MatterStatusBadge({ status }) {
  const key = status || 'draft';
  const tooltip = TOOLTIPS[key] || TOOLTIPS.draft;
  return (
    <span
      title={tooltip}
      className={`inline-flex cursor-help items-center rounded-full border px-3 py-1 text-xs font-semibold ${STYLES[key] || STYLES.draft}`}
    >
      {LABELS[key] || key}
    </span>
  );
}
