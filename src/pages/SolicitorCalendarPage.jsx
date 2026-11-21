import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { listMatters } from '../lib/matters.js';
import { getMatterOutstandingCategories } from '../lib/matterOutstanding.js';
import BackPill from '../components/solicitor/BackPill.jsx';
import WeekSchedule from '../components/solicitor/WeekSchedule.jsx';
import { nextWorkingDays } from '../lib/weekScheduleLayout.js';
import {
  getCurrentProviderToken,
  getMyAvailabilityRules,
  getMyMicrosoftSchedule,
  listCalendarConnections,
  startMicrosoftCalendarConnect,
  syncCurrentCalendarConnection,
} from '../lib/staffCalendar.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const CALENDAR_START_HOUR = 8;
const CALENDAR_END_HOUR = 18;

function startOfLocalDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

function localGraphDateTime(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function getItemDate(value) {
  const raw = value?.dateTime || value;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

export default function SolicitorCalendarPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading, profile } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connection, setConnection] = useState(null);
  const [rules, setRules] = useState(null);
  const [scheduleItems, setScheduleItems] = useState([]);
  const [graphError, setGraphError] = useState('');
  const [matters, setMatters] = useState([]);
  const [hasProviderToken, setHasProviderToken] = useState(false);

  const weekDays = useMemo(() => {
    const today = startOfLocalDay(new Date());
    return Array.from({ length: 10 }, (_, i) => addDays(today, i));
  }, []);

  const loadCalendar = async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setRefreshing(silent);
    setGraphError('');
    const [rulesResult, mattersResult, connectionsResult] = await Promise.all([
      getMyAvailabilityRules(),
      listMatters({ search: '', status: 'all', assignedOnly: true, userId: user?.id, sortBy: 'last_activity_at' }, 'calendar_my_matters'),
      listCalendarConnections(),
    ]);

    setRules(rulesResult.data);
    setMatters(mattersResult.data || []);

    const existingConnection = (connectionsResult.data || []).find((c) => c.profile_id === user?.id) || null;
    let nextConnection = existingConnection;

    const providerToken = await getCurrentProviderToken();
    setHasProviderToken(Boolean(providerToken));
    if (providerToken) {
      const synced = await syncCurrentCalendarConnection();
      if (synced.data) nextConnection = synced.data;
    }
    setConnection(nextConnection);

    if (providerToken) {
      const start = new Date(weekDays[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(weekDays[weekDays.length - 1]);
      end.setHours(CALENDAR_END_HOUR, 0, 0, 0);
      const schedule = await getMyMicrosoftSchedule({
        start: localGraphDateTime(start),
        end: localGraphDateTime(end),
        timeZone: rulesResult.data?.timezone || 'Africa/Johannesburg',
        interval: 30,
        email: nextConnection?.calendar_email || profile?.email || user?.email,
      });
      if (schedule.error) {
        setGraphError(schedule.error);
        setScheduleItems([]);
      } else {
        const items = schedule.data?.value?.[0]?.scheduleItems || [];
        setScheduleItems(items);
      }
    } else {
      setScheduleItems([]);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      await loadCalendar();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const scheduleWithDates = useMemo(() => scheduleItems
    .map((item) => ({ ...item, startDate: getItemDate(item.start), endDate: getItemDate(item.end) }))
    .filter((item) => item.startDate && item.endDate), [scheduleItems]);
  const scheduleDays = useMemo(() => nextWorkingDays(new Date(), 5, rules?.working_days), [rules?.working_days]);

  const urgentMine = useMemo(() => matters.filter((m) => (getMatterOutstandingCategories(m) || []).length > 0), [matters]);
  const connected = Boolean(hasProviderToken && connection?.calendar_email) && !graphError;

  const handleConnect = async () => {
    setConnecting(true);
    const result = await startMicrosoftCalendarConnect({ redirectPath: '/solicitor/calendar' });
    setConnecting(false);
    if (result?.error) toast.error('Could not start Microsoft calendar connection', { description: result.error });
  };

  const panelClass = isDark
    ? 'border-slate-700 bg-slate-900/80 ring-1 ring-white/5'
    : 'border-slate-200 bg-white shadow-sm';
  const softClass = isDark ? 'border-slate-700 bg-slate-950/35' : 'border-slate-200 bg-slate-50/80';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';

  return (
    <div className="min-w-0 space-y-6">

      <section className={`rounded-2xl border ${panelClass}`}>
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_22rem] xl:p-7">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <BackPill to="/solicitor" label="Back to dashboard" />
              <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Microsoft 365 calendar
            </div>
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Solicitor calendar</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${mutedClass}`}>
              {loading
                ? 'Checking your Microsoft calendar connection…'
                : connected
                  ? `${connection.calendar_email} is linked for availability checks.`
                  : 'Connect Microsoft Calendar to show busy time against your Will Tool workload.'}
            </p>
          </div>
          <div className={`rounded-2xl border p-4 ${softClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Connection</p>
                <p className={`mt-1 text-xs ${mutedClass}`}>{connection?.calendar_email || profile?.email || 'No calendar linked'}</p>
              </div>
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-hidden />
              ) : connected ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" aria-hidden /> Connected
                </span>
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden />
              )}
            </div>
            <div className={`mt-4 grid gap-2 ${connected || loading ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {connected || loading ? null : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarDays className="h-4 w-4" aria-hidden />}
                Connect
              </button>
              )}
              <button
                type="button"
                onClick={() => loadCalendar({ silent: true })}
                disabled={refreshing || loading}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-100 dark:hover:bg-white/[0.04]"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} aria-hidden />
                Refresh
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className={`rounded-2xl border p-4 ${panelClass}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>My active matters</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{matters.length}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${panelClass}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Urgent for me</p>
          <p className="mt-2 text-3xl font-bold text-rose-700 dark:text-rose-300">{urgentMine.length}</p>
        </div>
        <div className={`rounded-2xl border p-4 ${panelClass}`}>
          <p className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Appointment window</p>
          <p className="mt-2 text-3xl font-bold text-slate-900 dark:text-slate-100">{rules?.slot_minutes || 60}m</p>
        </div>
      </section>

      {loading ? (
        <div className={`flex items-center gap-2 rounded-2xl border p-5 text-sm ${panelClass}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading calendar…
        </div>
      ) : (
        <WeekSchedule
          days={scheduleDays}
          items={scheduleWithDates}
          rules={rules}
          graphError={graphError}
          onEditAvailability={() => navigate('/solicitor/availability')}
        />
      )}

      <section className={`rounded-2xl border p-5 ${panelClass}`}>
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-indigo-500" aria-hidden />
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Matter follow-up queue</h2>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {urgentMine.slice(0, 6).map((matter) => (
            <Link
              key={matter.id}
              to={`/solicitor/matters/${matter.id}`}
              className="rounded-2xl border border-rose-200 bg-rose-50 p-4 transition hover:border-rose-300 dark:border-rose-500/30 dark:bg-rose-500/10"
            >
              <p className="truncate text-sm font-semibold text-rose-950 dark:text-rose-100">{matter.client_reference}</p>
              <p className="mt-1 truncate text-xs text-rose-800 dark:text-rose-200">{matter.client_name || 'Unknown client'}</p>
            </Link>
          ))}
          {!urgentMine.length ? <p className={`text-sm ${mutedClass}`}>No urgent assigned matters.</p> : null}
        </div>
      </section>
    </div>
  );
}
