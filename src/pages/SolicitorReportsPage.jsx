import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, BarChart3, BriefcaseBusiness, CheckCircle2, Loader2, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { listMatters, listStaffProfiles, MATTER_STATUS } from '../lib/matters.js';
import { getMatterOutstandingCategories } from '../lib/matterOutstanding.js';
import { listCalendarConnections } from '../lib/staffCalendar.js';

const RANGE_OPTIONS = [
  { value: '30', label: '30 days' },
  { value: '7', label: '7 days' },
  { value: '90', label: '90 days' },
  { value: 'all', label: 'All time' },
];

const STATUS_LABELS = {
  [MATTER_STATUS.SUBMITTED]: 'Submitted',
  [MATTER_STATUS.VERIFICATION_PENDING]: 'ID needed',
  [MATTER_STATUS.IN_REVIEW]: 'In progress',
  [MATTER_STATUS.COMPLETED]: 'Completed',
};

function inRange(matter, range) {
  if (range === 'all') return true;
  const days = Number(range);
  const anchor = matter.submitted_at || matter.created_at || matter.last_activity_at;
  if (!anchor) return false;
  return new Date(anchor).getTime() >= Date.now() - days * 24 * 60 * 60 * 1000;
}

function percent(value, total) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

function staffName(profile) {
  return profile?.display_name || profile?.email || 'Unassigned';
}

function formatAge(value) {
  if (!value) return 'Not submitted';
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / (24 * 60 * 60 * 1000)));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}

