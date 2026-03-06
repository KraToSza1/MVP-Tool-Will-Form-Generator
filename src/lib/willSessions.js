/**
 * Will session persistence: create, load, save by ref + secret.
 * Uses Supabase RPCs so secret is verified in DB (hash); no direct table access for anon.
 */
import { supabase, isSupabaseConfigured } from './supabase.js';

const RPC_CREATE = 'create_will_session';
const RPC_GET = 'get_will_session';
const RPC_UPDATE = 'update_will_session';

/**
 * Generate a URL-safe ref (8–12 alphanumeric) and a random secret for the session.
 * @returns {{ ref: string, secret: string }}
 */
export function generateRefAndSecret() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const refLen = 10;
  const ref = Array.from({ length: refLen }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const secretLen = 24;
  const secret = Array.from({ length: secretLen }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return { ref, secret };
}

/**
 * Create a new session: persist initial payload, return ref + secret.
 * @param {object} payload - Form payload (will be JSON-serialized).
 * @returns {Promise<{ ref: string, secret: string } | { error: string }>}
 */
export async function createSession(payload) {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }
  const { ref, secret } = generateRefAndSecret();
  const { data, error } = await supabase.rpc(RPC_CREATE, {
    p_ref: ref,
    p_secret: secret,
    p_payload: payload ?? {},
  });
  if (error) {
    console.error('[willSessions] createSession error:', error);
    return { error: error.message };
  }
  if (data !== true) {
    return { error: data?.message ?? 'Create failed' };
  }
  return { ref, secret };
}

/**
 * Load session by ref and secret. Returns payload or error.
 * @param {string} ref
 * @param {string} secret
 * @returns {Promise<{ payload: object } | { error: string }>}
 */
export async function loadSession(ref, secret) {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }
  if (!ref || !secret) {
    return { error: 'Ref and secret required' };
  }
  const { data, error } = await supabase.rpc(RPC_GET, {
    p_ref: ref,
    p_secret: secret,
  });
  if (error) {
    console.error('[willSessions] loadSession error:', error);
    return { error: error.message };
  }
  if (data == null) {
    return { error: 'Session not found or invalid secret' };
  }
  const payload = typeof data === 'object' && data !== null && 'payload' in data
    ? data.payload
    : data;
  return { payload: payload ?? {} };
}

/**
 * Save (update) session payload by ref + secret.
 * @param {string} ref
 * @param {string} secret
 * @param {object} payload
 * @returns {Promise<{ ok: true } | { error: string }>}
 */
export async function saveSession(ref, secret, payload) {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }
  if (!ref || !secret) {
    return { error: 'Ref and secret required' };
  }
  const { data, error } = await supabase.rpc(RPC_UPDATE, {
    p_ref: ref,
    p_secret: secret,
    p_payload: payload ?? {},
  });
  if (error) {
    console.error('[willSessions] saveSession error:', error);
    return { error: error.message };
  }
  if (data !== true) {
    return { error: data?.message ?? 'Update failed' };
  }
  return { ok: true };
}

export { isSupabaseConfigured };
