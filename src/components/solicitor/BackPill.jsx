import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

/** Compact "← Back" pill used at the top of every solicitor page (sits next to the page's section pill). */
export default function BackPill({ to = '/solicitor', label = 'Back to dashboard' }) {
  return (
    <Link
      to={to}
      aria-label={label}
      title={label}
      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      Back
    </Link>
  );
}
