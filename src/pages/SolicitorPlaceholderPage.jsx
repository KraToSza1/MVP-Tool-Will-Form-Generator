import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

/**
 * Mariyam / design-team routes (calendar, availability, reports) that are not wired yet.
 * Keeps navigation consistent with the Aristone portal mock.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string[]=} props.roadmapItems Optional bullets for product roadmap (e.g. work-email calendar).
 */
export default function SolicitorPlaceholderPage({ title, description, roadmapItems }) {
  const { isDark } = useTheme();
  const backClass = isDark
    ? 'text-indigo-400 hover:text-indigo-300'
    : 'text-indigo-600 hover:text-indigo-800';
  const cardClass = isDark
    ? 'rounded-2xl border border-slate-600 bg-slate-900 p-6 shadow-sm ring-1 ring-white/5 sm:p-8'
    : 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8';
  const iconClass = isDark
    ? 'border border-amber-500/40 bg-amber-500/10 text-amber-200'
    : 'border border-amber-200 bg-amber-50 text-amber-800';
  const titleClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const bodyClass = isDark ? 'text-slate-300' : 'text-slate-600';
  const footClass = isDark ? 'text-slate-500' : 'text-slate-500';
  const roadmapBoxClass = isDark
    ? 'border-slate-600/80 bg-slate-800/40'
    : 'border-slate-200 bg-slate-50';

  return (
    <div className="min-w-0 max-w-2xl">
      <Link to="/solicitor" className={`inline-flex min-h-[44px] items-center gap-2 text-sm font-medium ${backClass}`}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to dashboard
      </Link>
      <div className={`mt-6 min-w-0 ${cardClass}`}>
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}
        >
          <Construction className="h-6 w-6" aria-hidden />
        </div>
        <h1 className={`mt-4 text-xl font-bold tracking-tight sm:text-2xl ${titleClass}`}>{title}</h1>
        <p className={`mt-2 text-sm leading-relaxed ${bodyClass}`}>{description}</p>
        {Array.isArray(roadmapItems) && roadmapItems.length > 0 ? (
          <div
            className={`mt-5 min-w-0 rounded-xl border p-4 sm:p-5 ${roadmapBoxClass}`}
            aria-label="Planned product direction"
          >
            <p className={`text-sm font-semibold ${titleClass}`}>Planned capability</p>
            <ul className={`mt-2 list-disc space-y-1.5 pl-4 text-sm leading-relaxed ${bodyClass}`}>
              {roadmapItems.map((line) => (
                <li key={line} className="min-w-0 pl-0.5">
                  {line}
                </li>
              ))}
            </ul>
            <p className={`mt-3 text-xs leading-relaxed ${footClass}`}>
              Building this needs your IT-approved Microsoft 365 or Google Workspace app registration, user consent, and
              secure storage of calendar tokens. It is not wired up in this build.
            </p>
          </div>
        ) : null}
        <p className={`mt-4 text-xs ${footClass}`}>
          For now, use the main dashboard for matter list, ID verification, and Testamentary Capacity. Full scheduling
          and reporting will follow your firm&apos;s product rollout.
        </p>
      </div>
    </div>
  );
}
