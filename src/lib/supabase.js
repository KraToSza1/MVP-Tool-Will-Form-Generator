/**
 * Supabase client for Will Tool Phase 2 persistence.
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in env.
 */
import { createClient, processLock } from '@supabase/supabase-js';
import { debugLog } from './willToolDebug.js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.warn('[Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY missing; cloud save/load disabled. Add them to .env and restart dev server.');
} else {
  try {
    const host = new URL(url).hostname;
    debugLog('[Supabase] Client created', { host, iframe: typeof window !== 'undefined' && window.self !== window.top });
  } catch {
    debugLog('[Supabase] Client created (URL and anon key present).');
  }
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
        // In-tab lock instead of navigator.locks: avoids "Acquiring an exclusive Navigator LockManager lock
        // ... immediately failed" errors when auto-refresh and init race at start-up.
        lock: processLock,
      },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;

/**
 * Quick "can we reach the Supabase server at all?" check (DNS/network only — any HTTP response counts).
 * Used before redirecting to Microsoft sign-in so staff get a clear message instead of a browser
 * "site can't be reached" page when the backend is down or paused.
 */
export async function isSupabaseReachable(timeoutMs = 6000) {
  if (!url || typeof fetch !== 'function') return false;
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
  try {
    // no-cors: resolves with an opaque response whenever the host answers at all, so CORS rules
    // can never make a healthy server look "down"; only DNS/network failures reject.
    await fetch(`${url.replace(/\/$/, '')}/auth/v1/health`, {
      method: 'GET',
      mode: 'no-cors',
      cache: 'no-store',
      signal: controller?.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    if (timer) clearTimeout(timer);
  }
}
