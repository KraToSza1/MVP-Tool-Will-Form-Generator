/**
 * Pure layout helpers for the solicitor five-day schedule (no React).
 * Items are Microsoft Graph getSchedule scheduleItems with startDate/endDate Date objects added.
 */

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MIN = 60000;

export function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function atTime(day, hhmm, fallback = '09:00') {
  const raw = typeof hhmm === 'string' && /^\d{1,2}:\d{2}/.test(hhmm) ? hhmm : fallback;
  const [h, m] = raw.split(':').map((n) => parseInt(n, 10));
  const d = startOfDay(day);
  d.setHours(h, m, 0, 0);
  return d;
}

/** Next `count` days (starting today) that fall on the solicitor's working days. */
export function nextWorkingDays(from, count = 5, workingDays) {
  const allowed = new Set(
    (Array.isArray(workingDays) && workingDays.length ? workingDays : DAY_NAMES.slice(1, 6)).map((d) => String(d).toLowerCase()),
  );
  const days = [];
  let cursor = startOfDay(from);
  for (let guard = 0; days.length < count && guard < 21; guard += 1) {
    if (allowed.has(DAY_NAMES[cursor.getDay()])) days.push(new Date(cursor));
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

/**
 * Split a day's items into timed blocks (clipped to the visible window) and "all day / outside hours" chips.
 * Items marked free (e.g. all-day deadline reminders) never block time.
 */
export function splitDayItems(items, day, viewStartHour, viewEndHour) {
  const viewStart = startOfDay(day);
  viewStart.setHours(viewStartHour, 0, 0, 0);
  const viewEnd = startOfDay(day);
  viewEnd.setHours(viewEndHour, 0, 0, 0);
  const dayStart = startOfDay(day);
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * MIN);

  const timed = [];
  const chips = [];
  for (const item of items || []) {
    const s = item.startDate;
    const e = item.endDate;
    if (!(s instanceof Date) || !(e instanceof Date)) continue;
    if (e <= dayStart || s >= dayEnd) continue;
    const duration = (e - s) / MIN;
    const isAllDay = duration >= 23 * 60;
    const overlapsView = e > viewStart && s < viewEnd && duration > 0;
    if (isAllDay || !overlapsView) {
      chips.push({ ...item, allDay: isAllDay });
      continue;
    }
    timed.push({
      ...item,
      clipStart: s < viewStart ? viewStart : s,
      clipEnd: e > viewEnd ? viewEnd : e,
    });
  }
  timed.sort((a, b) => a.clipStart - b.clipStart || b.clipEnd - a.clipEnd);
  return { timed, chips };
}

/** Assign side-by-side columns to overlapping blocks: adds `col` and `cols` to each item. */
export function layoutOverlaps(timed) {
  const out = timed.map((t) => ({ ...t }));
  let cluster = [];
  let clusterEnd = null;
  const flush = () => {
    const colEnds = [];
    for (const item of cluster) {
      let col = colEnds.findIndex((end) => end <= item.clipStart);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(item.clipEnd);
      } else {
        colEnds[col] = item.clipEnd;
      }
      item.col = col;
    }
    for (const item of cluster) item.cols = colEnds.length;
    cluster = [];
    clusterEnd = null;
  };
  for (const item of out) {
    if (clusterEnd && item.clipStart >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = !clusterEnd || item.clipEnd > clusterEnd ? item.clipEnd : clusterEnd;
  }
  if (cluster.length) flush();
  return out;
}

function isBlocking(item) {
  return String(item.status || 'busy').toLowerCase() !== 'free';
}

/** Free gaps inside the appointment window that are at least `minMinutes` long. */
export function freeSlots({ day, timed, chips, windowStart, windowEnd, minMinutes = 30, now = new Date() }) {
  if ((chips || []).some((c) => c.allDay && isBlocking(c))) return [];
  let from = atTime(day, windowStart, '09:00');
  const to = atTime(day, windowEnd, '17:00');
  if (startOfDay(day).getTime() === startOfDay(now).getTime() && now > from) {
    from = new Date(Math.ceil(now.getTime() / (15 * MIN)) * 15 * MIN);
  }
  const busy = (timed || [])
    .filter(isBlocking)
    .map((t) => [t.clipStart, t.clipEnd])
    .sort((a, b) => a[0] - b[0]);
  const slots = [];
  let cursor = from;
  for (const [s, e] of busy) {
    if (e <= cursor) continue;
    if (s > cursor) slots.push([cursor, s < to ? s : to]);
    if (e > cursor) cursor = e;
    if (cursor >= to) break;
  }
  if (cursor < to) slots.push([cursor, to]);
  return slots
    .filter(([s, e]) => e > s && (e - s) / MIN >= minMinutes)
    .map(([start, end]) => ({ start, end, minutes: Math.round((end - start) / MIN) }));
}

export function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}
