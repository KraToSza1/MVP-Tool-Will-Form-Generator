import React from 'react';
import { deriveMatterPipelineStatus } from '../../lib/matterReviewPack.js';

const TONE_CLASSES = {
  blue: 'border-blue-500/40 bg-blue-950/40 text-blue-100',
  indigo: 'border-indigo-500/40 bg-indigo-950/40 text-indigo-100',
  amber: 'border-amber-500/40 bg-amber-950/40 text-amber-100',
  rose: 'border-rose-500/40 bg-rose-950/40 text-rose-100',
  emerald: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-100',
  slate: 'border-slate-500/40 bg-slate-800 text-slate-200',
};

export default function MatterPipelineStatusBadge({ matter, compact = false }) {
  const pipeline = deriveMatterPipelineStatus(matter);
  const tone = TONE_CLASSES[pipeline.tone] || TONE_CLASSES.slate;
  const size = compact
    ? 'rounded-md px-2 py-0.5 text-[10px] font-semibold leading-none'
    : 'rounded-full px-3 py-1 text-xs font-semibold';

  return (
    <span
      title={`Workflow: ${pipeline.label}`}
      className={`inline-flex max-w-full items-center border ${size} ${tone}`}
    >
      <span className="truncate">{pipeline.label}</span>
    </span>
  );
}
