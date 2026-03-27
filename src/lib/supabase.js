/**
 * Supabase client for Will Tool Phase 2 persistence.
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in env.
 */
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing; cloud save/load disabled. Add them to .env and restart dev server.');
} else {
  console.log('[Supabase] Client created (URL and anon key present).');
}

/** In a cross-origin iframe, skip parsing OAuth/magic-link hash on load (reduces work; password sign-in does not need it). Top-level keeps URL sessions for reset links etc. */
const detectSessionInUrl =
  typeof window === 'undefined' ? true : window.self === window.top;

export const supabase = url && anonKey
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl,
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;
