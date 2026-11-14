import React, { useMemo } from 'react';
import { ClipboardList } from 'lucide-react';
import { buildMatterReviewSummary } from '../../lib/matterReviewPack.js';
import MatterPipelineStatusBadge from './MatterPipelineStatusBadge.jsx';

export default function MatterReviewSummaryPanel({ matter }) {
  const sections = useMemo(() => buildMatterReviewSummary(matter), [matter]);

  if (!matter) return null;

  return (
    <section className="rounded-2xl border border-slate-600 bg-slate-900 p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-indigo-300">
            <ClipboardList className="h-5 w-5 shrink-0" aria-hidden />
            <h2 className="text-base font-bold text-slate-100">Review summary</h2>
          </div>
          <p className="mt-1 text-sm text-slate-400">
            Read-only overview for solicitor review — drawn from saved client and matter data.
          </p>
        </div>
        <MatterPipelineStatusBadge matter={matter} />
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <article
            key={section.id}
            className="min-w-0 rounded-xl border border-slate-700 bg-slate-800/80 p-4"
          >
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400">{section.title}</h3>
            <ul className="mt-2 space-y-1 text-sm text-slate-200">
              {section.lines.map((line, i) => (
                <li key={`${section.id}-${i}`} className="break-words">
                  {line}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </section>
  );
}
