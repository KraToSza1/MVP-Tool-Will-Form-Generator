import React, { useEffect, useMemo, useState } from 'react';
import { X, ClipboardList } from 'lucide-react';
import { buildClientSubmitReviewSections } from '../lib/clientSubmitReviewSummary.js';

const CONFIRM_LABEL =
  'I confirm this information is correct and ready to send to Aristone Solicitors.';

export default function ClientSubmitReviewModal({
  open,
  formValues,
  onCancel,
  onConfirm,
  submitting = false,
}) {
  const [confirmed, setConfirmed] = useState(false);
  const sections = useMemo(() => buildClientSubmitReviewSections(formValues), [formValues]);

  useEffect(() => {
    if (open) setConfirmed(false);
  }, [open]);

  if (!open) return null;

  const overlayClass =
    'fixed inset-0 z-[56] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm px-4 py-6 dark:bg-black/65';
  const panelClass =
    'flex max-h-[min(90vh,720px)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-600 dark:bg-slate-900';

  return React.createElement(
    'div',
    { className: overlayClass, role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'client-submit-review-title' },
    React.createElement(
      'div',
      { className: panelClass, onClick: (e) => e.stopPropagation() },
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          'header',
          { className: 'flex items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-600 dark:bg-slate-800/80' },
          React.createElement(
            'div',
            { className: 'flex min-w-0 items-start gap-3' },
            React.createElement(ClipboardList, { className: 'mt-0.5 h-6 w-6 shrink-0 text-indigo-600 dark:text-indigo-400', 'aria-hidden': true }),
            React.createElement(
              'div',
              { className: 'min-w-0' },
              React.createElement('h2', { id: 'client-submit-review-title', className: 'text-lg font-bold text-slate-900 dark:text-slate-100' }, 'Review before you submit'),
              React.createElement('p', { className: 'mt-1 text-sm text-slate-600 dark:text-slate-400' }, 'Check your main choices below. This summary is for your convenience only and is not legal advice.'),
            ),
          ),
          React.createElement('button', {
            type: 'button',
            onClick: onCancel,
            className: 'rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100 dark:border-slate-500 dark:text-slate-300 dark:hover:bg-slate-700',
            'aria-label': 'Close',
          }, React.createElement(X, { size: 20 })),
        ),
        React.createElement(
          'div',
          { className: 'flex-1 overflow-y-auto px-5 py-4' },
          sections.map((section) =>
            React.createElement(
              'section',
              { key: section.id, className: 'mb-4 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-600 dark:bg-slate-800/50' },
              React.createElement('h3', { className: 'text-sm font-semibold text-slate-900 dark:text-slate-100' }, section.title),
              React.createElement(
                'ul',
                { className: 'mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300' },
                section.lines.map((line, i) => React.createElement('li', { key: i, className: 'break-words' }, line)),
              ),
            ),
          ),
          React.createElement(
            'label',
            { className: 'mt-2 flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-500/40 dark:bg-indigo-950/40' },
            React.createElement('input', {
              type: 'checkbox',
              className: 'mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500',
              checked: confirmed,
              onChange: (e) => setConfirmed(e.target.checked),
            }),
            React.createElement('span', { className: 'text-sm font-medium text-slate-800 dark:text-slate-200' }, CONFIRM_LABEL),
          ),
        ),
        React.createElement(
          'footer',
          { className: 'flex flex-col gap-2 border-t border-slate-200 bg-white px-5 py-4 dark:border-slate-600 dark:bg-slate-900 sm:flex-row sm:justify-end' },
          React.createElement('button', {
            type: 'button',
            onClick: onCancel,
            disabled: submitting,
            className: 'min-h-[44px] rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100',
          }, 'Go back'),
          React.createElement('button', {
            type: 'button',
            onClick: () => { if (confirmed && !submitting) onConfirm(); },
            disabled: !confirmed || submitting,
            className: 'min-h-[44px] rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50',
          }, submitting ? 'Submitting…' : 'Submit to Aristone'),
        ),
      ),
    ),
  );
}
