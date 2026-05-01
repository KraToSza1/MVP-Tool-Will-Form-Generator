import { supabase } from './supabase.js';
import { SOLICITOR_LOGIN_PATH } from './auth.js';

export const MICROSOFT_CALENDAR_SCOPES = 'email openid profile offline_access User.Read Calendars.ReadBasic';
export const POST_CALENDAR_CONNECT_RETURN_KEY = 'willtool-post-calendar-connect-return';

export const WEEKDAYS = [
  { value: 'monday', label: 'Mon' },
  { value: 'tuesday', label: 'Tue' },
  { value: 'wednesday', label: 'Wed' },
  { value: 'thursday', label: 'Thu' },
  { value: 'friday', label: 'Fri' },
  { value: 'saturday', label: 'Sat' },
  { value: 'sunday', label: 'Sun' },
];

export const DEFAULT_AVAILABILITY_RULES = {
  timezone: 'Africa/Johannesburg',
  working_days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
  start_time: '09:00',
  end_time: '17:00',
  slot_minutes: 60,
  buffer_minutes: 15,
  booking_modes: ['in_person', 'video'],
  location_note: 'Aristone Solicitors',
};

function isMissingCalendarMigration(error) {
  const text = `${error?.message || ''} ${error?.details || ''} ${error?.hint || ''}`.toLowerCase();
  return error?.code === '42P01' || text.includes('staff_calendar_connections') || text.includes('staff_availability_rules');
}

function normalizeTime(value) {
  if (!value || typeof value !== 'string') return value;
  return value.slice(0, 5);
}

function normalizeAvailabilityRules(row) {
  return {
    ...DEFAULT_AVAILABILITY_RULES,
    ...(row || {}),
    start_time: normalizeTime(row?.start_time) || DEFAULT_AVAILABILITY_RULES.start_time,
    end_time: normalizeTime(row?.end_time) || DEFAULT_AVAILABILITY_RULES.end_time,
  };
}

