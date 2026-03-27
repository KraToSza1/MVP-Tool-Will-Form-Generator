/**
 * Load and save the questionnaire (form) definition.
 * Used so solicitors can edit question text, labels, and options.
 */
import { supabase, isSupabaseConfigured } from './supabase.js';
import { formLog, payloadByteSize, qLog } from './questionnaireLog.js';
import bundledFactory from '../data/Complete-WillSuite-Form-Data.json';

const DEFAULT_NAME = 'default';
const FACTORY_ID = 'factory';

/**
 * @returns {Promise<{ data: object | null, error: string | null }>}
 * data is the payload (formTitle, formSections) or null if none saved.
 */
export async function getFormDefinition() {
  qLog('get_start', { table: 'form_definitions', name: DEFAULT_NAME });
  if (!isSupabaseConfigured()) {
    qLog('get_skip', { reason: 'Supabase not configured' });
    return { data: null, error: null };
  }
  const { data: row, error } = await supabase
    .from('form_definitions')
    .select('payload')
    .eq('name', DEFAULT_NAME)
    .maybeSingle();
  if (error) {
    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
      qLog('get_fallback_static', { reason: 'table_missing', code: error.code });
      return { data: null, error: null };
    }
    console.error('[formDefinition] getFormDefinition error:', error);
    qLog('get_error', { message: error.message, code: error.code });
    return { data: null, error: error.message };
  }
  const payload = row?.payload;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.formSections)) {
    qLog('get_fallback_static', { reason: 'no_valid_row' });
    return { data: null, error: null };
  }
  qLog('get_success', {
    table: 'form_definitions',
    name: DEFAULT_NAME,
    payloadBytes: payloadByteSize(payload),
    sectionCount: payload.formSections?.length,
  });
  return { data: payload, error: null };
}

/**
 * Factory default from Supabase, or bundled JSON. Optionally seeds DB when staff and row empty.
 * @returns {Promise<{ data: object | null, error: string | null, source: 'supabase' | 'bundle' | 'bundle_after_failed_seed' }>}
 */
export async function getFactoryDefault() {
  qLog('factory_get_start', { table: 'form_definition_defaults', id: FACTORY_ID });
  if (!isSupabaseConfigured()) {
    qLog('factory_bundle_only', { reason: 'no_supabase' });
    return { data: bundledFactory, error: null, source: 'bundle' };
  }

  const { data: row, error } = await supabase
    .from('form_definition_defaults')
    .select('payload')
    .eq('id', FACTORY_ID)
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
      qLog('factory_table_missing', { fallback: 'bundle' });
      return { data: bundledFactory, error: null, source: 'bundle' };
    }
    qLog('factory_read_error', { message: error.message });
    return { data: bundledFactory, error: null, source: 'bundle' };
  }

  const payload = row?.payload;
  const valid =
    payload &&
    typeof payload === 'object' &&
    Array.isArray(payload.formSections) &&
    payload.formSections.length > 0;

  if (valid) {
    qLog('factory_from_supabase', { payloadBytes: payloadByteSize(payload) });
    return { data: payload, error: null, source: 'supabase' };
  }

  qLog('factory_empty_seed_attempt', { hadRow: !!row });
  const { error: seedErr } = await supabase.from('form_definition_defaults').upsert(
    {
      id: FACTORY_ID,
      payload: bundledFactory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );

  if (seedErr) {
    qLog('factory_seed_failed', { message: seedErr.message, fallback: 'bundle' });
    return { data: bundledFactory, error: null, source: 'bundle_after_failed_seed' };
  }

  qLog('factory_seeded_from_bundle', { payloadBytes: payloadByteSize(bundledFactory) });
  return { data: bundledFactory, error: null, source: 'supabase' };
}

const SAVE_REQUEST_TIMEOUT_MS = 60_000;
/** Per-attempt cap for getSession / getUser races (4s was too aggressive under GC or main-thread pressure). */
const GET_SESSION_ATTEMPT_MS = 12_000;
const GET_SESSION_MAX_ATTEMPTS = 3;
const GET_SESSION_RETRY_DELAY_MS = 350;
const GET_USER_ATTEMPT_MS = 10_000;
/** If getSession keeps timing out, use last known user id for updated_by (RLS still applies on the request). */
const SESSION_USER_CACHE_TTL_MS = 20 * 60 * 1000;

