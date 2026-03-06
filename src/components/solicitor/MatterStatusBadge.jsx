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
  verification_pending: 'Verification Pending',
  in_review: 'In Review',
  completed: 'Completed',
};

export default function MatterStatusBadge({ status }) {
  const key = status || 'draft';
  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${STYLES[key] || STYLES.draft}`}>
      {LABELS[key] || key}
    </span>
  );
}
