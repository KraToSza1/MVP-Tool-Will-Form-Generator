import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Calendar, CheckCircle2, Loader2, Mail, UserCheck, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { listMatters, listStaffProfiles, MATTER_STATUS } from '../lib/matters.js';
import { getMatterOutstandingCategories, isMatterUrgent } from '../lib/matterOutstanding.js';
import { getCurrentProviderToken, listCalendarConnections, startMicrosoftCalendarConnect } from '../lib/staffCalendar.js';

function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ST';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function formatDate(value) {
  if (!value) return 'Not connected';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function SolicitorStaffPage() {
  const { user, loading: authLoading, profile } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [staff, setStaff] = useState([]);
  const [matters, setMatters] = useState([]);
  const [connections, setConnections] = useState([]);
  const [selectedStaffId, setSelectedStaffId] = useState('all');
  const [hasProviderToken, setHasProviderToken] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    setLoading(true);
    Promise.all([
      listStaffProfiles(),
      listMatters({ search: '', status: 'all', assignedOnly: false, userId: user?.id, sortBy: 'last_activity_at' }, 'staff_workload'),
      listCalendarConnections(),
      getCurrentProviderToken(),
    ]).then(([staffResult, mattersResult, calendarResult, providerToken]) => {
      if (!active) return;
      if (staffResult.error) toast.error('Could not load staff', { description: staffResult.error });
      if (mattersResult.error) toast.error('Could not load matters', { description: mattersResult.error });
      if (calendarResult.error) toast.error('Could not load calendar links', { description: calendarResult.error });
      setStaff(staffResult.data || []);
      setMatters(mattersResult.data || []);
      setConnections(calendarResult.data || []);
      setHasProviderToken(Boolean(providerToken));
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [authLoading, user?.id]);

  const connectionByProfile = useMemo(() => {
    const map = new Map();
    connections.forEach((c) => map.set(c.profile_id, c));
    return map;
  }, [connections]);
  const myConnection = connectionByProfile.get(user?.id);
  const connectButtonLabel = hasProviderToken
    ? (myConnection ? 'Reconnect my Microsoft calendar' : 'Connect my Microsoft calendar')
    : (myConnection ? 'Connect this browser session' : 'Connect my Microsoft calendar');

  const workload = useMemo(() => {
    const map = new Map(staff.map((s) => [s.id, {
      profile: s,
      assigned: 0,
      urgent: 0,
      inReview: 0,
      completed: 0,
      latestActivity: null,
    }]));

    matters.forEach((matter) => {
      const id = matter.assigned_solicitor_id;
      if (!id || !map.has(id)) return;
      const row = map.get(id);
      row.assigned += 1;
      if (isMatterUrgent(matter)) row.urgent += 1;
      if (matter.status === MATTER_STATUS.IN_REVIEW) row.inReview += 1;
      if (matter.status === MATTER_STATUS.COMPLETED) row.completed += 1;
      if (!row.latestActivity || new Date(matter.last_activity_at) > new Date(row.latestActivity)) {
        row.latestActivity = matter.last_activity_at;
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      if (a.profile.id === user?.id) return -1;
      if (b.profile.id === user?.id) return 1;
      return (b.assigned + b.urgent) - (a.assigned + a.urgent);
    });
  }, [matters, staff, user?.id]);

  const unassigned = useMemo(() => matters.filter((m) => !m.assigned_solicitor_id), [matters]);
  const selectedMatters = useMemo(() => {
    if (selectedStaffId === 'all') return matters;
    if (selectedStaffId === 'unassigned') return unassigned;
    return matters.filter((m) => m.assigned_solicitor_id === selectedStaffId);
  }, [matters, selectedStaffId, unassigned]);

  const handleConnectCalendar = async () => {
    setConnecting(true);
    const result = await startMicrosoftCalendarConnect({ redirectPath: '/solicitor/staff' });
    setConnecting(false);
    if (result?.error) toast.error('Could not start Microsoft calendar connection', { description: result.error });
  };

  const pageClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const panelClass = isDark
    ? 'border-slate-700 bg-slate-900/78 ring-1 ring-white/5'
    : 'border-slate-200 bg-white shadow-sm';
  const softPanelClass = isDark
    ? 'border-slate-700 bg-slate-900/55'
    : 'border-slate-200 bg-slate-50/80';

  return (
    <div className={`min-w-0 space-y-6 ${pageClass}`}>
      <Link to="/solicitor" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </Link>

      <section className={`overflow-hidden rounded-2xl border ${panelClass}`}>
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              <Users className="h-3.5 w-3.5" aria-hidden />
              Staff command centre
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">People, work and calendar links</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${mutedClass}`}>
              Staff are linked by their secure Supabase profile. Calendar status, assigned matters and urgent workload stay tied to that staff ID.
            </p>
          </div>
          <div className={`rounded-2xl border p-4 ${softPanelClass}`}>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Signed in as</p>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white dark:bg-indigo-600">
                {initials(profile?.display_name || profile?.email)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{profile?.display_name || 'Staff member'}</p>
                <p className={`truncate text-xs ${mutedClass}`}>{profile?.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleConnectCalendar}
              disabled={connecting}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Calendar className="h-4 w-4" aria-hidden />}
              {connectButtonLabel}
            </button>
            {!hasProviderToken && myConnection ? (
              <p className={`mt-2 text-xs ${mutedClass}`}>
                Calendar is linked on your profile. Reconnect in this browser session to run live Microsoft checks.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {loading ? (
        <div className={`flex items-center gap-2 rounded-2xl border p-5 text-sm ${panelClass}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading staff workload…
        </div>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`rounded-2xl border p-4 ${panelClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Staff profiles</p>
              <p className="mt-2 text-3xl font-bold">{staff.length}</p>
            </div>
            <div className={`rounded-2xl border p-4 ${panelClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Assigned matters</p>
              <p className="mt-2 text-3xl font-bold">{matters.length - unassigned.length}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedStaffId('unassigned')}
              className={`rounded-2xl border p-4 text-left transition hover:border-amber-300 ${panelClass}`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Unassigned</p>
              <p className="mt-2 text-3xl font-bold">{unassigned.length}</p>
            </button>
            <div className={`rounded-2xl border p-4 ${panelClass}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Calendars linked</p>
              <p className="mt-2 text-3xl font-bold">{connections.length}</p>
            </div>
          </section>

          <section className="grid gap-4 xl:grid-cols-[1fr_0.9fr]">
            <div className={`rounded-2xl border ${panelClass}`}>
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <h2 className="text-base font-semibold">Staff workload</h2>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-slate-700">
                {workload.map((row) => {
                  const connection = connectionByProfile.get(row.profile.id);
                  const isSelf = row.profile.id === user?.id;
                  return (
                    <button
                      type="button"
                      key={row.profile.id}
                      onClick={() => setSelectedStaffId(row.profile.id)}
                      className={`grid w-full gap-4 px-5 py-4 text-left transition hover:bg-slate-50 dark:hover:bg-white/[0.04] md:grid-cols-[minmax(0,1.2fr)_auto] ${
                        selectedStaffId === row.profile.id ? 'bg-indigo-50/80 dark:bg-indigo-500/10' : ''
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white dark:bg-slate-700">
                          {initials(row.profile.display_name || row.profile.email)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold">{row.profile.display_name || row.profile.email}</p>
                            {isSelf ? <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-200">You</span> : null}
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{row.profile.role}</span>
                          </div>
                          <p className={`mt-1 flex items-center gap-1.5 truncate text-xs ${mutedClass}`}>
                            <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                            {row.profile.email}
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4 md:min-w-[26rem]">
                        <span className="rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950/40">
                          <strong className="block text-base">{row.assigned}</strong> assigned
                        </span>
                        <span className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                          <strong className="block text-base">{row.urgent}</strong> urgent
                        </span>
                        <span className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-indigo-900 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-100">
                          <strong className="block text-base">{row.inReview}</strong> active
                        </span>
                        <span className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                          <strong className="block text-base">{row.completed}</strong> done
                        </span>
                      </div>
                      <div className="md:col-span-2 flex flex-wrap items-center gap-2">
                        {connection ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                            Calendar linked {formatDate(connection.connected_at)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                            <Calendar className="h-3.5 w-3.5" aria-hidden />
                            Calendar pending
                          </span>
                        )}
                        <span className={`text-xs ${mutedClass}`}>Latest activity {formatDate(row.latestActivity)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <aside className={`rounded-2xl border ${panelClass}`}>
              <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                <h2 className="text-base font-semibold">Selected workload</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffId('all')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedStaffId === 'all' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                  >
                    Firm
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedStaffId('unassigned')}
                    className={`rounded-full px-3 py-1.5 text-xs font-semibold ${selectedStaffId === 'unassigned' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200'}`}
                  >
                    Unassigned
                  </button>
                </div>
              </div>
              <div className="max-h-[36rem] divide-y divide-slate-200 overflow-auto dark:divide-slate-700">
                {selectedMatters.slice(0, 12).map((matter) => {
                  const lineCount = (getMatterOutstandingCategories(matter) || []).length;
                  return (
                    <Link
                      key={matter.id}
                      to={`/solicitor/matters/${matter.id}`}
                      className="block px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-white/[0.04]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{matter.client_reference}</p>
                          <p className={`mt-1 truncate text-xs ${mutedClass}`}>{matter.client_name || 'Unknown client'}</p>
                        </div>
                        {lineCount > 0 ? (
                          <span
                            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-2 py-1 text-[11px] font-bold text-rose-800 dark:bg-rose-500/15 dark:text-rose-100"
                            title={`${lineCount} outstanding checklist line${lineCount === 1 ? '' : 's'} on this matter`}
                          >
                            <AlertTriangle className="h-3 w-3" aria-hidden />
                            {lineCount} {lineCount === 1 ? 'item' : 'items'}
                          </span>
                        ) : (
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-[11px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-100">
                            <UserCheck className="h-3 w-3" aria-hidden />
                            Clear
                          </span>
                        )}
                      </div>
                    </Link>
                  );
                })}
                {selectedMatters.length === 0 ? (
                  <div className={`px-5 py-10 text-center text-sm ${mutedClass}`}>No matters in this selection.</div>
                ) : null}
              </div>
            </aside>
          </section>
        </>
      )}
    </div>
  );
}