export default function SolicitorReportsPage() {
  const { user, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30');
  const [matters, setMatters] = useState([]);
  const [staff, setStaff] = useState([]);
  const [connections, setConnections] = useState([]);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    Promise.all([
      listMatters({ search: '', status: 'all', assignedOnly: false, userId: user?.id, sortBy: 'last_activity_at' }, 'reports_matters'),
      listStaffProfiles(),
      listCalendarConnections(),
    ]).then(([mattersResult, staffResult, connectionResult]) => {
      if (!active) return;
      if (mattersResult.error) toast.error('Could not load report matters', { description: mattersResult.error });
      if (staffResult.error) toast.error('Could not load staff list', { description: staffResult.error });
      if (connectionResult.error) toast.error('Could not load calendar links', { description: connectionResult.error });
      setMatters(mattersResult.data || []);
      setStaff(staffResult.data || []);
      setConnections(connectionResult.data || []);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  const filtered = useMemo(() => matters.filter((m) => inRange(m, range)), [matters, range]);

  const staffById = useMemo(() => new Map(staff.map((s) => [s.id, s])), [staff]);
  const connectedIds = useMemo(() => new Set(connections.map((c) => c.profile_id)), [connections]);

  const metrics = useMemo(() => {
    const urgent = filtered.filter((m) => (getMatterOutstandingCategories(m) || []).length > 0);
    const completed = filtered.filter((m) => m.status === MATTER_STATUS.COMPLETED);
    const unassigned = filtered.filter((m) => !m.assigned_solicitor_id);
    const active = filtered.filter((m) => m.status !== MATTER_STATUS.COMPLETED);
    return {
      total: filtered.length,
      urgent: urgent.length,
      completed: completed.length,
      unassigned: unassigned.length,
      active: active.length,
      completionRate: percent(completed.length, filtered.length),
    };
  }, [filtered]);

  const statusRows = useMemo(() => {
    return Object.values(MATTER_STATUS).map((status) => {
      const count = filtered.filter((m) => m.status === status).length;
      return { status, label: STATUS_LABELS[status] || status, count, pct: percent(count, filtered.length) };
    });
  }, [filtered]);

  const staffRows = useMemo(() => {
    const rows = new Map(staff.map((s) => [s.id, {
      id: s.id,
      name: staffName(s),
      email: s.email,
      role: s.role,
      total: 0,
      urgent: 0,
      completed: 0,
      active: 0,
      calendar: connectedIds.has(s.id),
    }]));
    rows.set('unassigned', {
      id: 'unassigned',
      name: 'Unassigned',
      email: '',
      role: '',
      total: 0,
      urgent: 0,
      completed: 0,
      active: 0,
      calendar: false,
    });

    filtered.forEach((matter) => {
      const key = matter.assigned_solicitor_id || 'unassigned';
      const row = rows.get(key) || rows.get('unassigned');
      row.total += 1;
      if ((getMatterOutstandingCategories(matter) || []).length > 0) row.urgent += 1;
      if (matter.status === MATTER_STATUS.COMPLETED) row.completed += 1;
      else row.active += 1;
    });

    return Array.from(rows.values()).filter((r) => r.total > 0 || r.id !== 'unassigned').sort((a, b) => b.total - a.total);
  }, [connectedIds, filtered, staff]);

  const oldestUrgent = useMemo(() => {
    return filtered
      .filter((m) => (getMatterOutstandingCategories(m) || []).length > 0)
      .sort((a, b) => new Date(a.submitted_at || a.created_at || 0) - new Date(b.submitted_at || b.created_at || 0))
      .slice(0, 5);
  }, [filtered]);

  const panelClass = isDark
    ? 'border-slate-700 bg-slate-900/80 ring-1 ring-white/5'
    : 'border-slate-200 bg-white shadow-sm';
  const softClass = isDark ? 'border-slate-700 bg-slate-950/35' : 'border-slate-200 bg-slate-50/80';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="min-w-0 space-y-6">
      <Link to="/solicitor" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </Link>

      <section className={`rounded-2xl border ${panelClass}`}>
        <div className="flex flex-col gap-5 p-5 sm:p-6 lg:flex-row lg:items-end lg:justify-between lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              <BarChart3 className="h-3.5 w-3.5" aria-hidden />
              Firm reports
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Matter performance</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${mutedClass}`}>
              Live reporting from Will Tool matters, staff assignments, urgent follow-up and completion status.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setRange(option.value)}
                className={`min-h-[40px] rounded-xl px-3 text-sm font-semibold transition ${
                  range === option.value
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <div className={`flex items-center gap-2 rounded-2xl border p-5 text-sm ${panelClass}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading reports…
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {[
              { label: 'Matters', value: metrics.total, icon: BriefcaseBusiness, color: 'text-slate-900 dark:text-slate-100' },
              { label: 'Active', value: metrics.active, icon: TrendingUp, color: 'text-indigo-700 dark:text-indigo-300' },
              { label: 'Urgent', value: metrics.urgent, icon: BarChart3, color: 'text-rose-700 dark:text-rose-300' },
              { label: 'Unassigned', value: metrics.unassigned, icon: Users, color: 'text-amber-700 dark:text-amber-300' },
              { label: 'Completed', value: `${metrics.completionRate}%`, icon: CheckCircle2, color: 'text-emerald-700 dark:text-emerald-300' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className={`rounded-2xl border p-4 ${panelClass}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>{item.label}</p>
                    <Icon className="h-4 w-4 text-slate-400" aria-hidden />
                  </div>
                  <p className={`mt-3 text-3xl font-bold ${item.color}`}>{item.value}</p>
                </div>
              );
            })}
          </section>

          <section className="grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <div className={`rounded-2xl border ${panelClass}`}>
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Status mix</h2>
              </div>
              <div className="space-y-4 p-5">
                {statusRows.map((row) => (
                  <div key={row.status}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{row.label}</span>
                      <span className={mutedClass}>{row.count}</span>
                    </div>
                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-indigo-600"
                        style={{ width: `${Math.max(row.pct, row.count ? 4 : 0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className={`rounded-2xl border ${panelClass}`}>
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Workload by staff member</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <tr>
                      <th className="px-5 py-3 font-semibold">Staff</th>
                      <th className="px-5 py-3 font-semibold">Total</th>
                      <th className="px-5 py-3 font-semibold">Active</th>
                      <th className="px-5 py-3 font-semibold">Urgent</th>
                      <th className="px-5 py-3 font-semibold">Complete</th>
                      <th className="px-5 py-3 font-semibold">Calendar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {staffRows.map((row) => (
                      <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-white/[0.04]">
                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{row.name}</p>
                          <p className={`mt-0.5 text-xs ${mutedClass}`}>{row.email || row.role || 'Needs assignment'}</p>
                        </td>
                        <td className="px-5 py-4 font-semibold">{row.total}</td>
                        <td className="px-5 py-4">{row.active}</td>
                        <td className="px-5 py-4 text-rose-700 dark:text-rose-300">{row.urgent}</td>
                        <td className="px-5 py-4 text-emerald-700 dark:text-emerald-300">{row.completed}</td>
                        <td className="px-5 py-4">
                          {row.calendar ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">Linked</span>
                          ) : (
                            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">Pending</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section className={`rounded-2xl border ${panelClass}`}>
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Oldest urgent matters</h2>
            </div>
            <div className="grid gap-3 p-5 lg:grid-cols-5">
              {oldestUrgent.map((matter) => {
                const assigned = staffById.get(matter.assigned_solicitor_id);
                return (
                  <Link
                    key={matter.id}
                    to={`/solicitor/matters/${matter.id}`}
                    className={`rounded-2xl border p-4 transition hover:border-rose-300 ${softClass}`}
                  >
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{matter.client_reference}</p>
                    <p className={`mt-1 truncate text-xs ${mutedClass}`}>{matter.client_name || 'Unknown client'}</p>
                    <p className="mt-3 text-xs font-semibold text-rose-700 dark:text-rose-300">{formatAge(matter.submitted_at || matter.created_at)}</p>
                    <p className={`mt-1 truncate text-xs ${mutedClass}`}>{staffName(assigned)}</p>
                  </Link>
                );
              })}
              {!oldestUrgent.length ? (
                <div className={`rounded-2xl border p-8 text-center text-sm lg:col-span-5 ${softClass} ${mutedClass}`}>No urgent matters in this range.</div>
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