const REVISION_INSERT_TIMEOUT_MS = 20_000;
const LIST_REVISIONS_TIMEOUT_MS = 15_000;

let sessionUserIdCache = { userId: null, cachedAt: 0 };

/**
 * Call when auth/profile resolves (e.g. profiles.select ok) so saves can still set updated_by if getSession races.
 * @param {string | null | undefined} userId
 */
export function primeFormDefinitionSessionUserId(userId) {
  if (userId && typeof userId === 'string') {
    sessionUserIdCache = { userId, cachedAt: Date.now() };
    formLog('session_cache_primed', { userIdPrefix: `${userId.slice(0, 8)}…` });
  }
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function withTimeout(promise, ms, label) {
  const p = promise && typeof promise.then === 'function' ? promise : Promise.resolve(promise);
  return Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || `Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * Resolve session for updated_by without hanging forever. Retries, getUser fallback, then short-lived cache.
 */
async function getSessionBounded() {
  const tPipeline = typeof performance !== 'undefined' ? performance.now() : 0;

  const tryOnceGetSession = async (attempt) => {
    const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
    formLog('getSession_attempt_start', { attempt, max: GET_SESSION_MAX_ATTEMPTS, budgetMs: GET_SESSION_ATTEMPT_MS });
    try {
      const result = await Promise.race([
        supabase.auth.getSession(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('getSession_timeout')), GET_SESSION_ATTEMPT_MS)
        ),
      ]);
      const ms = t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
      const uid = result?.data?.session?.user?.id ?? null;
      formLog('getSession_attempt_ok', { attempt, ms, hasUserId: !!uid });
      if (uid) {
        primeFormDefinitionSessionUserId(uid);
      }
      return result;
    } catch (e) {
      const ms = t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
      formLog('getSession_attempt_fail', {
        attempt,
        ms,
        message: e?.message || String(e),
      });
      throw e;
    }
  };

  for (let attempt = 1; attempt <= GET_SESSION_MAX_ATTEMPTS; attempt++) {
    try {
      return await tryOnceGetSession(attempt);
    } catch {
      if (attempt < GET_SESSION_MAX_ATTEMPTS) {
        formLog('getSession_retry_backoff', { delayMs: GET_SESSION_RETRY_DELAY_MS, nextAttempt: attempt + 1 });
        await sleep(GET_SESSION_RETRY_DELAY_MS);
      }
    }
  }

  formLog('getSession_all_attempts_failed', { attempts: GET_SESSION_MAX_ATTEMPTS });

  const tGu = typeof performance !== 'undefined' ? performance.now() : 0;
  formLog('getUser_fallback_start', { budgetMs: GET_USER_ATTEMPT_MS });
  try {
    const gu = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getUser_timeout')), GET_USER_ATTEMPT_MS)),
    ]);
    const ms = tGu && typeof performance !== 'undefined' ? Math.round(performance.now() - tGu) : 0;
    const user = gu?.data?.user ?? null;
    if (user?.id) {
      primeFormDefinitionSessionUserId(user.id);
      formLog('getUser_fallback_ok', { ms, hasUserId: true });
      return { data: { session: { user } } };
    }
    formLog('getUser_fallback_empty', { ms });
  } catch (e) {
    formLog('getUser_fallback_fail', { message: e?.message || String(e) });
  }

  const age = Date.now() - sessionUserIdCache.cachedAt;
  if (sessionUserIdCache.userId && age >= 0 && age < SESSION_USER_CACHE_TTL_MS) {
    const syntheticId = sessionUserIdCache.userId;
    formLog('session_resolve_via_cache', {
      ageMs: age,
      ttlMs: SESSION_USER_CACHE_TTL_MS,
      userIdPrefix: `${syntheticId.slice(0, 8)}…`,
    });
    return { data: { session: { user: { id: syntheticId } } } };
  }

  const totalMs =
    tPipeline && typeof performance !== 'undefined' ? Math.round(performance.now() - tPipeline) : 0;
  formLog('getSession_exhausted_no_user', { totalMs, hadStaleCache: !!sessionUserIdCache.userId });
  return { data: { session: null } };
}

/**
 * @param {object} payload
 * @param {'save'|'restore'|'admin_seed'} source
 * @param {string} [notes]
 * @param {string | null} [userIdFromSave] - avoids a second getSession round-trip after publish
 */
async function insertFormRevision(payload, source, notes, userIdFromSave = null) {
  let userId = userIdFromSave;
  if (!userId) {
    const { data: sessionData } = await getSessionBounded();
    userId = sessionData?.session?.user?.id ?? null;
  }
  formLog('revision_insert_start', { source, payloadBytes: payloadByteSize(payload), reusedUserId: !!userIdFromSave });
  try {
    const { error } = await withTimeout(
      supabase.from('form_definition_revisions').insert({
        payload,
        source,
        notes: notes ?? null,
        created_by: userId,
      }),
      REVISION_INSERT_TIMEOUT_MS,
      'Recording questionnaire history took too long; your publish may still have succeeded.'
    );

    if (error) {
      if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
        formLog('revision_insert_skipped', { reason: 'table_missing' });
        return { revisionId: null, error: null, skipped: true };
      }
      formLog('revision_insert_error', { message: error.message, code: error.code });
      return { revisionId: null, error: error.message, skipped: false };
    }
    formLog('revision_insert_ok', { source });
    return { revisionId: null, error: null, skipped: false };
  } catch (e) {
    formLog('revision_insert_failed', { message: e?.message || String(e) });
    return { revisionId: null, error: e?.message || 'Revision insert failed', skipped: false };
  }
}

/**
 * Save the questionnaire definition. Staff only (RLS).
 * Inserts a revision row after successful publish (when table exists).
 * @param {object} payload - { formTitle, formSections }
 * @returns {Promise<{ error: string | null, revisionId?: string | null, revisionError?: string | null }>}
 */
export async function saveFormDefinition(payload) {
  formLog('save_pipeline_enter');
  if (!isSupabaseConfigured()) {
    formLog('save_error', { reason: 'Supabase not configured' });
    return { error: 'Supabase not configured' };
  }
  if (!payload || !Array.isArray(payload.formSections)) {
    formLog('save_error', { reason: 'invalid_payload' });
    return { error: 'Invalid payload: formSections required' };
  }

  const payloadBytes = payloadByteSize(payload);
  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;

  formLog('upsert_start', {
    table: 'form_definitions',
    onConflict: 'name',
    name: DEFAULT_NAME,
    payloadBytes,
  });

  const { data: sessionData } = await getSessionBounded();
  const userId = sessionData?.session?.user?.id ?? null;
  formLog('session_resolved', { hasUserId: !!userId });

  try {
    formLog('upsert_await_start', { saveTimeoutMs: SAVE_REQUEST_TIMEOUT_MS });
    const { error } = await withTimeout(
      supabase.from('form_definitions').upsert(
        {
          name: DEFAULT_NAME,
          payload,
          updated_at: new Date().toISOString(),
          updated_by: userId,
        },
        { onConflict: 'name' }
      ),
      SAVE_REQUEST_TIMEOUT_MS,
      'Saving the questionnaire took too long. Check your connection and try again.'
    );
    if (error) {
      console.error('[formDefinition] saveFormDefinition error:', error);
      formLog('upsert_error', { message: error.message, code: error.code, phase: 'postgrest_response' });
      return { error: error.message };
    }
  } catch (err) {
    console.error('[formDefinition] saveFormDefinition failed:', err);
    const msg = err?.message || String(err);
    const isTimeout =
      typeof msg === 'string' &&
      (msg.includes('too long') || msg.includes('timed out') || msg.includes('timeout'));
    formLog('upsert_error', {
      message: msg,
      phase: isTimeout ? 'upsert_race_timeout_or_network' : 'upsert_throw',
    });
    return { error: err?.message || 'Save failed' };
  }

  const upsertMs = t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;
  formLog('upsert_http_ok', {
    table: 'form_definitions',
    name: DEFAULT_NAME,
    payloadBytes,
    upsertMs,
    updated_by: userId,
  });

  const { error: revErr, skipped } = await insertFormRevision(payload, 'save', null, userId);
  if (revErr) {
    formLog('upsert_success_revision_failed', { upsertMs, revisionError: revErr });
  } else {
    formLog('upsert_success', {
      table: 'form_definitions',
      name: DEFAULT_NAME,
      payloadBytes,
      upsertMs,
      updated_by: userId,
      revisionHistoryOk: !skipped,
    });
  }

  return { error: null, revisionId: null, revisionError: revErr || null };
}

/**
 * @param {number} [limit]
 * @returns {Promise<{ data: Array<{ id: string, created_at: string, source: string, notes: string | null, payloadBytes: number }>, error: string | null }>}
 */
export async function listFormDefinitionRevisions(limit = 50) {
  qLog('revisions_list_start', { limit });
  if (!isSupabaseConfigured()) {
    return { data: [], error: null };
  }
  let rows;
  let error;
  try {
    const res = await withTimeout(
      supabase
        .from('form_definition_revisions')
        .select('id, created_at, source, notes, payload')
        .order('created_at', { ascending: false })
        .limit(limit),
      LIST_REVISIONS_TIMEOUT_MS,
      'Loading questionnaire history timed out.'
    );
    rows = res.data;
    error = res.error;
  } catch (e) {
    qLog('revisions_list_timeout', { message: e?.message || String(e) });
    return { data: [], error: e?.message || 'Timeout loading history' };
  }

  if (error) {
    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
      return { data: [], error: null };
    }
    qLog('revisions_list_error', { message: error.message });
    return { data: [], error: error.message };
  }

  const data = (rows || []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    source: r.source,
    notes: r.notes,
    payloadBytes: payloadByteSize(r.payload),
  }));
  qLog('revisions_list_success', { count: data.length });
  return { data, error: null };
}

/**
 * Restore a published questionnaire from a revision (copies payload to form_definitions and records a restore revision).
 * @param {string} revisionId
 * @returns {Promise<{ error: string | null }>}
 */
export async function restoreFormDefinitionRevision(revisionId) {
  qLog('restore_start', { revisionId });
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }
  if (!revisionId) {
    return { error: 'Missing revision id' };
  }

  const { data: rev, error: fetchErr } = await supabase
    .from('form_definition_revisions')
    .select('payload')
    .eq('id', revisionId)
    .maybeSingle();

  if (fetchErr) {
    qLog('restore_fetch_error', { message: fetchErr.message });
    return { error: fetchErr.message };
  }
  const payload = rev?.payload;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.formSections)) {
    return { error: 'Invalid revision payload' };
  }

  const { data: sessionData } = await getSessionBounded();
  const userId = sessionData?.session?.user?.id ?? null;

  formLog('restore_upsert_await_start', { saveTimeoutMs: SAVE_REQUEST_TIMEOUT_MS });
  const { error: upErr } = await withTimeout(
    supabase.from('form_definitions').upsert(
      {
        name: DEFAULT_NAME,
        payload,
        updated_at: new Date().toISOString(),
        updated_by: userId,
      },
      { onConflict: 'name' }
    ),
    SAVE_REQUEST_TIMEOUT_MS,
    'Restoring the questionnaire took too long.'
  );

  if (upErr) {
    qLog('restore_upsert_error', { message: upErr.message });
    return { error: upErr.message };
  }

  const { error: revInsErr } = await insertFormRevision(payload, 'restore', `from revision ${revisionId}`, userId);
  if (revInsErr) {
    qLog('restore_revision_log_failed', { message: revInsErr });
  }

  formLog('restore_complete', {
    table: 'form_definitions',
    name: DEFAULT_NAME,
    payloadBytes: payloadByteSize(payload),
    restoredFromRevisionId: revisionId,
  });
  qLog('restore_success', { revisionId });

  return { error: null };
}