function getBrowserRedirect(path = '/solicitor/calendar') {
  if (typeof window === 'undefined') return path;
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${window.location.origin}${cleanPath}`;
}

function pickUserMetadata(user) {
  const identity = Array.isArray(user?.identities) ? user.identities.find((i) => i.provider === 'azure') : null;
  const identityData = identity?.identity_data || {};
  return {
    providerUserId:
      identityData.oid ||
      identityData.sub ||
      identityData.provider_id ||
      user?.user_metadata?.provider_id ||
      identity?.id ||
      null,
    tenantId: identityData.tid || identityData.tenant_id || user?.user_metadata?.tid || null,
    displayName:
      user?.user_metadata?.full_name ||
      user?.user_metadata?.name ||
      identityData.full_name ||
      identityData.name ||
      user?.email ||
      '',
  };
}

export async function startMicrosoftCalendarConnect({ redirectPath = '/solicitor/calendar' } = {}) {
  if (!supabase) return { error: 'Supabase not configured' };
  if (typeof window === 'undefined') return { error: 'Calendar connection must start in the browser' };

  try {
    window.sessionStorage.setItem(POST_CALENDAR_CONNECT_RETURN_KEY, redirectPath.startsWith('/') ? redirectPath : `/${redirectPath}`);
  } catch {
    /* ignore */
  }

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: getBrowserRedirect(SOLICITOR_LOGIN_PATH),
      scopes: MICROSOFT_CALENDAR_SCOPES,
      queryParams: {
        prompt: 'consent',
      },
    },
  });

  if (error) return { error: error.message || 'Could not start Microsoft calendar connection' };
  if (data?.url) {
    window.location.assign(data.url);
    return { ok: true };
  }
  return { error: 'No Microsoft sign-in URL returned.' };
}

export async function getCurrentProviderToken() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.provider_token || null;
}

export async function getCurrentSessionUser() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data?.session?.user || null;
}

export async function callMicrosoftGraph(path, { method = 'GET', body, headers = {} } = {}) {
  const token = await getCurrentProviderToken();
  if (!token) {
    return {
      data: null,
      error: 'Microsoft calendar is not connected in this browser session.',
      code: 'missing_provider_token',
    };
  }

  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = null;
  }

  if (!res.ok) {
    const message =
      parsed?.error?.message ||
      parsed?.error_description ||
      text ||
      `Microsoft Graph request failed (${res.status})`;
    return {
      data: null,
      error: message,
      status: res.status,
      code: parsed?.error?.code || 'graph_error',
    };
  }

  return { data: parsed, error: null };
}

export async function fetchMicrosoftMe() {
  return callMicrosoftGraph('/me?$select=id,displayName,mail,userPrincipalName');
}

export async function syncCurrentCalendarConnection() {
  if (!supabase) return { data: null, error: 'Supabase not configured' };

  const user = await getCurrentSessionUser();
  if (!user?.id) return { data: null, error: 'Sign in before connecting a calendar' };

  const meta = pickUserMetadata(user);
  const me = await fetchMicrosoftMe();
  const graphUser = me.data || {};
  const calendarEmail = graphUser.mail || graphUser.userPrincipalName || user.email || '';
  const displayName = graphUser.displayName || meta.displayName || calendarEmail;

  const payload = {
    profile_id: user.id,
    provider: 'microsoft',
    tenant_id: meta.tenantId,
    provider_user_id: graphUser.id || meta.providerUserId,
    calendar_email: calendarEmail,
    display_name: displayName || '',
    scopes: MICROSOFT_CALENDAR_SCOPES.split(/\s+/).filter(Boolean),
    connected_at: new Date().toISOString(),
    last_checked_at: new Date().toISOString(),
    last_error: me.error || null,
  };

  const { data, error } = await supabase
    .from('staff_calendar_connections')
    .upsert(payload, { onConflict: 'profile_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingCalendarMigration(error)) {
      return {
        data: {
          ...payload,
          migration_missing: true,
        },
        warning: 'Calendar metadata table is not installed yet.',
      };
    }
    return { data: null, error: error.message };
  }

  return { data };
}

export async function listCalendarConnections() {
  if (!supabase) return { data: [], error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('staff_calendar_connections')
    .select('*')
    .order('display_name', { ascending: true });

  if (error) {
    if (isMissingCalendarMigration(error)) return { data: [], featureMissing: true };
    return { data: [], error: error.message };
  }

  return { data: data || [] };
}

export async function getMyAvailabilityRules() {
  if (!supabase) return { data: DEFAULT_AVAILABILITY_RULES, error: 'Supabase not configured' };

  const user = await getCurrentSessionUser();
  if (!user?.id) return { data: DEFAULT_AVAILABILITY_RULES, error: 'Sign in required' };

  const { data, error } = await supabase
    .from('staff_availability_rules')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (error) {
    if (isMissingCalendarMigration(error)) {
      return { data: DEFAULT_AVAILABILITY_RULES, featureMissing: true };
    }
    return { data: DEFAULT_AVAILABILITY_RULES, error: error.message };
  }

  return { data: normalizeAvailabilityRules(data) };
}

export async function saveMyAvailabilityRules(rules) {
  if (!supabase) return { error: 'Supabase not configured' };

  const user = await getCurrentSessionUser();
  if (!user?.id) return { error: 'Sign in required' };

  const payload = {
    profile_id: user.id,
    timezone: rules.timezone || DEFAULT_AVAILABILITY_RULES.timezone,
    working_days: Array.isArray(rules.working_days) ? rules.working_days : DEFAULT_AVAILABILITY_RULES.working_days,
    start_time: rules.start_time || DEFAULT_AVAILABILITY_RULES.start_time,
    end_time: rules.end_time || DEFAULT_AVAILABILITY_RULES.end_time,
    slot_minutes: Number(rules.slot_minutes) || DEFAULT_AVAILABILITY_RULES.slot_minutes,
    buffer_minutes: Number(rules.buffer_minutes) || DEFAULT_AVAILABILITY_RULES.buffer_minutes,
    booking_modes: Array.isArray(rules.booking_modes) ? rules.booking_modes : DEFAULT_AVAILABILITY_RULES.booking_modes,
    location_note: rules.location_note || '',
  };

  const { data, error } = await supabase
    .from('staff_availability_rules')
    .upsert(payload, { onConflict: 'profile_id' })
    .select('*')
    .maybeSingle();

  if (error) {
    if (isMissingCalendarMigration(error)) {
      return {
        data: normalizeAvailabilityRules(payload),
        error: 'Availability settings table is not installed yet. Run the staff calendar migration, then save again.',
        featureMissing: true,
      };
    }
    return { error: error.message };
  }

  return { data: normalizeAvailabilityRules(data) };
}

export async function getMyMicrosoftSchedule({ start, end, timeZone = 'Africa/Johannesburg', interval = 30, email }) {
  const user = await getCurrentSessionUser();
  const scheduleEmail = email || user?.email;
  if (!scheduleEmail) return { data: null, error: 'No staff calendar email available.' };

  return callMicrosoftGraph('/me/calendar/getSchedule', {
    method: 'POST',
    headers: {
      Prefer: `outlook.timezone="${timeZone}"`,
    },
    body: {
      schedules: [scheduleEmail],
      startTime: {
        dateTime: start,
        timeZone,
      },
      endTime: {
        dateTime: end,
        timeZone,
      },
      availabilityViewInterval: interval,
    },
  });
}
