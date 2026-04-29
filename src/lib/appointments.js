import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Firm-wide default appointment rules. Mirrors `DEFAULT_AVAILABILITY_RULES`
 * so that the public client booking modal works even before any solicitor
 * has saved their personal rules. Future: fetch a per-solicitor override
 * via a public RPC once the matter has an assigned solicitor.
 */
export const DEFAULT_APPOINTMENT_RULES = {
  timezone: 'Africa/Johannesburg',
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  start_time: '09:00',
  end_time: '17:00',
  slot_minutes: 60,
  buffer_minutes: 15,
};

const MS_MINUTE = 60 * 1000;
const MS_DAY = 24 * 60 * 60 * 1000;

const WEEKDAY_KEYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

function isMissingAppointmentsMigration(error) {
  if (!error) return false;
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return error?.code === '42P01' || text.includes('appointments') && text.includes('does not exist');
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function timeToParts(value) {
  const [hh = '0', mm = '0'] = String(value || '').split(':');
  return { hour: Number(hh) || 0, minute: Number(mm) || 0 };
}

function setLocalTime(date, time) {
  const next = new Date(date);
  const parts = timeToParts(time);
  next.setHours(parts.hour, parts.minute, 0, 0);
  return next;
}

function dayKey(date) {
  return WEEKDAY_KEYS[date.getDay()];
}

/**
 * Generate candidate slots for a single calendar day, respecting the rules
 * and removing any times that overlap with the supplied taken ranges.
 */
export function buildSlotsForDay(date, rules, takenRanges, now = new Date()) {
  const normalized = { ...DEFAULT_APPOINTMENT_RULES, ...(rules || {}) };
  const slots = [];
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);

  if (!normalized.working_days.includes(dayKey(day))) return slots;

  const dayStart = setLocalTime(day, normalized.start_time);
  const dayEnd = setLocalTime(day, normalized.end_time);
  const slotMs = normalized.slot_minutes * MS_MINUTE;
  const stepMs = (normalized.slot_minutes + (normalized.buffer_minutes || 0)) * MS_MINUTE;
  const bufferMs = (normalized.buffer_minutes || 0) * MS_MINUTE;
  const nowMs = now.getTime();

  for (
    let cursor = new Date(dayStart);
    cursor.getTime() + slotMs <= dayEnd.getTime();
    cursor = new Date(cursor.getTime() + stepMs)
  ) {
    const start = new Date(cursor);
    const end = new Date(cursor.getTime() + slotMs);
    const taken = (takenRanges || []).some((r) =>
      start.getTime() < r.end.getTime() + bufferMs && end.getTime() > r.start.getTime() - bufferMs
    );
    const inPast = start.getTime() <= nowMs + 30 * MS_MINUTE;
    slots.push({
      start,
      end,
      taken,
      disabled: taken || inPast,
      reason: inPast ? 'past' : taken ? 'taken' : '',
    });
  }
  return slots;
}

/**
 * Return an array of upcoming working days within [today, today + daysAhead).
 */
export function buildWorkingDayList(rules, daysAhead = 14, now = new Date()) {
  const normalized = { ...DEFAULT_APPOINTMENT_RULES, ...(rules || {}) };
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const days = [];
  for (let i = 0; i < daysAhead; i += 1) {
    const day = new Date(today.getTime() + i * MS_DAY);
    if (!normalized.working_days.includes(dayKey(day))) continue;
    days.push(day);
  }
  return days;
}

/**
 * Format a Date as a friendly local datetime label, working consistently
 * across Safari (Mac/iOS), Chrome, Firefox, and Edge.
 */
export function formatSlotLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.toLocaleDateString(undefined, {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  })} · ${date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
}

