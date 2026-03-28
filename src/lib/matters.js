import { supabase, isSupabaseConfigured } from './supabase.js';
import { buildClientSnapshot, buildMatterPayload, mergeMatterPayloads } from './formPayload.js';
import { compressIdentityVerification } from './compressIdImages.js';

export const MATTER_STATUS = {
  SUBMITTED: 'submitted',
  VERIFICATION_PENDING: 'verification_pending',
  IN_REVIEW: 'in_review',
  COMPLETED: 'completed',
};

// Omit reminder_date until migration 20260308000000_matters_reminder_date.sql has been run in Supabase
const STAFF_MATTER_COLUMNS = `
  id,
  client_reference,
  session_ref,
  status,
  client_name,
  client_email,
  client_phone,
  client_snapshot,
  outstanding_verification,
  assigned_solicitor_id,
  submitted_at,
  reviewed_at,
  completed_at,
  last_activity_at,
  created_at,
  updated_at,
  solicitor_notes,
  client_payload,
  solicitor_payload,
  current_step
`;

function safeJsonByteLength(value) {
  try {
    return JSON.stringify(value).length;
  } catch {
    return -1;
  }
}

/**
 * Call submit_will_matter via PostgREST fetch using the anon key as Bearer.
 * The shared Supabase client may attach a logged-in user's JWT; PostgREST then runs RPC as
 * `authenticated`, which can interact badly with policies. Public questionnaire submit is intended
 * for the `anon` role (same as GRANT EXECUTE TO anon).
 */
async function submitWillMatterViaAnonFetch({ ref, secret, payload, currentIndex, snapshot, signal }) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!baseUrl || !anonKey) {
    return { data: null, error: { message: 'Supabase URL or anon key missing' } };
  }
  const url = `${String(baseUrl).replace(/\/$/, '')}/rest/v1/rpc/submit_will_matter`;
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_ref: ref,
      p_secret: secret,
      p_payload: payload,
      p_current_step: currentIndex,
      p_client_snapshot: snapshot,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    let parsed;
    try {
      parsed = text ? JSON.parse(text) : {};
    } catch {
      parsed = { message: text || res.statusText };
    }
    const msg =
      parsed.message ||
      parsed.hint ||
      (typeof parsed === 'string' ? parsed : null) ||
      `Request failed (${res.status})`;
    return {
      data: null,
      error: {
        message: msg,
        code: parsed.code,
        details: parsed.details,
        hint: parsed.hint,
      },
    };
  }
  if (!text || !String(text).trim()) {
    return { data: null, error: { message: 'Empty response from server' } };
  }
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { data: null, error: { message: 'Invalid JSON from server' } };
  }
  return { data, error: null };
}

