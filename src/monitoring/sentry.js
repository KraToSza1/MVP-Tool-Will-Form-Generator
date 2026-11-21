// Sentry is only downloaded when VITE_SENTRY_DSN is configured, so clients don't pay for it otherwise.
let sentry = null;

/** Optional client-side reporting. Configure VITE_SENTRY_DSN in hosting env (not required for local dev). */
export function initBrowserMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn || typeof dsn !== 'string') {
    return false;
  }
  import('@sentry/react')
    .then((Sentry) => {
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
      sentry = Sentry;
    })
    .catch(() => {
      /* monitoring is optional */
    });
  return true;
}

/**
 * @param {'oauth_return'|'m365_start'|'owner_sign_in'|'policy'} category
 * @param {Record<string, unknown>} data — never pass passwords or tokens
 */
export function captureAuthSupportEvent(category, message, data = {}) {
  if (!sentry) return;
  sentry.captureMessage(message, {
    level: 'warning',
    tags: { auth_flow: category },
    fingerprint: ['auth', category],
    extra: data,
  });
}
