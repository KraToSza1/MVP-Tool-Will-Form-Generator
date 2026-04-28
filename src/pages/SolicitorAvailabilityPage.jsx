import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, CalendarCheck, CheckCircle2, Clock, Loader2, Save, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import {
  DEFAULT_AVAILABILITY_RULES,
  WEEKDAYS,
  getCurrentProviderToken,
  getMyAvailabilityRules,
  getMyMicrosoftSchedule,
  listCalendarConnections,
  saveMyAvailabilityRules,
  startMicrosoftCalendarConnect,
  syncCurrentCalendarConnection,
} from '../lib/staffCalendar.js';

const DAY_MS = 24 * 60 * 60 * 1000;

function pad(n) {
  return String(n).padStart(2, '0');
}

function localGraphDateTime(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

function timeToParts(value) {
  const [hh = '0', mm = '0'] = String(value || '').split(':');
  return { hour: Number(hh), minute: Number(mm) };
}

function setLocalTime(date, time) {
  const next = new Date(date);
  const parts = timeToParts(time);
  next.setHours(parts.hour, parts.minute, 0, 0);
  return next;
}

function dayKey(date) {
  return date.toLocaleDateString('en-GB', { weekday: 'long' }).toLowerCase();
}

function formatSlot(date) {
  return {
    day: date.toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short' }),
    time: date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  };
}

function parseGraphItems(items) {
  return (items || []).map((item) => ({
    start: new Date(item.start?.dateTime || item.start),
    end: new Date(item.end?.dateTime || item.end),
  })).filter((item) => !Number.isNaN(item.start.getTime()) && !Number.isNaN(item.end.getTime()));
}

function overlapsBusy(start, end, busyItems, bufferMinutes) {
  const bufferMs = bufferMinutes * 60 * 1000;
  return busyItems.some((busy) => start.getTime() < busy.end.getTime() + bufferMs && end.getTime() > busy.start.getTime() - bufferMs);
}

function buildPreviewSlots(rules, busyItems) {
  const normalized = { ...DEFAULT_AVAILABILITY_RULES, ...(rules || {}) };
  const slots = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let dayOffset = 0; dayOffset < 16 && slots.length < 12; dayOffset += 1) {
    const day = new Date(today.getTime() + dayOffset * DAY_MS);
    if (!normalized.working_days.includes(dayKey(day))) continue;

    const dayStart = setLocalTime(day, normalized.start_time);
    const dayEnd = setLocalTime(day, normalized.end_time);
    for (
      let cursor = new Date(dayStart);
      cursor.getTime() + normalized.slot_minutes * 60 * 1000 <= dayEnd.getTime() && slots.length < 12;
      cursor = new Date(cursor.getTime() + (normalized.slot_minutes + normalized.buffer_minutes) * 60 * 1000)
    ) {
      const slotEnd = new Date(cursor.getTime() + normalized.slot_minutes * 60 * 1000);
      if (cursor.getTime() < Date.now()) continue;
      if (overlapsBusy(cursor, slotEnd, busyItems, normalized.buffer_minutes)) continue;
      slots.push({ start: new Date(cursor), end: slotEnd });
    }
  }

  return slots;
}