export async function submitMatterFromDraft({ ref, secret, formValues, currentIndex }) {
  if (!isSupabaseConfigured()) {
    console.warn('[WillTool Flow] submit_matter: Supabase not configured');
    return { error: 'Supabase not configured' };
  }

  const t0 = performance.now();
  console.log('[WillTool Flow] client_submit_build_start', { ref, currentIndex, phase: 'client_submit_build_start' });

  const payload = buildMatterPayload(formValues, currentIndex);
  if (formValues?.identityVerification && typeof formValues.identityVerification === 'object') {
    console.log('[WillTool Flow] client_submit_compress_id_start', { ref, phase: 'client_submit_compress_id_start' });
    const tCompress = performance.now();
    payload.identityVerification = await compressIdentityVerification(formValues.identityVerification);
    console.log('[WillTool Flow] client_submit_compress_id_done', {
      ref,
      ms: Math.round(performance.now() - tCompress),
      phase: 'client_submit_compress_id_done',
    });
  }

  const snapshot = buildClientSnapshot(formValues);
  const payloadBytes = safeJsonByteLength(payload);
  const snapshotBytes = safeJsonByteLength(snapshot);
  const topLevelKeys = Object.keys(formValues || {}).length;

  console.log('[WillTool Flow] Client submitting to matter (RPC submit_will_matter)', {
    ref,
    currentIndex,
    snapshotKeys: Object.keys(snapshot || {}),
    hasIdDocs: !!payload.identityVerification,
    payloadBytes,
    snapshotBytes,
    formValuesTopLevelKeys: topLevelKeys,
    phase: 'client_submit',
  });

  // Wall-clock cap: some browsers / stacks leave fetch() pending after AbortSignal.abort(), so awaiting
  // only the Supabase client can hang forever. Promise.race + reject always completes; we still abort() to cancel the request.
  const RPC_TIMEOUT_MS = 90_000;
  const controller = new AbortController();
  const rpcCall = (async () => {
    try {
      console.log('[WillTool Flow] client_submit_fetch_anon', { ref, phase: 'client_submit_fetch_anon' });
      return await submitWillMatterViaAnonFetch({
        ref,
        secret,
        payload,
        currentIndex,
        snapshot,
        signal: controller.signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') {
        return {
          data: null,
          error: {
            message: 'Request aborted',
            hint: 'Request was aborted (timeout or manual cancellation)',
          },
        };
      }
      return { data: null, error: { message: e?.message || 'Network error' } };
    }
  })();

  let wallTimeoutId;
  const timeoutRejectPromise = new Promise((_, reject) => {
    wallTimeoutId = setTimeout(() => {
      console.warn('[WillTool Flow] submit_matter: RPC wall-clock timeout (Promise.race)', {
        ref,
        ms: RPC_TIMEOUT_MS,
        phase: 'client_submit_race_timeout',
      });
      try {
        controller.abort();
      } catch (abortErr) {
        console.warn('[WillTool Flow] submit_matter: controller.abort threw', abortErr);
      }
      reject(
        new Error(
          'Submission timed out. Your draft is saved—try again in a moment.',
        ),
      );
    }, RPC_TIMEOUT_MS);
  });

  const heartbeatId = setInterval(() => {
    console.warn('[WillTool Flow] submit_matter: still awaiting RPC…', {
      ref,
      elapsedMs: Math.round(performance.now() - t0),
      phase: 'client_submit_heartbeat',
    });
  }, 10_000);

  const tRpc = performance.now();
  console.log('[WillTool Flow] client_submit_rpc_await', { ref, phase: 'client_submit_rpc_await', elapsedSinceStartMs: Math.round(tRpc - t0) });

  let result;
  try {
    result = await Promise.race([rpcCall, timeoutRejectPromise]);
  } catch (err) {
    clearTimeout(wallTimeoutId);
    clearInterval(heartbeatId);
    console.error('[WillTool Flow] submit_matter: race rejected (timeout or network throw)', {
      ref,
      message: err?.message,
      phase: 'client_submit_race_reject',
    });
    return { error: err?.message || 'Submission failed. Try again.' };
  }

  clearTimeout(wallTimeoutId);
  clearInterval(heartbeatId);

  const rpcMs = Math.round(performance.now() - tRpc);
  const { data, error } = result;

  if (error) {
    const aborted =
      (error?.message || '').includes('AbortError') ||
      (error?.message || '').includes('aborted') ||
      (error?.hint || '').includes('aborted');
    console.error('[WillTool Flow] submit_matter: RPC returned error', {
      ref,
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
      rpcMs,
      aborted,
      phase: 'client_submit_rpc_error',
    });
    if (aborted) {
      return { error: 'Submission timed out. Your draft is saved—try again in a moment.' };
    }
    return { error: error.message || 'Submission failed. Try again.' };
  }

  console.log('[WillTool Flow] Matter created in DB; client submission complete', {
    matterId: data,
    ref,
    rpcMs,
    totalMs: Math.round(performance.now() - t0),
    phase: 'client_submit_done',
  });
  return { matterId: data };
}

export async function listMatters({ search = '', status = 'all', assignedOnly = false, userId = null, sortBy = 'last_activity_at' } = {}) {
  if (!supabase) {
    console.warn('[WillTool Flow] listMatters: Supabase not configured');
    return { data: [], error: 'Supabase not configured' };
  }

  const orderColumn = sortBy === 'submitted_at' ? 'submitted_at' : 'last_activity_at';
  const ascending = false; // newest first for both
  console.log('[WillTool Flow] Solicitor listing matters', { status, search: search || '(none)', assignedOnly, sortBy: orderColumn, phase: 'solicitor_list' });

  let query = supabase
    .from('matters')
    .select(STAFF_MATTER_COLUMNS)
    .order(orderColumn, { ascending, nullsFirst: false });

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (assignedOnly && userId) {
    query = query.eq('assigned_solicitor_id', userId);
  }

  if (search.trim()) {
    query = query.or([
      `client_reference.ilike.%${search}%`,
      `client_name.ilike.%${search}%`,
      `client_email.ilike.%${search}%`,
      `client_phone.ilike.%${search}%`,
    ].join(','));
  }

  const { data, error } = await query;
  if (error) {
    console.error('[WillTool Flow] listMatters: error', error.message, error);
    return { data: [], error: error.message };
  }

  const list = data ?? [];
  console.log('[WillTool Flow] Solicitor matters loaded', { count: list.length, matters: list.length ? list.map(m => ({ id: m.id, ref: m.client_reference, status: m.status })) : [], phase: 'solicitor_list_done' });
  return { data: list };
}

export async function listStaffProfiles() {
  if (!supabase) return { data: [], error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, role')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[WillTool Flow] listStaffProfiles error:', error);
    return { data: [], error: error.message };
  }

  const list = data ?? [];
  console.log('[WillTool Flow] Staff profiles loaded', { count: list.length, phase: 'solicitor_staff_list' });
  return { data: list };
}

