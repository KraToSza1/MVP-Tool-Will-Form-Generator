import { supabase, isSupabaseConfigured } from './supabase.js';

/**
 * Firm-wide default appointment rules. Mirrors the firm's everyday booking
 * pattern (09:00–16:00, 30-minute slots, 15-minute buffer). The public
 * booking modal still always tries to load the assigned solicitor's saved
 * rules first — these defaults are only used when no per-solicitor rules
 * exist (e.g. the matter is unassigned, or the new appointments
 * session-helpers migration hasn't been run yet).
 */
export const DEFAULT_APPOINTMENT_RULES = {
  timezone: 'Africa/Johannesburg',
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  start_time: '09:00',
  end_time: '16:00',
  slot_minutes: 30,
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

/**
 * Detect "session helpers migration not yet run" so callers can fall back to
 * the legacy single-RPC flow. The new helpers (get_session_appointment_context,
 * cancel_appointment_by_session, reschedule_appointment_by_session) live in
 * `20260430000000_appointments_session_helpers.sql`.
 */
function isMissingSessionHelpersMigration(error) {
  if (!error) return false;
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return (
    error?.code === '42883' // function does not exist
    || (text.includes('get_session_appointment_context') && text.includes('does not exist'))
    || (text.includes('cancel_appointment_by_session') && text.includes('does not exist'))
    || (text.includes('reschedule_appointment_by_session') && text.includes('does not exist'))
  );
}

/**
 * Normalise rules returned by `get_session_appointment_context` into the
 * shape used by `buildSlotsForDay`. Falls back to firm-wide defaults if the
 * solicitor has not configured availability rules yet.
 */
function normalizeRulesFromRpc(raw) {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_APPOINTMENT_RULES };
  const merged = { ...DEFAULT_APPOINTMENT_RULES, ...raw };
  if (typeof merged.slot_minutes === 'string') merged.slot_minutes = Number(merged.slot_minutes) || DEFAULT_APPOINTMENT_RULES.slot_minutes;
  if (typeof merged.buffer_minutes === 'string') merged.buffer_minutes = Number(merged.buffer_minutes) || DEFAULT_APPOINTMENT_RULES.buffer_minutes;
  if (!Array.isArray(merged.working_days) || merged.working_days.length === 0) {
    merged.working_days = [...DEFAULT_APPOINTMENT_RULES.working_days];
  }
  if (typeof merged.start_time !== 'string' || !merged.start_time) merged.start_time = DEFAULT_APPOINTMENT_RULES.start_time;
  if (typeof merged.end_time !== 'string' || !merged.end_time) merged.end_time = DEFAULT_APPOINTMENT_RULES.end_time;
  return merged;
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
 * Best-effort nudge to drain the appointment email outbox immediately after a
 * booking/cancel/reschedule event. This calls the Supabase Edge Function:
 *   /functions/v1/process-appointment-outbox
 *
 * Notes:
 * - Non-blocking: failures are logged, but never fail booking UX.
 * - Requires the function to be deployed (and typically deployed with
 *   --no-verify-jwt for public client flows).
 */
async function triggerAppointmentOutboxSend(reason = 'unknown') {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) return;
  const url = `${String(baseUrl).replace(/\/$/, '')}/functions/v1/process-appointment-outbox`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.warn('[WillTool Flow] process-appointment-outbox trigger failed', {
        reason,
        status: res.status,
        body: text?.slice?.(0, 300) || '',
      });
    }
  } catch (err) {
    console.warn('[WillTool Flow] process-appointment-outbox trigger error', {
      reason,
      message: err?.message || String(err),
    });
  }
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
  void triggerAppointmentOutboxSend('request_appointment');
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

/**
 * Fetch the matter's solicitor availability rules + active appointment for
 * the public booking modal. Result shape:
 *   { rules, appointment, solicitor, matter, featureMissing }
 *
 * - `rules` is always populated (solicitor's saved rules if present, else
 *   firm-wide defaults). Always safe to feed into `buildSlotsForDay`.
 * - `appointment` is `null` unless there's a future, non-cancelled booking
 *   for this session — in which case we expose its id/start/end so the modal
 *   can render the "Change / Cancel" management view.
 */