export default function SolicitorAvailabilityPage() {
  const { user, profile, loading: authLoading } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [rules, setRules] = useState(DEFAULT_AVAILABILITY_RULES);
  const [connection, setConnection] = useState(null);
  const [busyItems, setBusyItems] = useState([]);
  const [graphError, setGraphError] = useState('');
  const [hasProviderToken, setHasProviderToken] = useState(false);
  const [calendarFeatureMissing, setCalendarFeatureMissing] = useState(false);

  const loadAvailability = async () => {
    setLoading(true);
    setGraphError('');
    const [rulesResult, connectionsResult] = await Promise.all([
      getMyAvailabilityRules(),
      listCalendarConnections(),
    ]);
    const featureMissing = Boolean(rulesResult.featureMissing || connectionsResult.featureMissing);
    setCalendarFeatureMissing(featureMissing);
    if (featureMissing) {
      setGraphError('Staff calendar tables are not installed. Run the migration in `supabase/migrations/20260424000000_staff_calendar_and_availability.sql`, then refresh this page.');
    }
    const nextRules = rulesResult.data || DEFAULT_AVAILABILITY_RULES;
    setRules(nextRules);

    let nextConnection = (connectionsResult.data || []).find((c) => c.profile_id === user?.id) || null;
    const providerToken = await getCurrentProviderToken();
    setHasProviderToken(Boolean(providerToken));
    if (providerToken && !featureMissing) {
      const synced = await syncCurrentCalendarConnection();
      if (synced.data) nextConnection = synced.data;
    }
    setConnection(nextConnection);

    if (providerToken && !featureMissing) {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const end = new Date(start.getTime() + 16 * DAY_MS);
      end.setHours(23, 59, 0, 0);
      const schedule = await getMyMicrosoftSchedule({
        start: localGraphDateTime(start),
        end: localGraphDateTime(end),
        timeZone: nextRules.timezone,
        interval: 30,
        email: nextConnection?.calendar_email || profile?.email || user?.email,
      });
      if (schedule.error) {
        setGraphError(schedule.error);
        setBusyItems([]);
      } else {
        setBusyItems(parseGraphItems(schedule.data?.value?.[0]?.scheduleItems));
      }
    } else {
      setBusyItems([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (authLoading) return;
    let active = true;
    (async () => {
      await loadAvailability();
      if (!active) return;
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.id]);

  const previewSlots = useMemo(() => buildPreviewSlots(rules, busyItems), [busyItems, rules]);
  const calendarChecked = Boolean(hasProviderToken && connection?.calendar_email) && !graphError && !loading;

  const setRule = (key, value) => setRules((prev) => ({ ...prev, [key]: value }));

  const toggleDay = (value) => {
    setRules((prev) => {
      const days = new Set(prev.working_days || []);
      if (days.has(value)) days.delete(value);
      else days.add(value);
      return { ...prev, working_days: WEEKDAYS.map((d) => d.value).filter((d) => days.has(d)) };
    });
  };

  const toggleMode = (value) => {
    setRules((prev) => {
      const modes = new Set(prev.booking_modes || []);
      if (modes.has(value)) modes.delete(value);
      else modes.add(value);
      return { ...prev, booking_modes: Array.from(modes) };
    });
  };

  const handleSave = async () => {
    if (calendarFeatureMissing) {
      toast.error('Could not save availability', {
        description: 'Staff calendar tables are missing. Run migration `supabase/migrations/20260424000000_staff_calendar_and_availability.sql` in Supabase SQL Editor, then try again.',
        duration: 14000,
      });
      return;
    }
    setSaving(true);
    const result = await saveMyAvailabilityRules(rules);
    setSaving(false);
    if (result.error) {
      toast.error('Could not save availability', { description: result.error, duration: 12000 });
      return;
    }
    setRules(result.data);
    toast.success('Availability saved', { description: 'Your appointment rules are ready for calendar checks.' });
  };

  const handleConnect = async () => {
    if (calendarFeatureMissing) {
      toast.error('Calendar setup incomplete', {
        description: 'Run migration `supabase/migrations/20260424000000_staff_calendar_and_availability.sql` first, then connect Microsoft calendar.',
        duration: 14000,
      });
      return;
    }
    setConnecting(true);
    const result = await startMicrosoftCalendarConnect({ redirectPath: '/solicitor/availability' });
    setConnecting(false);
    if (result?.error) toast.error('Could not start Microsoft calendar connection', { description: result.error });
  };

  const panelClass = isDark
    ? 'border-slate-700 bg-slate-900/80 ring-1 ring-white/5'
    : 'border-slate-200 bg-white shadow-sm';
  const softClass = isDark ? 'border-slate-700 bg-slate-950/35' : 'border-slate-200 bg-slate-50/80';
  const mutedClass = isDark ? 'text-slate-400' : 'text-slate-600';
  const hasCalendarConnectionRow = Boolean(connection?.calendar_email);
  const connectButtonLabel = hasProviderToken
    ? (hasCalendarConnectionRow ? 'Reconnect Microsoft calendar' : 'Connect Microsoft calendar')
    : (hasCalendarConnectionRow ? 'Connect this browser session' : 'Connect Microsoft calendar');
  const inputClass = isDark
    ? 'w-full rounded-xl border border-slate-600 bg-slate-950/50 px-3 py-2.5 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500'
    : 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500';

  return (
    <div className="min-w-0 space-y-6">
      <Link to="/solicitor" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to dashboard
      </Link>

      <section className={`rounded-2xl border ${panelClass}`}>
        <div className="grid gap-5 p-5 sm:p-6 xl:grid-cols-[1fr_22rem] xl:p-7">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden />
              Availability rules
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 sm:text-3xl">Appointment availability</h1>
            <p className={`mt-2 max-w-2xl text-sm leading-relaxed ${mutedClass}`}>
              Set your appointment windows, then subtract Microsoft 365 busy time to show practical slots for Will matters.
            </p>
          </div>
          <div className={`rounded-2xl border p-4 ${softClass}`}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Calendar check</p>
                <p className={`mt-1 text-xs ${mutedClass}`}>{connection?.calendar_email || profile?.email || 'No Microsoft calendar linked'}</p>
                {!hasProviderToken && hasCalendarConnectionRow ? (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                    Connected previously. Reconnect in this browser to refresh live busy-time checks.
                  </p>
                ) : null}
              </div>
              {calendarChecked ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" aria-hidden />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-500" aria-hidden />
              )}
            </div>
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting || calendarFeatureMissing}
              className="mt-4 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CalendarCheck className="h-4 w-4" aria-hidden />}
              {connectButtonLabel}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className={`flex items-center gap-2 rounded-2xl border p-5 text-sm ${panelClass}`}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading availability…
        </div>
      ) : (
        <section className="grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
          <div className={`rounded-2xl border ${panelClass}`}>
            <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
                <SlidersHorizontal className="h-4 w-4 text-indigo-500" aria-hidden />
                Rules
              </h2>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <label className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Working days</label>
                <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {WEEKDAYS.map((day) => {
                    const active = rules.working_days?.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={`min-h-[44px] rounded-xl border px-2 text-sm font-semibold transition ${
                          active
                            ? 'border-indigo-500 bg-indigo-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-200'
                        }`}
                      >
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="availability-start" className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Start</label>
                  <input id="availability-start" type="time" value={rules.start_time} onChange={(e) => setRule('start_time', e.target.value)} className={`mt-2 ${inputClass}`} />
                </div>
                <div>
                  <label htmlFor="availability-end" className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>End</label>
                  <input id="availability-end" type="time" value={rules.end_time} onChange={(e) => setRule('end_time', e.target.value)} className={`mt-2 ${inputClass}`} />
                </div>
                <div>
                  <label htmlFor="slot-minutes" className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Appointment length</label>
                  <select id="slot-minutes" value={rules.slot_minutes} onChange={(e) => setRule('slot_minutes', Number(e.target.value))} className={`mt-2 ${inputClass}`}>
                    {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="buffer-minutes" className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Buffer</label>
                  <select id="buffer-minutes" value={rules.buffer_minutes} onChange={(e) => setRule('buffer_minutes', Number(e.target.value))} className={`mt-2 ${inputClass}`}>
                    {[0, 10, 15, 30, 45, 60].map((m) => <option key={m} value={m}>{m} minutes</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="location-note" className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Default location</label>
                <input id="location-note" value={rules.location_note || ''} onChange={(e) => setRule('location_note', e.target.value)} className={`mt-2 ${inputClass}`} />
              </div>

              <div>
                <label className={`text-xs font-semibold uppercase tracking-wide ${mutedClass}`}>Appointment modes</label>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {[
                    { value: 'in_person', label: 'In person' },
                    { value: 'video', label: 'Video call' },
                  ].map((mode) => {
                    const active = rules.booking_modes?.includes(mode.value);
                    return (
                      <button
                        type="button"
                        key={mode.value}
                        onClick={() => toggleMode(mode.value)}
                        className={`min-h-[44px] rounded-xl border px-3 text-sm font-semibold transition ${
                          active
                            ? 'border-emerald-500 bg-emerald-600 text-white'
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-200'
                        }`}
                      >
                        {mode.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving || calendarFeatureMissing}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-500"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Save className="h-4 w-4" aria-hidden />}
                Save availability
              </button>
            </div>
          </div>

          <div className={`rounded-2xl border ${panelClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Next open slots</h2>
                <p className={`mt-1 text-xs ${mutedClass}`}>{calendarChecked ? 'Microsoft busy time checked' : 'Rule preview only'}</p>
              </div>
              {graphError ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  Calendar permission needed
                </span>
              ) : null}
            </div>

            {graphError ? (
              <div className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-slate-700 dark:bg-amber-500/10 dark:text-amber-100">
                {graphError}
              </div>
            ) : null}

            <div className="grid gap-3 p-5 md:grid-cols-2">
              {previewSlots.map((slot) => {
                const start = formatSlot(slot.start);
                const end = formatSlot(slot.end);
                return (
                  <div key={slot.start.toISOString()} className={`rounded-2xl border p-4 ${softClass}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{start.day}</p>
                        <p className={`mt-1 text-xs ${mutedClass}`}>{start.time} - {end.time}</p>
                      </div>
                      <Clock className="h-5 w-5 text-indigo-500" aria-hidden />
                    </div>
                  </div>
                );
              })}
              {!previewSlots.length ? (
                <div className={`md:col-span-2 rounded-2xl border p-8 text-center text-sm ${softClass} ${mutedClass}`}>
                  No open slots found in the next two weeks.
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
