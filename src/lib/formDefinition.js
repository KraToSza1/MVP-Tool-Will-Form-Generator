/**
 * Load and save the questionnaire (form) definition.
 * Used so solicitors can edit question text, labels, and options.
 */
import { supabase, isSupabaseConfigured } from './supabase.js';
import { formLog, isQuestionnaireDebug, payloadByteSize, qLog } from './questionnaireLog.js';
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

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || `Request timed out after ${ms}ms`)), ms)
    ),
  ]);
}

/**
 * @param {object} payload
 * @param {'save'|'restore'|'admin_seed'} source
 * @param {string} [notes]
 */
async function insertFormRevision(payload, source, notes) {
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id ?? null;
  const { data, error } = await supabase
    .from('form_definition_revisions')
    .insert({
      payload,
      source,
      notes: notes ?? null,
      created_by: userId,
    })
    .select('id')
    .maybeSingle();

  if (error) {
    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
      return { revisionId: null, error: null, skipped: true };
    }
    return { revisionId: null, error: error.message, skipped: false };
  }
  return { revisionId: data?.id ?? null, error: null, skipped: false };
}

/**
 * Save the questionnaire definition. Staff only (RLS).
 * Inserts a revision row after successful publish (when table exists).
 * @param {object} payload - { formTitle, formSections }
 * @returns {Promise<{ error: string | null, revisionId?: string | null, revisionError?: string | null }>}
 */
export async function saveFormDefinition(payload) {
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
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id ?? null;

  formLog('upsert_start', {
    table: 'form_definitions',
    onConflict: 'name',
    name: DEFAULT_NAME,
    payloadBytes,
    updated_by: userId,
  });

  try {
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
      formLog('upsert_error', { message: error.message, code: error.code });
      return { error: error.message };
    }
  } catch (err) {
    console.error('[formDefinition] saveFormDefinition failed:', err);
    formLog('upsert_error', { message: err?.message || String(err) });
    return { error: err?.message || 'Save failed' };
  }

  const ms = t0 && typeof performance !== 'undefined' ? Math.round(performance.now() - t0) : 0;

  const { revisionId, error: revErr, skipped } = await insertFormRevision(payload, 'save', null);
  if (revErr) {
    formLog('revision_insert_failed', { message: revErr, upsertMs: ms });
  } else {
    formLog('upsert_success', {
      table: 'form_definitions',
      name: DEFAULT_NAME,
      payloadBytes,
      upsertMs: ms,
      updated_by: userId,
      revisionInserted: !skipped && !!revisionId,
      revisionId: isQuestionnaireDebug() ? revisionId : undefined,
    });
  }

  return { error: null, revisionId, revisionError: revErr || null };
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
  const { data: rows, error } = await supabase
    .from('form_definition_revisions')
    .select('id, created_at, source, notes, payload')
    .order('created_at', { ascending: false })
    .limit(limit);

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

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id ?? null;

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

  const { error: revInsErr } = await insertFormRevision(payload, 'restore', `from revision ${revisionId}`);
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
