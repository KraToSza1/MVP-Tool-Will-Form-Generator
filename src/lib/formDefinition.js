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

const SAVE_REQUEST_TIMEOUT_MS = 90_000;
/** Single auth attempt — stacking multiple getSession() calls does NOT cancel prior ones and can wedge GoTrue so every DB call waits. */
const GET_SESSION_SINGLE_MS = 8_000;
const GET_USER_SINGLE_MS = 8_000;
/** If getSession keeps timing out, use last known user id for updated_by (RLS still applies on the request). */
const SESSION_USER_CACHE_TTL_MS = 20 * 60 * 1000;

const REVISION_INSERT_TIMEOUT_MS = 25_000;
const LIST_REVISIONS_TIMEOUT_MS = 60_000;

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

function withTimeout(promise, ms, label) {
  const p = promise && typeof promise.then === 'function' ? promise : Promise.resolve(promise);
  return Promise.race([
    p,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || `Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

function getRestConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const base = url && typeof url === 'string' ? url.replace(/\/$/, '') : '';
  return { base, anonKey };
}

/** Read JWT from localStorage — bypasses wedged supabase.auth.getSession() used internally by the JS client. */
function parseJwtExpMs(jwt) {
  try {
    const parts = jwt.split('.');
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : '';
    const json = atob(b64 + pad);
    const payload = JSON.parse(json);
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function getStoredSupabaseAccessToken() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const keys = Object.keys(localStorage);
    for (const k of keys) {
      if (!k.startsWith('sb-') || !k.includes('auth')) continue;
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const token =
        parsed?.access_token ||
        parsed?.currentSession?.access_token ||
        parsed?.session?.access_token;
      if (token && typeof token === 'string') {
        const expMs = parseJwtExpMs(token);
        if (expMs && Date.now() > expMs - 15_000) continue;
        return token;
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Prefer cache first: never call getSession when primed cache is valid (avoids queuing hung GoTrue work).
 * At most ONE getSession + ONE getUser — never stack retries (prior calls are not cancelled by Promise.race).
 */
async function getSessionBounded() {
  const tPipeline = typeof performance !== 'undefined' ? performance.now() : 0;
  const age = Date.now() - sessionUserIdCache.cachedAt;
  if (sessionUserIdCache.userId && age >= 0 && age < SESSION_USER_CACHE_TTL_MS) {
    formLog('session_fast_path', {
      ageMs: age,
      ttlMs: SESSION_USER_CACHE_TTL_MS,
      userIdPrefix: `${sessionUserIdCache.userId.slice(0, 8)}…`,
    });
    return { data: { session: { user: { id: sessionUserIdCache.userId } } } };
  }

  formLog('session_slow_path', { reason: 'cache_missing_or_expired' });

  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getSession_timeout')), GET_SESSION_SINGLE_MS)
      ),
    ]);
    const uid = result?.data?.session?.user?.id ?? null;
    if (uid) {
      primeFormDefinitionSessionUserId(uid);
      formLog('getSession_ok', { ms: Math.round(performance.now() - tPipeline) });
      return result;
    }
    formLog('getSession_null_user', {});
  } catch (e) {
    formLog('getSession_fail', { message: e?.message || String(e) });
  }

  try {
    const gu = await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('getUser_timeout')), GET_USER_SINGLE_MS)),
    ]);
    const user = gu?.data?.user ?? null;
    if (user?.id) {
      primeFormDefinitionSessionUserId(user.id);
      formLog('getUser_ok', { ms: Math.round(performance.now() - tPipeline) });
      return { data: { session: { user } } };
    }
  } catch (e) {
    formLog('getUser_fail', { message: e?.message || String(e) });
  }

  const age2 = Date.now() - sessionUserIdCache.cachedAt;
  if (sessionUserIdCache.userId && age2 >= 0 && age2 < SESSION_USER_CACHE_TTL_MS) {
    formLog('session_resolve_via_cache', {
      ageMs: age2,
      ttlMs: SESSION_USER_CACHE_TTL_MS,
      userIdPrefix: `${sessionUserIdCache.userId.slice(0, 8)}…`,
    });
    return { data: { session: { user: { id: sessionUserIdCache.userId } } } };
  }

  formLog('getSession_exhausted_no_user', { totalMs: Math.round(performance.now() - tPipeline) });
  return { data: { session: null } };
}

/**
 * Direct PostgREST fetch with Bearer from storage — does not use supabase-js request pipeline (avoids internal getSession).
 */
async function restUpsertFormDefinition(payload, userId) {
  const { base, anonKey } = getRestConfig();
  const token = getStoredSupabaseAccessToken();
  if (!base || !anonKey || !token) {
    return { ok: false, reason: 'no_rest_config_or_token' };
  }
  const row = {
    name: DEFAULT_NAME,
    payload,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };
  const endpoint = `${base}/rest/v1/form_definitions?on_conflict=name`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify([row]),
  });
  if (res.ok) {
    return { ok: true };
  }
  const text = await res.text().catch(() => '');
  return {
    ok: false,
    reason: 'http_error',
    status: res.status,
    message: text.slice(0, 300),
  };
}

async function restInsertFormRevision(payload, source, notes, userId) {
  const { base, anonKey } = getRestConfig();
  const token = getStoredSupabaseAccessToken();
  if (!base || !anonKey || !token) {
    return { ok: false, reason: 'no_rest_config_or_token' };
  }
  const row = {
    payload,
    source,
    notes: notes ?? null,
    created_by: userId,
  };
  const res = await fetch(`${base}/rest/v1/form_definition_revisions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([row]),
  });
  if (res.ok) {
    return { ok: true };
  }
  const text = await res.text().catch(() => '');
  return { ok: false, reason: 'http_error', status: res.status, message: text.slice(0, 300) };
}

