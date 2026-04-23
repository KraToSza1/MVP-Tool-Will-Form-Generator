import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { listMatters } from '../lib/matters.js';
import { getMatterOutstandingCategories, OUTSTANDING_CATEGORY } from '../lib/matterOutstanding.js';
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
  const [matters, setMatters] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const urgent = useMemo(() => {
    return matters.filter((m) => (getMatterOutstandingCategories(m) || []).length > 0);
  }, [matters]);

  return (
    <div className="min-w-0 w-full max-w-full space-y-6">
      <Link
        to="/solicitor"
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-indigo-400 hover:text-indigo-300"
      >
        <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
        Back to dashboard
      </Link>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">Urgent &amp; outstanding</h1>
          <p className="mt-1 text-sm text-slate-400">
            Matters that still need ID verification, BPR or property trust follow-up, or Testamentary Capacity.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-500/50 bg-rose-950/40 px-3 py-1.5 text-xs font-semibold text-rose-200">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
          {urgent.length} matter{urgent.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </div>
      ) : urgent.length === 0 ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/20 px-4 py-8 text-center sm:px-6">
          <p className="text-sm font-medium text-emerald-100">Nothing urgent right now</p>
          <p className="mt-2 text-sm text-slate-400">All visible matters are clear of outstanding solicitor actions, or you have no matters yet.</p>
        </div>
      ) : (
        <ul className="space-y-3">
          {urgent.map((matter) => {
            const categories = getMatterOutstandingCategories(matter);
            return (
              <li
                key={matter.id}
                className="rounded-2xl border border-slate-600 bg-slate-900/60 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Reference</p>
                  <Link to={`/solicitor/matters/${matter.id}`} className="text-base font-semibold text-indigo-400 hover:text-indigo-300 break-all">
                    {matter.client_reference}
                  </Link>
                  <p className="mt-1 text-sm text-slate-200">{matter.client_name || matter.client_snapshot?.fullName || 'Unknown client'}</p>
                  <p className="mt-0.5 text-xs text-slate-500">Last activity {formatDate(matter.last_activity_at)}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {categories.map((c) => (
                      <span
                        key={c}
                        className="inline-flex rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-100"
                      >
                        {CATEGORY_SHORT[c] || c}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="mt-4 flex flex-shrink-0 flex-col items-stretch gap-2 sm:mt-0 sm:items-end">
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
