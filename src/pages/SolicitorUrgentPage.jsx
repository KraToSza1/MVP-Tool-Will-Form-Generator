import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { listMatters } from '../lib/matters.js';
import {
  getMatterOutstandingCategories,
  isMatterUrgent,
  OUTSTANDING_CATEGORY,
  summarizeUrgentMatters,
} from '../lib/matterOutstanding.js';
import MatterStatusBadge from '../components/solicitor/MatterStatusBadge.jsx';

const CATEGORY_SHORT = {
  [OUTSTANDING_CATEGORY.ID_VERIFICATION]: 'ID verification',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED]: 'BPR (required)',
  [OUTSTANDING_CATEGORY.BPR_TRUST_REVIEW]: 'BPR (review)',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED]: 'Property trust (required)',
  [OUTSTANDING_CATEGORY.PROPERTY_TRUST_REVIEW]: 'Property trust (review)',
  [OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY]: 'Testamentary Capacity',
};

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

export default function SolicitorUrgentPage() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scope, setScope] = useState('firm');

  const backClass = isDark
    ? 'text-indigo-400 hover:text-indigo-300'
    : 'text-indigo-600 hover:text-indigo-800';
  const headingClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const subClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const countBadgeClass = isDark
    ? 'border-rose-500/50 bg-rose-950/40 text-rose-200'
    : 'border-rose-200 bg-rose-50 text-rose-900';
  const countIconClass = isDark ? 'text-rose-200' : 'text-rose-700';
  const emptyClass = isDark
    ? 'border-emerald-500/30 bg-emerald-950/20'
    : 'border-emerald-200 bg-emerald-50';
  const emptyTitleClass = isDark ? 'text-emerald-100' : 'text-emerald-900';
  const cardClass = isDark
    ? 'rounded-2xl border border-slate-600 bg-slate-900/80 p-4 ring-1 ring-white/5'
    : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  const refLabelClass = isDark ? 'text-slate-500' : 'text-slate-500';
  const nameClass = isDark ? 'text-slate-200' : 'text-slate-800';
  const matterLinkClass = isDark
    ? 'text-indigo-400 hover:text-indigo-300 break-all'
    : 'text-indigo-600 hover:text-indigo-800 break-all';
  const catClass = isDark
    ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
    : 'border-amber-200 bg-amber-50 text-amber-900';

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    listMatters(
      { search: '', status: 'all', assignedOnly: false, userId: user?.id, sortBy: 'last_activity_at' },
      'urgent_list',
    ).then((r) => {
      if (!active) return;
      if (r.error) {
        toast.error('Could not load matters', { description: r.error });
        setMatters([]);
      } else {
        setMatters(r.data || []);
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  const urgent = useMemo(() => matters.filter(isMatterUrgent), [matters]);

  const urgentSummary = useMemo(() => summarizeUrgentMatters(matters), [matters]);

  const visibleUrgent = useMemo(() => {
    if (scope === 'mine') return urgent.filter((m) => m.assigned_solicitor_id === user?.id);
    if (scope === 'unassigned') return urgent.filter((m) => !m.assigned_solicitor_id);
    return urgent;
  }, [scope, urgent, user?.id]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <Link to="/solicitor" className={`inline-flex min-h-[44px] items-center gap-2 text-sm font-medium ${backClass}`}>
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className={`text-xl font-bold tracking-tight sm:text-2xl ${headingClass}`}>Urgent &amp; outstanding</h1>
          <p className={`mt-1 text-sm ${subClass}`}>
            Each client matter appears once below, even when several checklist lines are still open (ID, BPR,
            property trust, Testamentary Capacity).
          </p>
          {urgentSummary.matterCount > 0 ? (
            <p className={`mt-2 text-xs ${mutedClass}`}>
              Firm-wide: {urgentSummary.matterCount} matter{urgentSummary.matterCount === 1 ? '' : 's'} ·{' '}
              {urgentSummary.totalOutstandingItems} outstanding checklist line
              {urgentSummary.totalOutstandingItems === 1 ? '' : 's'}
              {urgentSummary.idOnlyMatterCount > 0
                ? ` · ${urgentSummary.idOnlyMatterCount} awaiting ID only`
                : ''}
              {urgentSummary.solicitorWorkflowMatterCount > 0
                ? ` · ${urgentSummary.solicitorWorkflowMatterCount} need solicitor workflow`
                : ''}
            </p>
          ) : null}
        </div>
        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${countBadgeClass}`}
          title={
            visibleUrgent.length !== urgentSummary.matterCount
              ? `Filtered view: ${visibleUrgent.length} matter(s)`
              : `${urgentSummary.totalOutstandingItems} checklist lines across ${visibleUrgent.length} matter(s)`
          }
        >
          <AlertTriangle className={`h-3.5 w-3.5 ${countIconClass}`} aria-hidden />
          {visibleUrgent.length} matter{visibleUrgent.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className={`flex flex-wrap gap-2 rounded-2xl border p-2 ${isDark ? 'border-slate-700 bg-slate-900/70' : 'border-slate-200 bg-white shadow-sm'}`}>
        {[
          { value: 'firm', label: 'Firm urgent', icon: Users },
          { value: 'mine', label: 'My urgent', icon: UserCheck },
          { value: 'unassigned', label: 'Unassigned', icon: AlertTriangle },
        ].map((item) => {
          const Icon = item.icon;
          const active = scope === item.value;
          return (
            <button
              key={item.value}
              type="button"
              onClick={() => setScope(item.value)}
              className={`inline-flex min-h-[40px] items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                active
                  ? 'bg-indigo-600 text-white'
                  : isDark
                    ? 'text-slate-200 hover:bg-white/[0.06]'
                    : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className={`flex items-center gap-2 text-sm ${mutedClass}`}>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : visibleUrgent.length === 0 ? (
        <div className={`rounded-2xl border px-4 py-8 text-center sm:px-6 ${emptyClass}`}>
          <p className={`text-sm font-medium ${emptyTitleClass}`}>Nothing urgent right now</p>
          <p className={`mt-2 text-sm ${subClass}`}>
            All visible matters are clear of outstanding solicitor actions, or you have no matters yet.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {visibleUrgent.map((matter) => {
            const categories = getMatterOutstandingCategories(matter);
            return (
              <li
                key={matter.id}
                className={`min-w-0 sm:flex sm:items-center sm:justify-between sm:gap-4 ${cardClass}`}
              >
                <div className="min-w-0">
                  <p className={`text-xs font-semibold uppercase tracking-wide ${refLabelClass}`}>Reference</p>
                  <Link to={`/solicitor/matters/${matter.id}`} className={`text-base font-semibold ${matterLinkClass}`}>
                    {matter.client_reference}
                  </Link>
                  <p className={`mt-1 text-sm ${nameClass}`}>
                    {matter.client_name || matter.client_snapshot?.fullName || 'Unknown client'}
                  </p>
                  <p className={`mt-0.5 text-xs ${mutedClass}`}>Last activity {formatDate(matter.last_activity_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${catClass}`}
                      >
                        {CATEGORY_SHORT[c] || c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex shrink-0 flex-col items-stretch gap-2 sm:mt-0 sm:items-end">
                  <MatterStatusBadge status={matter.status} />
                  <Link
                    to={`/solicitor/matters/${matter.id}`}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  >
                    Open matter
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
