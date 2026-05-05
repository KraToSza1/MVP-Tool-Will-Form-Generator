import { supabase } from './supabase.js';

const SKIP_INGEST_TYPES = new Set(['oauth_return_code_present', 'm365_oauth_redirect_issued', 'm365_oauth_started']);

/**
 * Mirrors local auth diagnostics into Supabase (when migration is applied) so admins can review failures
 * in the solicitor portal without asking staff for clipboard exports.
 *
 * Fire-and-forget; never throws.
 * @param {Record<string, unknown>} row Full diagnostic row ({ ts, type, ...fields })
 */
export function queueSignInSupportFromDiagnosticRow(row) {
  if (!supabase || !row?.type || typeof row.type !== 'string' || SKIP_INGEST_TYPES.has(row.type)) {
    return;
  }

  let attempt =
    typeof row.attemptId === 'string'
      ? row.attemptId
      : null;
  if (!attempt && typeof window !== 'undefined') {
    try {
      attempt = window.sessionStorage.getItem('will-tool-auth-diag-attempt-id-v1');
    } catch {
      attempt = null;
    }
  }

  const omit = new Set(['ts', 'type', 'attemptId']);
  const payload = {};
  for (const [k, val] of Object.entries(row)) {
    if (!omit.has(k)) {
      payload[k] = val;
    }
  }

  let origin = null;
  let pathname = null;
  let userAgent = null;
  if (typeof window !== 'undefined') {
    origin = window.location.origin;
    pathname = window.location.pathname;
    userAgent =
      typeof navigator !== 'undefined' && navigator.userAgent ? String(navigator.userAgent).slice(0, 1024) : null;
  }

  void supabase
    .rpc('record_sign_in_support_event', {
      p_event_type: row.type,
      p_attempt_id: attempt ? String(attempt).slice(0, 128) : null,
      p_payload: payload,
      p_origin: origin,
      p_pathname: pathname,
      p_user_agent: userAgent,
    })
    .then(({ error }) => {
      if (error && import.meta.env.DEV) {
        console.warn('[WillTool signInSupportIngest] RPC skipped or failed — run migration 20260506120000_sign_in_support_events.sql?', error.message);
      }
    })
    .catch(() => {});
}
