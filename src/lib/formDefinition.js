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
    console.error('[formDefinition] getFormDefinition error:', error);
    return { data: null, error: error.message };
  }
  const payload = row?.payload;
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.formSections)) {
    return { data: null, error: null };
  }
  return { data: payload, error: null };
}

/**
 * Save the questionnaire definition. Staff only (RLS).
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
  const { data: user } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('form_definitions')
    .upsert(
      {
        name: DEFAULT_NAME,
        payload,
        updated_at: new Date().toISOString(),
        updated_by: user?.user?.id ?? null,
      },
      { onConflict: 'name' }
    );
  if (error) {
    console.error('[formDefinition] saveFormDefinition error:', error);
    return { error: error.message };
  }
  return { error: null };
}
