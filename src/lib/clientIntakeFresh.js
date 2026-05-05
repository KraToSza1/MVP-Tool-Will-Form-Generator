/**
 * Solicitor "Client intake" link target: clears prior browser drafts and avoids resuming completed questionnaires from this device.
 */

export const FRESH_CLIENT_INTAKE_URL = '/?new_intake=1';

const PARAM = 'new_intake';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** @param {string} locationSearch e.g. from useLocation().search (usually includes leading '?') */
export function shouldClearBrowserDraftForFreshIntake(locationSearch) {
  const raw = typeof locationSearch === 'string' ? locationSearch : '';
  const qs = raw.startsWith('?') ? raw.slice(1) : raw;
  const v = new URLSearchParams(qs).get(PARAM);
  return v != null && TRUTHY.has(String(v).trim().toLowerCase());
}

/** Keys used by FormRenderer for local drafts / ref when not using external persistence keys only. */
export const BROWSER_CLIENT_DRAFT_STORAGE_KEYS = ['willForm', 'willFormStep', 'willFormRef'];
