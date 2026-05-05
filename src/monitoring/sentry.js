import * as Sentry from '@sentry/react';

let sentryReady = false;

/** Optional client-side reporting. Configure VITE_SENTRY_DSN in hosting env (not required for local dev). */
export function initBrowserMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || typeof dsn !== 'string') {
    return false;
  }
  Sentry.init({
    dsn,
    sendDefaultPii: false,
    environment: import.meta.env.PROD ? 'production' : 'development',
    tracesSampleRate: 0,
    beforeSend(event) {
      try {
        if (event.request?.url) {
          const u = new URL(event.request.url);
          u.search = '';
          event.request.url = u.toString();
        }
      } catch {
        /* ignore */
      }
      return event;
    },
  });
  sentryReady = true;
  return true;
}

/**
 * @param {'oauth_return'|'m365_start'|'owner_sign_in'|'policy'} category
 * @param {Record<string, unknown>} data — never pass passwords or tokens
 */
export function captureAuthSupportEvent(category, message, data = {}) {
  if (!sentryReady) return;
  Sentry.captureMessage(message, {
    level: 'warning',
    tags: { auth_flow: category },
    fingerprint: ['auth', category],
    extra: data,
  });
}
