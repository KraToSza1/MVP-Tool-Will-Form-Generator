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

export async function submitMatterFromDraft({ ref, secret, formValues, currentIndex }) {
  if (!isSupabaseConfigured()) {
    console.warn('[WillTool Flow] submit_matter: Supabase not configured');
    return { error: 'Supabase not configured' };
  }

  const payload = buildMatterPayload(formValues, currentIndex);
  if (formValues?.identityVerification && typeof formValues.identityVerification === 'object') {
    payload.identityVerification = await compressIdentityVerification(formValues.identityVerification);
  }
  const snapshot = buildClientSnapshot(formValues);
  const payloadSize = typeof payload?.identityVerification === 'object'
    ? JSON.stringify(payload).length
    : 0;
  console.log('[WillTool Flow] Client submitting to matter (RPC submit_will_matter)', { ref, currentIndex, snapshotKeys: Object.keys(snapshot || {}), hasIdDocs: !!payload.identityVerification, payloadBytes: payloadSize, phase: 'client_submit' });

  const RPC_TIMEOUT_MS = 90_000; // 90s for large ID doc uploads
  const rpcPromise = supabase.rpc('submit_will_matter', {
    p_ref: ref,
    p_secret: secret,
    p_payload: payload,
    p_current_step: currentIndex,
    p_client_snapshot: snapshot,
  });
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Submission timed out. Your draft is saved—try again or use a smaller file for ID documents.')), RPC_TIMEOUT_MS);
  });

  let result;
  try {
    result = await Promise.race([rpcPromise, timeoutPromise]);
  } catch (err) {
    console.error('[WillTool Flow] submit_matter: threw or timed out', { ref, err });
    return { error: err?.message || 'Submission failed. Try again.' };
  }

  const { data, error } = result;

  if (error) {
    console.error('[WillTool Flow] submit_matter: error', error.message, error);
    return { error: error.message };
  }

  console.log('[WillTool Flow] Matter created in DB; client submission complete', { matterId: data, ref, phase: 'client_submit_done' });
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
