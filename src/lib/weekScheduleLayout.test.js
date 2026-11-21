import { describe, expect, it } from 'vitest';
import { freeSlots, layoutOverlaps, nextWorkingDays, splitDayItems } from './weekScheduleLayout.js';

const day = new Date(2026, 10, 23); // Mon 23 Nov 2026
const at = (h, m = 0, d = day) => { const x = new Date(d); x.setHours(h, m, 0, 0); return x; };
const ev = (s, e, extra = {}) => ({ subject: 'x', status: 'busy', startDate: s, endDate: e, ...extra });

describe('nextWorkingDays', () => {
  it('skips the weekend', () => {
    const sat = new Date(2026, 10, 21);
    const days = nextWorkingDays(sat, 5);
    expect(days.map((d) => d.getDay())).toEqual([1, 2, 3, 4, 5]);
  });
  it('respects custom working days', () => {
    const days = nextWorkingDays(day, 3, ['monday', 'wednesday']);
    expect(days.map((d) => d.getDate())).toEqual([23, 25, 30]);
  });
});

describe('splitDayItems', () => {
  it('turns all-day and out-of-hours items into chips, not tall blocks', () => {
    const allDay = ev(at(0), at(0, 0, new Date(2026, 10, 24)), { subject: 'Billing deadline', status: 'free' });
    const early = ev(at(2), at(2), { subject: 'Zero-length 2am reminder' });
    const meeting = ev(at(14), at(15));
    const { timed, chips } = splitDayItems([allDay, early, meeting], day, 8, 18);
    expect(timed).toHaveLength(1);
    expect(chips.map((c) => c.subject)).toEqual(['Billing deadline', 'Zero-length 2am reminder']);
  });
});

describe('layoutOverlaps', () => {
  it('places overlapping meetings side by side', () => {
    const { timed } = splitDayItems([ev(at(12), at(13)), ev(at(12, 30), at(13, 30)), ev(at(15), at(16))], day, 8, 18);
    const laid = layoutOverlaps(timed);
    expect(laid.map((t) => [t.col, t.cols])).toEqual([[0, 2], [1, 2], [0, 1]]);
  });
});

describe('freeSlots', () => {
  it('finds gaps long enough for an appointment inside working hours', () => {
    const { timed, chips } = splitDayItems([ev(at(10), at(11)), ev(at(11, 15), at(12))], day, 8, 18);
    const slots = freeSlots({ day, timed, chips, windowStart: '09:00', windowEnd: '13:00', minMinutes: 30, now: at(7) });
    expect(slots.map((s) => [s.start.getHours(), s.end.getHours(), s.minutes])).toEqual([[9, 10, 60], [12, 13, 60]]);
  });
  it('ignores items marked free and blocks a busy all-day item', () => {
    const free = splitDayItems([ev(at(9), at(17), { status: 'free' })], day, 8, 18);
    expect(freeSlots({ day, ...free, windowStart: '09:00', windowEnd: '17:00', now: at(7) })).toHaveLength(1);
    const oof = splitDayItems([ev(at(0), at(0, 0, new Date(2026, 10, 24)), { status: 'oof' })], day, 8, 18);
    expect(freeSlots({ day, ...oof, windowStart: '09:00', windowEnd: '17:00', now: at(7) })).toHaveLength(0);
  });
});
