import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';

/**
 * Mariyam / design-team routes (calendar, availability, reports) that are not wired yet.
 * Keeps navigation consistent with the Aristone portal mock.
 */
export default function SolicitorPlaceholderPage({ title, description }) {
  return (
    <div className="min-w-0 max-w-2xl">
      <Link
        to="/solicitor"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to dashboard
      </Link>
      <div className="mt-6 rounded-2xl border border-slate-600 bg-slate-900/80 p-6 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-200">
          <Construction className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">{description}</p>
        <p className="mt-4 text-xs text-slate-500">
          For now, use the main dashboard for matter list, ID verification, and Testamentary Capacity. Full scheduling and
          reporting will follow your firm&apos;s product rollout.
        </p>
      </div>
    </div>
  );
}
