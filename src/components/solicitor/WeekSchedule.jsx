import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock, ShieldAlert } from 'lucide-react';
import { formatMinutes, freeSlots, layoutOverlaps, splitDayItems, startOfDay } from '../../lib/weekScheduleLayout.js';

const VIEW_START = 8;
const VIEW_END = 18;
const HOUR_PX = 72;
const MAX_SIDE_BY_SIDE = 2;
const MAX_CHIPS = 2;
const HOURS = Array.from({ length: VIEW_END - VIEW_START + 1 }, (_, i) => VIEW_START + i);

const fmtTime = (d) => d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
const fmtDayName = (d) => d.toLocaleDateString('en-GB', { weekday: 'short' });
const fmtDayDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const minutesFromViewStart = (d) => (d.getHours() - VIEW_START) * 60 + d.getMinutes();
const pxTop = (d) => (minutesFromViewStart(d) / 60) * HOUR_PX;
const pxHeight = (s, e) => Math.max(22, ((e - s) / 60000 / 60) * HOUR_PX - 2);

function eventTone(status) {
  const s = String(status || 'busy').toLowerCase();
  if (s === 'tentative') return 'border-indigo-300 bg-indigo-50 text-indigo-900 dark:border-indigo-400/50 dark:bg-indigo-500/15 dark:text-indigo-100 border-dashed';
  if (s === 'oof') return 'border-fuchsia-300 bg-fuchsia-100 text-fuchsia-900 dark:border-fuchsia-400/40 dark:bg-fuchsia-500/20 dark:text-fuchsia-100';
  if (s === 'free') return 'border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300';
  return 'border-indigo-500 bg-indigo-600 text-white dark:border-indigo-400/60 dark:bg-indigo-500/80';
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/**
 * Five working-day schedule: shared time gutter, side-by-side overlapping meetings, all-day/deadline chips,
 * green free slots inside the solicitor's appointment hours, a "now" line, and a day-by-day agenda on phones.
 */
export default function WeekSchedule({ days, items, rules, graphError, onEditAvailability }) {
  const now = useNow();
  const todayKey = startOfDay(now).getTime();
  const [mobileDayIdx, setMobileDayIdx] = useState(0);
  const [detail, setDetail] = useState(null); // { title, items } for the "+N more" list

  const perDay = useMemo(() => days.map((day) => {
    const dayStart = startOfDay(day).getTime();
    const dayEnd = dayStart + 86400000;
    const dayItems = (items || []).filter((it) => it.endDate > dayStart && it.startDate < dayEnd);
    const { timed, chips } = splitDayItems(dayItems, day, VIEW_START, VIEW_END);
    const laid = layoutOverlaps(timed);
    const slots = freeSlots({
      day, timed, chips,
      windowStart: rules?.start_time || '09:00',
      windowEnd: rules?.end_time || '17:00',
      minMinutes: rules?.slot_minutes || 30,
      now,
    });
    const freeMinutes = slots.reduce((n, s) => n + s.minutes, 0);
    const busyCount = timed.filter((t) => String(t.status || 'busy').toLowerCase() !== 'free').length;
    return { day, laid, chips, slots, freeMinutes, busyCount, isToday: dayStart === todayKey };
  }), [days, items, rules, now, todayKey]);

  const hasChips = perDay.some((d) => d.chips.length);
  const totalFree = perDay.reduce((n, d) => n + d.freeMinutes, 0);
  const gridHeight = (VIEW_END - VIEW_START) * HOUR_PX;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4 dark:border-slate-700">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
            <CalendarClock className="h-4 w-4 text-indigo-500" aria-hidden />
            Next 5 working days
          </h2>
          <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">
            {rules?.timezone || 'Africa/Johannesburg'} · appointment hours {rules?.start_time || '09:00'}–{rules?.end_time || '17:00'} ·{' '}
            <span className="font-semibold text-emerald-700 dark:text-emerald-300">{formatMinutes(totalFree)} free</span> for appointments
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" />Busy</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-indigo-400 bg-indigo-50 dark:bg-indigo-500/15" />Tentative</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-dashed border-emerald-500 bg-emerald-50 dark:bg-emerald-500/15" />Free slot</span>
          {graphError ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
              <ShieldAlert className="h-3.5 w-3.5" aria-hidden /> Calendar permission needed
            </span>
          ) : null}
        </div>
      </header>

      {graphError ? (
        <div className="border-b border-slate-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-slate-700 dark:bg-amber-500/10 dark:text-amber-100">{graphError}</div>
      ) : null}

      {/* Desktop / tablet: week grid */}
      <div className="hidden lg:block">
        <div className="grid grid-cols-[3.5rem_repeat(5,minmax(0,1fr))] border-b border-slate-200 dark:border-slate-700">
          <div />
          {perDay.map(({ day, busyCount, freeMinutes, isToday }) => (
            <div key={day.toISOString()} className={`border-l border-slate-200 px-3 py-2.5 dark:border-slate-700 ${isToday ? 'bg-indigo-50 dark:bg-indigo-500/10' : ''}`}>
              <p className={`text-xs font-semibold uppercase tracking-wide ${isToday ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-400'}`}>
                {isToday ? 'Today' : fmtDayName(day)}
              </p>
              <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{fmtDayDate(day)}</p>
              <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                {busyCount} busy · <span className="text-emerald-700 dark:text-emerald-300">{formatMinutes(freeMinutes)} free</span>
              </p>
            </div>
          ))}
        </div>

        {hasChips ? (
          <div className="grid grid-cols-[3.5rem_repeat(5,minmax(0,1fr))] border-b border-slate-200 dark:border-slate-700">
            <div className="px-1 py-2 text-right text-[10px] font-medium uppercase text-slate-500 dark:text-slate-400">All day</div>
            {perDay.map(({ day, chips }) => (
              <div key={day.toISOString()} className="flex min-w-0 flex-col gap-1 border-l border-slate-200 p-1.5 dark:border-slate-700">
                {chips.length > MAX_CHIPS + 1 ? (
                  <button
                    type="button"
                    onClick={() => setDetail({ title: `${fmtDayName(day)} ${fmtDayDate(day)} · all day & outside hours`, items: chips })}
                    className="order-last rounded-md px-2 py-0.5 text-left text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 dark:text-indigo-300 dark:hover:bg-indigo-500/10"
                  >
                    +{chips.length - MAX_CHIPS} more
                  </button>
                ) : null}
                {(chips.length > MAX_CHIPS + 1 ? chips.slice(0, MAX_CHIPS) : chips).map((c, i) => (
                  <span
                    key={i}
                    title={`${c.subject || 'Busy'}${c.allDay ? ' (all day)' : ` · ${fmtTime(c.startDate)}`}`}
                    className="truncate rounded-md border border-slate-300 bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    {c.allDay ? '' : `${fmtTime(c.startDate)} `}{c.subject || 'Busy'}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : null}

        <div className="grid grid-cols-[3.5rem_repeat(5,minmax(0,1fr))]">
          <div className="relative" style={{ height: gridHeight }}>
            {HOURS.slice(0, -1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-slate-500 dark:text-slate-400" style={{ top: (h - VIEW_START) * HOUR_PX + (h === VIEW_START ? 8 : 0) }}>
                {String(h).padStart(2, '0')}:00
              </span>
            ))}
          </div>
          {perDay.map(({ day, laid, slots, isToday }) => (
            <div key={day.toISOString()} className={`relative border-l border-slate-200 dark:border-slate-700 ${isToday ? 'bg-indigo-50/40 dark:bg-indigo-500/5' : ''}`} style={{ height: gridHeight }}>
              {HOURS.slice(1, -1).map((h) => (
                <div key={h} className="absolute inset-x-0 border-t border-slate-100 dark:border-slate-800" style={{ top: (h - VIEW_START) * HOUR_PX }} />
              ))}
              {slots.map((s) => (
                <button
                  key={s.start.toISOString()}
                  type="button"
                  onClick={onEditAvailability}
                  title="Free for appointments — click to change your appointment hours"
                  className="absolute inset-x-1 flex items-start gap-1 overflow-hidden rounded-lg border border-dashed border-emerald-400 bg-emerald-50/70 px-2 py-1 text-left text-[11px] text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/20"
                  style={{ top: pxTop(s.start) + 1, height: pxHeight(s.start, s.end) }}
                >
                  <span className="font-semibold">Free</span> {fmtTime(s.start)}–{fmtTime(s.end)}
                </button>
              ))}
              {Object.values(laid.reduce((acc, ev) => {
                (acc[ev.cluster] ||= []).push(ev);
                return acc;
              }, {})).filter((group) => group[0].cols > MAX_SIDE_BY_SIDE).map((group) => {
                const start = new Date(Math.min(...group.map((g) => g.clipStart)));
                const end = new Date(Math.max(...group.map((g) => g.clipEnd)));
                const hiddenCount = group.filter((g) => g.col >= MAX_SIDE_BY_SIDE - 1).length;
                return (
                  <button
                    key={`more-${group[0].cluster}`}
                    type="button"
                    onClick={() => setDetail({ title: `${fmtDayName(day)} ${fmtDayDate(day)} · ${fmtTime(start)}–${fmtTime(end)}`, items: group })}
                    className="absolute z-[1] overflow-hidden rounded-lg border border-indigo-400 bg-indigo-100 px-2 py-1 text-left text-indigo-900 shadow-sm transition hover:bg-indigo-200 dark:border-indigo-400/50 dark:bg-indigo-500/25 dark:text-indigo-50 dark:hover:bg-indigo-500/35"
                    style={{ top: pxTop(start) + 1, height: pxHeight(start, end), left: 'calc(50% + 3px)', width: 'calc(50% - 6px)' }}
                    title="Show all overlapping items"
                  >
                    <p className="text-[12px] font-bold leading-tight">+{hiddenCount} more</p>
                    <p className="text-[10px] leading-tight opacity-80">{fmtTime(start)}–{fmtTime(end)}</p>
                  </button>
                );
              })}
              {laid.filter((ev) => ev.cols <= MAX_SIDE_BY_SIDE || ev.col < MAX_SIDE_BY_SIDE - 1).map((ev, i) => {
                const width = 100 / Math.min(ev.cols, MAX_SIDE_BY_SIDE);
                const short = (ev.clipEnd - ev.clipStart) / 60000 < 40;
                return (
                  <div
                    key={i}
                    title={`${ev.subject || 'Busy'}\n${fmtTime(ev.startDate)}–${fmtTime(ev.endDate)}${ev.location ? `\n${ev.location}` : ''}`}
                    className={`absolute overflow-hidden rounded-lg border px-2 py-1 shadow-sm ${eventTone(ev.status)}`}
                    style={{
                      top: pxTop(ev.clipStart) + 1,
                      height: pxHeight(ev.clipStart, ev.clipEnd),
                      left: `calc(${ev.col * width}% + 3px)`,
                      width: `calc(${width}% - 6px)`,
                    }}
                  >
                    <p className={`truncate text-[11px] font-semibold leading-tight ${short ? 'inline' : ''}`}>{ev.subject || 'Busy'}</p>
                    {!short ? <p className="truncate text-[10px] leading-tight opacity-80">{fmtTime(ev.startDate)}–{fmtTime(ev.endDate)}</p> : null}
                  </div>
                );
              })}
              {isToday && now.getHours() >= VIEW_START && now.getHours() < VIEW_END ? (
                <div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: pxTop(now) }}>
                  <span className="-ml-1 h-2 w-2 rounded-full bg-rose-500" />
                  <span className="h-px flex-1 bg-rose-500" />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      {detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" role="dialog" aria-modal="true" onClick={() => setDetail(null)}>
          <div className="max-h-[80dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between gap-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">{detail.title}</h3>
              <button type="button" onClick={() => setDetail(null)} className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Close</button>
            </div>
            <ul className="space-y-2">
              {[...detail.items].sort((a, b) => a.startDate - b.startDate).map((it, i) => (
                <li key={i} className={`rounded-xl border px-3 py-2 ${eventTone(it.status)}`}>
                  <p className="text-xs font-semibold opacity-90">{it.allDay ? 'All day' : `${fmtTime(it.startDate)}–${fmtTime(it.endDate)}`}</p>
                  <p className="text-sm font-medium">{it.subject || 'Busy'}</p>
                  {it.location ? <p className="text-xs opacity-80">{it.location}</p> : null}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {/* Phones: day picker + agenda list */}
      <div className="lg:hidden">
        <div className="flex gap-1.5 overflow-x-auto border-b border-slate-200 px-3 py-2.5 dark:border-slate-700" role="tablist">
          {perDay.map(({ day, isToday, freeMinutes }, i) => (
            <button
              key={day.toISOString()}
              type="button"
              role="tab"
              aria-selected={mobileDayIdx === i}
              onClick={() => setMobileDayIdx(i)}
              className={`min-h-[44px] min-w-[4.25rem] shrink-0 rounded-xl border px-2.5 py-1.5 text-center transition ${
                mobileDayIdx === i
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-slate-200 bg-white text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
              }`}
            >
              <span className="block text-[11px] font-semibold uppercase">{isToday ? 'Today' : fmtDayName(day)}</span>
              <span className="block text-sm font-bold">{day.getDate()}</span>
              <span className={`block text-[10px] ${mobileDayIdx === i ? 'text-indigo-100' : 'text-emerald-700 dark:text-emerald-300'}`}>{formatMinutes(freeMinutes)}</span>
            </button>
          ))}
        </div>
        {(() => {
          const d = perDay[mobileDayIdx] || perDay[0];
          if (!d) return null;
          const rows = [
            ...d.laid.map((ev) => ({ kind: 'event', start: ev.clipStart, end: ev.clipEnd, ev })),
            ...d.slots.map((s) => ({ kind: 'free', start: s.start, end: s.end })),
          ].sort((a, b) => a.start - b.start);
          return (
            <ul className="space-y-2 p-3">
              {d.chips.map((c, i) => (
                <li key={`c${i}`} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  <span className="font-semibold">{c.allDay ? 'All day' : fmtTime(c.startDate)}</span> · {c.subject || 'Busy'}
                </li>
              ))}
              {rows.map((r, i) => (r.kind === 'free' ? (
                <li key={i}>
                  <button type="button" onClick={onEditAvailability} className="flex min-h-[44px] w-full items-center gap-2 rounded-xl border border-dashed border-emerald-400 bg-emerald-50 px-3 py-2 text-left text-sm text-emerald-800 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200">
                    <Clock className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="font-semibold">{fmtTime(r.start)}–{fmtTime(r.end)}</span>
                    <span className="ml-auto text-xs">Free · {formatMinutes(Math.round((r.end - r.start) / 60000))}</span>
                  </button>
                </li>
              ) : (
                <li key={i} className={`rounded-xl border px-3 py-2 ${eventTone(r.ev.status)}`}>
                  <p className="text-xs font-semibold opacity-90">{fmtTime(r.ev.startDate)}–{fmtTime(r.ev.endDate)}</p>
                  <p className="text-sm font-medium">{r.ev.subject || 'Busy'}</p>
                </li>
              )))}
              {!rows.length && !d.chips.length ? (
                <li className="rounded-xl border border-slate-200 px-3 py-4 text-center text-sm text-slate-600 dark:border-slate-700 dark:text-slate-400">Nothing booked.</li>
              ) : null}
            </ul>
          );
        })()}
      </div>
    </section>
  );
}