export async function getSessionAppointmentContext({ ref, secret }) {
  if (!isSupabaseConfigured()) {
    return { rules: { ...DEFAULT_APPOINTMENT_RULES }, appointment: null, solicitor: null, matter: null, error: 'Supabase not configured' };
  }
  if (!ref || !secret) {
    return { rules: { ...DEFAULT_APPOINTMENT_RULES }, appointment: null, solicitor: null, matter: null, error: 'Missing reference or session secret' };
  }
  const { data, error } = await callAnonRpc('get_session_appointment_context', {
    p_ref: ref,
    p_secret: secret,
  });
  if (error) {
    // Helpful debug breadcrumb for production issues: keeps the UI resilient
    // (fallback defaults) while still exposing the full RPC failure details in
    // browser console when Supabase returns 5xx.
    console.warn('[WillTool Flow] get_session_appointment_context error', {
      ref,
      code: error.code || null,
      message: error.message || null,
      details: error.details || null,
      hint: error.hint || null,
      status: error.status || null,
    });
    if (isMissingAppointmentsMigration(error) || isMissingSessionHelpersMigration(error)) {
      return {
        rules: { ...DEFAULT_APPOINTMENT_RULES },
        appointment: null,
        solicitor: null,
        matter: null,
        featureMissing: true,
        error: null,
      };
    }
    return {
      rules: { ...DEFAULT_APPOINTMENT_RULES },
      appointment: null,
      solicitor: null,
      matter: null,
      error: error.message || 'Could not load booking context',
    };
  }
  const payload = data && typeof data === 'object' ? data : {};
  const rules = normalizeRulesFromRpc(payload.rules);
  const apptRaw = payload.appointment;
  const appointment = apptRaw
    ? {
        id: apptRaw.id,
        start: apptRaw.start_at ? new Date(apptRaw.start_at) : null,
        end: apptRaw.end_at ? new Date(apptRaw.end_at) : null,
        status: apptRaw.status || 'requested',
        notes: apptRaw.notes || '',
        clientName: apptRaw.client_name || '',
        clientEmail: apptRaw.client_email || '',
      }
    : null;
  return {
    rules,
    appointment,
    solicitor: payload.solicitor || null,
    matter: payload.matter || null,
    featureMissing: false,
    error: null,
  };
}

/**
 * Cancel an existing appointment from the public client modal. Authorisation
 * is enforced server-side: the appointment must belong to (ref, secret).
 */
export async function cancelAppointmentBySession({ ref, secret, appointmentId }) {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };
  if (!ref || !secret || !appointmentId) {
    return { error: 'Missing reference, secret or appointment id' };
  }
  const { data, error } = await callAnonRpc('cancel_appointment_by_session', {
    p_ref: ref,
    p_secret: secret,
    p_appointment_id: appointmentId,
  });
  if (error) {
    if (isMissingAppointmentsMigration(error) || isMissingSessionHelpersMigration(error)) {
      return { error: 'Cancel is not available yet. Run the appointments session-helpers migration.', featureMissing: true };
    }
    return { error: error.message || 'Could not cancel appointment' };
  }
  void triggerAppointmentOutboxSend('cancel_appointment_by_session');
  return { data };
}

/**
 * Cancel-and-rebook in one server-side transaction so we never end up with
 * two active appointments for the same session. Surfaces unique-violation
 * conflicts from the partial unique index on `appointments.start_at`.
 */
export async function rescheduleAppointmentBySession({
  ref,
  secret,
  appointmentId,
  startIso,
  durationMinutes = 60,
  notes,
}) {
  if (!isSupabaseConfigured()) return { error: 'Supabase not configured' };
  if (!ref || !secret || !appointmentId || !startIso) {
    return { error: 'Missing reference, secret, appointment id or new start time' };
  }
  const { data, error } = await callAnonRpc('reschedule_appointment_by_session', {
    p_ref: ref,
    p_secret: secret,
    p_appointment_id: appointmentId,
    p_new_start: startIso,
    p_duration_minutes: durationMinutes,
    p_notes: notes ?? null,
  });
  if (error) {
    if (isMissingAppointmentsMigration(error) || isMissingSessionHelpersMigration(error)) {
      return { error: 'Reschedule is not available yet. Run the appointments session-helpers migration.', featureMissing: true };
    }
    if (error.code === '23505' || /unique|already|duplicate/i.test(error.message || '')) {
      return { error: 'That slot was just taken. Please pick another time.', conflict: true };
    }
    return { error: error.message || 'Could not reschedule appointment' };
  }
  void triggerAppointmentOutboxSend('reschedule_appointment_by_session');
  return { data };
}