function callAnonRpc(name, body) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return Promise.resolve({ data: null, error: { message: 'Supabase URL or anon key missing' } });
  }
  const url = `${String(baseUrl).replace(/\/$/, '')}/rest/v1/rpc/${name}`;
  return fetch(url, {
    method: 'POST',
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
    .then(async (res) => {
      const text = await res.text();
      if (!res.ok) {
        let parsed;
        try {
          parsed = text ? JSON.parse(text) : {};
        } catch {
          parsed = { message: text || res.statusText };
        }
        return {
          data: null,
          error: {
            message: parsed.message || `Request failed (${res.status})`,
            code: parsed.code,
            details: parsed.details,
            hint: parsed.hint,
            status: res.status,
          },
        };
      }
      if (!text || !String(text).trim()) return { data: null, error: null };
      try {
        return { data: JSON.parse(text), error: null };
      } catch {
        return { data: null, error: { message: 'Invalid JSON from server' } };
      }
    })
    .catch((err) => ({ data: null, error: { message: err?.message || 'Network error' } }));
}

/**
 * Fetch active (non-cancelled) appointment ranges that the public booking
 * modal must avoid. Uses anon-key fetch (the RPC is SECURITY DEFINER and
 * verifies ref/secret) so it works without the client being logged in.
 */
export async function listTakenAppointmentSlots({ ref, secret, fromIso, toIso }) {
  if (!isSupabaseConfigured()) {
    return { data: [], error: 'Supabase not configured' };
  }
  if (!ref || !secret) {
    return { data: [], error: 'Missing reference or session secret' };
  }
  const { data, error } = await callAnonRpc('list_appointment_slots_taken', {
    p_ref: ref,
    p_secret: secret,
    p_from: fromIso,
    p_to: toIso,
  });
  if (error) {
    if (isMissingAppointmentsMigration(error)) {
      return { data: [], error: null, featureMissing: true };
    }
    return { data: [], error: error.message || 'Could not load taken slots' };
  }
  const ranges = Array.isArray(data) ? data : [];
  return {
    data: ranges
      .map((row) => ({ start: new Date(row.start_at), end: new Date(row.end_at) }))
      .filter((r) => !Number.isNaN(r.start.getTime()) && !Number.isNaN(r.end.getTime())),
    error: null,
    featureMissing: false,
  };
}

/**
 * Submit an appointment request from the public client booking flow.
 * The DB unique index on active slots prevents double bookings; we surface
 * the conflict so the modal can refresh and prompt the user to pick again.
 */
export async function requestAppointment({
  ref,
  secret,
  startIso,
  durationMinutes = 60,
  notes = '',
  email = '',
  name = '',
}) {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }
  if (!ref || !secret) {
    return { error: 'Missing reference or session secret' };
  }
  if (!startIso) {
    return { error: 'Missing appointment start time' };
  }
  const { data, error } = await callAnonRpc('request_appointment', {
    p_ref: ref,
    p_secret: secret,
    p_start: startIso,
    p_duration_minutes: durationMinutes,
    p_notes: notes,
    p_email: email,
    p_name: name,
  });
  if (error) {
    if (isMissingAppointmentsMigration(error)) {
      return { error: 'Booking is not available yet. Please contact the firm by email.', featureMissing: true };
    }
    if (error.code === '23505' || /unique|already|duplicate/i.test(error.message || '')) {
      return { error: 'That slot was just taken. Please pick another time.', conflict: true };
    }
    return { error: error.message || 'Could not request appointment' };
  }
  return { data };
}

/**
 * Solicitor-side helper: list upcoming appointments for the calendar/dashboard.
 * Uses the standard authenticated supabase client so RLS applies (`is_staff()`).
 */
export async function listUpcomingAppointmentsForStaff({ fromIso, toIso, solicitorId }) {
  if (!isSupabaseConfigured() || !supabase) {
    return { data: [], error: 'Supabase not configured' };
  }
  let query = supabase
    .from('appointments')
    .select('id, matter_id, solicitor_id, client_name, client_email, start_at, end_at, status, notes')
    .neq('status', 'cancelled')
    .order('start_at', { ascending: true });
  if (fromIso) query = query.gte('start_at', fromIso);
  if (toIso) query = query.lte('start_at', toIso);
  if (solicitorId) query = query.eq('solicitor_id', solicitorId);
  const { data, error } = await query;
  if (error) {
    if (isMissingAppointmentsMigration(error)) {
      return { data: [], error: null, featureMissing: true };
    }
    return { data: [], error: error.message || 'Could not load appointments' };
  }
  return { data: data || [], error: null, featureMissing: false };
}

/**
 * Helper used by the booking modal: format a duration in minutes nicely.
 */
export function formatDurationMinutes(minutes) {
  if (!minutes || minutes <= 0) return '';
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const rem = minutes % 60;
  if (rem === 0) return `${hrs} hr`;
  return `${hrs} hr ${rem} min`;
}

/**
 * Format a date as YYYY-MM-DD using local-time fields. Avoids the
 * Safari/iOS pitfall of `toISOString().slice(0, 10)` shifting by tz.
 */
export function localDateKey(date) {
  if (!(date instanceof Date)) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
