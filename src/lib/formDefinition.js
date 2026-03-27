/**
 * Load and save the questionnaire (form) definition.
 * Used so solicitors can edit question text, labels, and options.
 */
import { supabase, isSupabaseConfigured } from './supabase.js';

const DEFAULT_NAME = 'default';

/**
 * @returns {Promise<{ data: object | null, error: string | null }>}
 * data is the payload (formTitle, formSections) or null if none saved.
 */
export async function getFormDefinition() {
  if (!isSupabaseConfigured()) {
    return { data: null, error: null };
  }
  const { data: row, error } = await supabase
    .from('form_definitions')
    .select('payload')
    .eq('name', DEFAULT_NAME)
    .maybeSingle();
  if (error) {
    // Table may not exist yet (e.g. form_definitions not migrated); use static form and avoid console spam
    if (error.code === 'PGRST205' || (error.message && error.message.includes('Could not find the table'))) {
      return { data: null, error: null };
    }
    console.error('[formDefinition] getFormDefinition error:', error);
    return { data: null, error: error.message };
  }
  const payload = row?.payload;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.formSections)) {
    return { data: null, error: null };
  }
  return { data: payload, error: null };
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
 * Save the questionnaire definition. Staff only (RLS).
 * Uses getSession() (local) instead of getUser() (extra server round-trip) for updated_by.
 * @param {object} payload - { formTitle, formSections }
 * @returns {Promise<{ error: string | null }>}
 */
export async function saveFormDefinition(payload) {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }
  if (!payload || !Array.isArray(payload.formSections)) {
    return { error: 'Invalid payload: formSections required' };
  }

  const t0 = typeof performance !== 'undefined' ? performance.now() : 0;
  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData?.session?.user?.id ?? null;

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
      return { error: error.message };
    }
  } catch (err) {
    console.error('[formDefinition] saveFormDefinition failed:', err);
    return { error: err?.message || 'Save failed' };
  }

  if (t0 && typeof performance !== 'undefined') {
    const ms = Math.round(performance.now() - t0);
    console.log('[WillTool Form] questionnaire saved to Supabase', { ms });
  }
  return { error: null };
}
