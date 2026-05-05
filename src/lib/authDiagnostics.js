/**
 * Client-side sign-in diagnostic ring buffer (sessionStorage).
 * Helps staff paste a bundle to admins after failed Microsoft / owner sign-in attempts.
 * Does not store tokens, OAuth codes, passwords, or email addresses typed by users.
 */

const STORAGE_KEY_EVENTS = 'will-tool-auth-diag-events-v1';
const STORAGE_KEY_ATTEMPT = 'will-tool-auth-diag-attempt-id-v1';
const MAX_EVENTS = 50;

function nowIso() {
  return new Date().toISOString();
}

function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function readEvents() {
  if (typeof window === 'undefined' || !window.sessionStorage) return [];
  const raw = window.sessionStorage.getItem(STORAGE_KEY_EVENTS);
  const arr = safeJsonParse(raw || '[]');
  return Array.isArray(arr) ? arr : [];
}

function writeEvents(events) {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY_EVENTS, JSON.stringify(events.slice(-MAX_EVENTS)));
  } catch {
    /* quota or private mode */
  }
}

function supabaseHostHint() {
  const u = import.meta.env.VITE_SUPABASE_URL;
  if (!u || typeof u !== 'string') return null;
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

/**
 * Call when the user starts Microsoft 365 sign-in (before redirect).
 * @returns {string} attemptId — share with admin to correlate with Supabase Auth logs (time window).
 */
export function beginMicrosoftSignInAttempt() {
  if (typeof window === 'undefined' || !window.crypto?.randomUUID) {
    return 'unknown';
  }
  const attemptId = window.crypto.randomUUID();
  try {
    window.sessionStorage.setItem(STORAGE_KEY_ATTEMPT, attemptId);
  } catch {
    /* ignore */
  }
  pushAuthDiagnosticEvent({
    type: 'm365_oauth_started',
    attemptId,
    origin: window.location.origin,
    pathname: window.location.pathname,
  });
  return attemptId;
}

export function getCurrentSignInAttemptId() {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY_ATTEMPT);
  } catch {
    return null;
  }
}

/**
 * @param {Record<string, unknown>} payload — must be free of secrets (no tokens, codes, passwords).
 */
export function pushAuthDiagnosticEvent(payload) {
  const events = readEvents();
  const row = {
    ts: nowIso(),
    ...payload,
  };
  events.push(row);
  writeEvents(events);
  void import('./signInSupportIngest.js').then(({ queueSignInSupportFromDiagnosticRow }) => {
    queueSignInSupportFromDiagnosticRow(row);
  });
}

export function buildAuthDiagnosticBundle() {
  const events = readEvents();
  const attemptId = getCurrentSignInAttemptId();
  return {
    schema: 'will-tool-auth-diagnostics/1',
    generatedAt: nowIso(),
    attemptId,
    environment: {
      origin: typeof window !== 'undefined' ? window.location.origin : null,
      pathname: typeof window !== 'undefined' ? window.location.pathname : null,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      language: typeof navigator !== 'undefined' ? navigator.language : null,
      supabaseHost: supabaseHostHint(),
      viteMode: import.meta.env.MODE,
    },
    events,
  };
}

export async function copyAuthDiagnosticsToClipboard() {
  const text = JSON.stringify(buildAuthDiagnosticBundle(), null, 2);
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  return false;
}
