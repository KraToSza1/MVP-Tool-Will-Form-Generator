import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, Clock, Loader2, RefreshCw, ShieldAlert, Video } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { listMatters } from '../lib/matters.js';
import { getMatterOutstandingCategories } from '../lib/matterOutstanding.js';
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

function formatDay(date) {
  return date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' });
}

function formatTime(date) {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getItemDate(value) {
  const raw = value?.dateTime || value;
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function itemTopPercent(date) {
  const minutes = date.getHours() * 60 + date.getMinutes();
  const min = CALENDAR_START_HOUR * 60;
  const max = CALENDAR_END_HOUR * 60;
  return Math.max(0, Math.min(100, ((minutes - min) / (max - min)) * 100));
}

function itemHeightPercent(start, end) {
  const diffMinutes = Math.max(20, (end.getTime() - start.getTime()) / 60000);
  const total = (CALENDAR_END_HOUR - CALENDAR_START_HOUR) * 60;
  return Math.max(7, Math.min(100, (diffMinutes / total) * 100));
}

export default function SolicitorCalendarPage() {
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
    return Array.from({ length: 5 }, (_, i) => addDays(today, i));
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
      start.setHours(CALENDAR_START_HOUR, 0, 0, 0);
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

  const itemsByDay = useMemo(() => {
    const map = new Map(weekDays.map((d) => [d.toDateString(), []]));
    scheduleItems.forEach((item) => {
      const start = getItemDate(item.start);
      const end = getItemDate(item.end);
      if (!start || !end) return;
      const key = startOfLocalDay(start).toDateString();
      if (!map.has(key)) return;
      map.get(key).push({ ...item, startDate: start, endDate: end });
    });
    return map;
  }, [scheduleItems, weekDays]);

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
      <Link to="/solicitor" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </Link>

      <section className={`rounded-2xl border ${panelClass}`}>
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_22rem] xl:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-800 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-200">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Microsoft 365 calendar
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Solicitor calendar</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${mutedClass}`}>
              {connected
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
              {connected ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden />
              )}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleConnect}
                disabled={connecting}
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarDays className="h-4 w-4" aria-hidden />}
                Connect
              </button>
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
        <section className={`overflow-hidden rounded-2xl border ${panelClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Five-day schedule</h2>
              <p className={`mt-1 text-xs ${mutedClass}`}>{rules?.timezone || 'Africa/Johannesburg'} · {CALENDAR_START_HOUR}:00 to {CALENDAR_END_HOUR}:00</p>
            </div>
            {graphError ? (
              <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
                Calendar permission needed
              </span>
            ) : null}
          </div>

          {graphError ? (
            <div className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-slate-700 dark:bg-amber-500/10 dark:text-amber-100">
              {graphError}
            </div>
          ) : null}

          <div className="grid min-h-[34rem] grid-cols-1 divide-y divide-slate-200 dark:divide-slate-700 lg:grid-cols-5 lg:divide-x lg:divide-y-0">
            {weekDays.map((day) => {
              const dayItems = itemsByDay.get(day.toDateString()) || [];
              return (
                <div key={day.toISOString()} className="relative min-h-[28rem] bg-slate-50/40 dark:bg-slate-950/20">
                  <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatDay(day)}</p>
                    <p className={`mt-0.5 text-xs ${mutedClass}`}>{dayItems.length ? `${dayItems.length} busy block${dayItems.length === 1 ? '' : 's'}` : 'Open'}</p>
                  </div>
                  <div className="relative h-[30rem] px-3 py-4">
                    {[8, 10, 12, 14, 16].map((hour) => (
                      <div
                        key={hour}
                        className="absolute left-3 right-3 border-t border-slate-200/80 text-[10px] text-slate-400 dark:border-slate-700"
                        style={{ top: `${((hour - CALENDAR_START_HOUR) / (CALENDAR_END_HOUR - CALENDAR_START_HOUR)) * 100}%` }}
                      >
                        <span className="relative -top-2 bg-slate-50 pr-1 dark:bg-slate-950">{String(hour).padStart(2, '0')}:00</span>
                      </div>
                    ))}
                    {dayItems.map((item, idx) => {
                      const top = itemTopPercent(item.startDate);
                      const height = itemHeightPercent(item.startDate, item.endDate);
                      return (
                        <div
                          key={`${item.subject || item.status}-${idx}`}
                          className="absolute left-5 right-5 overflow-hidden rounded-xl border border-indigo-200 bg-indigo-600 px-3 py-2 text-white shadow-sm dark:border-indigo-400/40"
                          style={{ top: `${top}%`, height: `${height}%` }}
                          title={`${formatTime(item.startDate)} - ${formatTime(item.endDate)}`}
                        >
                          <p className="truncate text-xs font-semibold">{item.subject || item.status || 'Busy'}</p>
                          <p className="mt-0.5 truncate text-[11px] text-indigo-100">{formatTime(item.startDate)} - {formatTime(item.endDate)}</p>
                        </div>
                      );
                    })}
                    {!dayItems.length ? (
                      <div className="absolute inset-x-5 top-24 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-xs text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                        <div className="flex items-center gap-2 font-semibold">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          Available window
                        </div>
                        <p className="mt-1">{rules?.start_time || '09:00'} - {rules?.end_time || '17:00'}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