async function restListFormDefinitionRevisions(limit) {
  const { base, anonKey } = getRestConfig();
  const token = getStoredSupabaseAccessToken();
  if (!base || !anonKey || !token) {
    return { ok: false, reason: 'no_rest_config_or_token' };
  }
  const u = new URL(`${base}/rest/v1/form_definition_revisions`);
  u.searchParams.set('select', 'id,created_at,source,notes,payload');
  u.searchParams.set('order', 'created_at.desc');
  u.searchParams.set('limit', String(limit));
  const res = await fetch(u.toString(), {
    headers: {
      Accept: 'application/json',
      apikey: anonKey,
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { ok: false, status: res.status, message: text.slice(0, 200) };
  }
  const rows = await res.json();
  return { ok: true, rows: Array.isArray(rows) ? rows : [] };
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
  const token = getStoredSupabaseAccessToken();
  if (token) {
    try {
      formLog('revision_insert_transport', { mode: 'rest_fetch_jwt' });
      const rr = await withTimeout(
        restInsertFormRevision(payload, source, notes, userId),
        REVISION_INSERT_TIMEOUT_MS,
        'Recording questionnaire history took too long; your publish may still have succeeded.'
      );
      if (rr.ok) {
        formLog('revision_insert_ok', { source, transport: 'rest' });
        return { revisionId: null, error: null, skipped: false };
      }
      formLog('revision_insert_rest_fallback', { reason: rr.reason, status: rr.status, message: rr.message });
    } catch (e) {
      formLog('revision_insert_rest_fallback', { reason: 'throw', message: e?.message || String(e) });
    }
  } else {
    formLog('revision_insert_transport', { mode: 'supabase_js', reason: 'no_stored_jwt' });
  }
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
    formLog('revision_insert_ok', { source, transport: 'supabase_js' });
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

  const jwtPresent = !!getStoredSupabaseAccessToken();
  if (jwtPresent) {
    try {
      formLog('upsert_transport', { mode: 'rest_fetch_jwt' });
      const rr = await withTimeout(
        restUpsertFormDefinition(payload, userId),
        SAVE_REQUEST_TIMEOUT_MS,
        'Saving the questionnaire took too long. Check your connection and try again.'
      );
      if (rr.ok) {
        formLog('upsert_http_ok', {
          table: 'form_definitions',
          name: DEFAULT_NAME,
          payloadBytes,
          upsertMs: t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0,
          updated_by: userId,
          transport: 'rest',
        });
        const { error: revErr, skipped } = await insertFormRevision(payload, 'save', null, userId);
        if (revErr) {
          formLog('upsert_success_revision_failed', { revisionError: revErr });
        } else {
          formLog('upsert_success', {
            table: 'form_definitions',
            name: DEFAULT_NAME,
            payloadBytes,
            revisionHistoryOk: !skipped,
            transport: 'rest',
          });
        }
        return { error: null, revisionId: null, revisionError: revErr || null };
      }
      formLog('upsert_rest_failed_fallback', { reason: rr.reason, status: rr.status, message: rr.message });
    } catch (err) {
      console.error('[formDefinition] REST upsert failed:', err);
      formLog('upsert_rest_failed_fallback', { reason: 'throw', message: err?.message || String(err) });
    }
  } else {
    formLog('upsert_transport', { mode: 'supabase_js', reason: 'no_stored_jwt' });
  }

  try {
    formLog('upsert_await_start', { saveTimeoutMs: SAVE_REQUEST_TIMEOUT_MS, transport: 'supabase_js' });
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
    transport: 'supabase_js',
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
  if (getStoredSupabaseAccessToken()) {
    try {
      qLog('revisions_list_transport', { mode: 'rest_fetch_jwt' });
      const rr = await withTimeout(
        restListFormDefinitionRevisions(limit),
        LIST_REVISIONS_TIMEOUT_MS,
        'Loading questionnaire history timed out.'
      );
      if (rr.ok && Array.isArray(rr.rows)) {
        const data = rr.rows.map((r) => ({
          id: r.id,
          created_at: r.created_at,
          source: r.source,
          notes: r.notes,
          payloadBytes: payloadByteSize(r.payload),
        }));
        qLog('revisions_list_success', { count: data.length, transport: 'rest' });
        return { data, error: null };
      }
      qLog('revisions_list_rest_fallback', { ok: rr.ok, status: rr.status, message: rr.message });
    } catch (e) {
      qLog('revisions_list_rest_fallback', { message: e?.message || String(e) });
    }
  } else {
    qLog('revisions_list_transport', { mode: 'supabase_js', reason: 'no_stored_jwt' });
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
  qLog('revisions_list_success', { count: data.length, transport: 'supabase_js' });
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
