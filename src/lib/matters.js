import { supabase, isSupabaseConfigured } from './supabase.js';
import { buildClientSnapshot, buildMatterPayload, mergeMatterPayloads } from './formPayload.js';

export const MATTER_STATUS = {
  SUBMITTED: 'submitted',
  VERIFICATION_PENDING: 'verification_pending',
  IN_REVIEW: 'in_review',
  COMPLETED: 'completed',
};

const STAFF_MATTER_COLUMNS = `
  id,
  client_reference,
  session_ref,
  status,
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
    console.warn('[Will Tool] submit_matter: Supabase not configured');
    return { error: 'Supabase not configured' };
  }

  const payload = buildMatterPayload(formValues, currentIndex);
  if (formValues?.identityVerification && typeof formValues.identityVerification === 'object') {
    payload.identityVerification = formValues.identityVerification;
  }
  const snapshot = buildClientSnapshot(formValues);
  console.log('[Will Tool] submit_matter: calling RPC submit_will_matter', { ref, currentIndex, snapshotKeys: Object.keys(snapshot || {}), hasIdDocs: !!payload.identityVerification });

  const { data, error } = await supabase.rpc('submit_will_matter', {
    p_ref: ref,
    p_secret: secret,
    p_payload: payload,
    p_current_step: currentIndex,
    p_client_snapshot: snapshot,
  });

  if (error) {
    console.error('[Will Tool] submit_matter: error', error.message, error);
    return { error: error.message };
  }

  console.log('[Will Tool] submit_matter: success', { matterId: data });
  return { matterId: data };
}

export async function listMatters({ search = '', status = 'all', assignedOnly = false, userId = null } = {}) {
  if (!supabase) {
    console.warn('[Will Tool] listMatters: Supabase not configured');
    return { data: [], error: 'Supabase not configured' };
  }

  console.log('[Will Tool] listMatters: fetching', { status, search: search || '(none)', assignedOnly });
  let query = supabase
    .from('matters')
    .select(STAFF_MATTER_COLUMNS)
    .order('last_activity_at', { ascending: false });

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
    console.error('[Will Tool] listMatters: error', error.message, error);
    return { data: [], error: error.message };
  }

  const list = data ?? [];
  console.log('[Will Tool] listMatters: got', list.length, 'matter(s)', list.length ? list.map(m => ({ id: m.id, ref: m.client_reference, status: m.status })) : '');
  return { data: list };
}

export async function listStaffProfiles() {
  if (!supabase) return { data: [], error: 'Supabase not configured' };

  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, email, role')
    .order('display_name', { ascending: true });

  if (error) {
    console.error('[matters] listStaffProfiles error:', error);
    return { data: [], error: error.message };
  }

  return { data: data ?? [] };
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
    console.error('[matters] getMatterDetail error:', matterError);
    return { error: matterError.message };
  }

  if (activityError) {
    console.error('[matters] getMatterDetail activity error:', activityError);
  }

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
    console.error('[matters] updateMatterStatus error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'status_changed',
    metadata: { status },
  });

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
    console.error('[matters] assignMatter error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'matter_assigned',
    metadata: { assigned_solicitor_id: assignedSolicitorId || null },
  });

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
    console.error('[matters] saveSolicitorMatter error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'solicitor_saved_draft',
    metadata: { current_step: currentIndex },
  });

  return { data };
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
    console.error('[matters] updateSolicitorNotes error:', error);
    return { error: error.message };
  }

  await supabase.from('matter_activity').insert({
    matter_id: matterId,
    actor_type: 'solicitor',
    actor_profile_id: (await supabase.auth.getUser()).data.user?.id ?? null,
    action: 'solicitor_notes_updated',
    metadata: {},
  });

  return { data };
}