export async function getMatterDetail(matterId) {
  if (!supabase) return { error: 'Supabase not configured' };

  const [{ data: matter, error: matterError }, { data: activity, error: activityError }] = await Promise.all([
    supabase
      .from('matters')
      .select(STAFF_MATTER_COLUMNS)
      .eq('id', matterId)
      .maybeSingle(),
    supabase
      .from('matter_activity')
      .select('id, action, actor_type, actor_profile_id, metadata, created_at')
      .eq('matter_id', matterId)
      .order('created_at', { ascending: false }),
  ]);

  if (matterError) {
    console.error('[WillTool Flow] getMatterDetail error:', matterError);
    return { error: matterError.message };
  }

  if (activityError) {
    console.warn('[WillTool Flow] getMatterDetail activity error:', activityError);
  }

  console.log('[WillTool Flow] Matter detail loaded for solicitor', { matterId, clientRef: matter?.client_reference, status: matter?.status, activityCount: (activity ?? []).length, phase: 'solicitor_matter_open' });

  const mergedPayload = mergeMatterPayloads(matter?.client_payload, matter?.solicitor_payload);

  return {
    matter,
    activity: activity ?? [],
    mergedPayload,
  };
}

export async function updateMatterStatus(matterId, status, changes = {}) {
  if (!supabase) return { error: 'Supabase not configured' };

  const payload = {
    status,
    ...changes,
  };

  const { data, error } = await supabase
    .from('matters')
    .update(payload)
    .eq('id', matterId)
    .select('id, status, updated_at, reviewed_at, completed_at, outstanding_verification')
    .maybeSingle();

  if (error) {
    console.error('[WillTool Flow] updateMatterStatus error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'status_changed',
    metadata: { status },
  });

  console.log('[WillTool Flow] Matter status updated', { matterId, status, phase: 'solicitor_status_change' });
  return { data };
}

export async function assignMatter(matterId, assignedSolicitorId) {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('matters')
    .update({
      assigned_solicitor_id: assignedSolicitorId || null,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', matterId)
    .select('id, assigned_solicitor_id, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[WillTool Flow] assignMatter error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'matter_assigned',
    metadata: { assigned_solicitor_id: assignedSolicitorId || null },
  });

  console.log('[WillTool Flow] Matter assigned', { matterId, assignedSolicitorId: assignedSolicitorId || null, phase: 'solicitor_assign' });
  return { data };
}

export async function updateMatterReminderDate(matterId, reminderDate) {
  if (!supabase) return { error: 'Supabase not configured' };

  const payload = { reminder_date: reminderDate || null, last_activity_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('matters')
    .update(payload)
    .eq('id', matterId)
    .select('id, reminder_date, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[WillTool Flow] updateMatterReminderDate error:', error);
    const msg = (error.message || '').toLowerCase();
    if (msg.includes('reminder_date') && (msg.includes('does not exist') || msg.includes('column'))) {
      return { error: 'Reminder dates need a one-time database update. In Supabase SQL Editor run: ALTER TABLE public.matters ADD COLUMN IF NOT EXISTS reminder_date timestamptz; then refresh.' };
    }
    return { error: error.message };
  }

  console.log('[WillTool Flow] Matter reminder date updated', { matterId, reminderDate: reminderDate || null, phase: 'solicitor_reminder_save' });
  return { data };
}

export async function saveSolicitorMatter(matterId, formValues, currentIndex) {
  if (!supabase) return { error: 'Supabase not configured' };

  const payload = buildMatterPayload(formValues, currentIndex);
  const { data, error } = await supabase
    .from('matters')
    .update({
      solicitor_payload: payload,
      current_step: currentIndex,
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', matterId)
    .select('id, updated_at, current_step')
    .maybeSingle();

  if (error) {
    console.error('[WillTool Flow] saveSolicitorMatter error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'solicitor_saved_draft',
    metadata: { current_step: currentIndex },
  });

  console.log('[WillTool Flow] Solicitor form progress saved', { matterId, currentStep: currentIndex, phase: 'solicitor_form_save' });
  return { data };
}

export async function deleteMatter(matterId) {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('matters')
    .delete()
    .eq('id', matterId)
    .select('id');

  if (error) {
    console.error('[WillTool Flow] deleteMatter error:', error);
    return { error: error.message };
  }

  if (!data?.length) {
    console.warn('[WillTool Flow] deleteMatter: no row deleted (forbidden or not found)', { matterId });
    return { error: 'Could not delete matter. You may not have permission, or it was already removed.' };
  }

  console.log('[WillTool Flow] Matter deleted', { matterId, phase: 'solicitor_matter_deleted' });
  return { ok: true };
}

export async function updateSolicitorNotes(matterId, solicitorNotes) {
  if (!supabase) return { error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('matters')
    .update({ solicitor_notes: solicitorNotes })
    .eq('id', matterId)
    .select('id, solicitor_notes, updated_at')
    .maybeSingle();

  if (error) {
    console.error('[WillTool Flow] updateSolicitorNotes error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'solicitor_notes_updated',
    metadata: {},
  });

  console.log('[WillTool Flow] Solicitor notes saved', { matterId, phase: 'solicitor_notes_save' });
  return { data };
}
