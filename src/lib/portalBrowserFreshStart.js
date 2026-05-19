/**
 * Solicitor-facing "fresh start": sign out locally, wipe site storage caches on this browser,
 * keep theme preference, reload to the login route. Helps after wedged OAuth or stale tokens.
 */

import { supabase } from './supabase.js';
import { SOLICITOR_LOGIN_PATH } from './auth.js';
import { BROWSER_CLIENT_DRAFT_STORAGE_KEYS } from './clientIntakeFresh.js';
import { THEME_STORAGE_KEY } from '../context/ThemeContext.jsx';

async function deleteWebCachesIfAny() {
  if (typeof caches === 'undefined' || typeof caches.keys !== 'function') return;
  try {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  } catch {
    /* ignore — private mode / policy */
  }
}

/** Remove Supabase tokens, client-draft keys, sessionStorage; preserve `THEME_STORAGE_KEY`. */
export function purgePortalBrowserStorageSync() {
  if (typeof window === 'undefined') return;

  let themeBackup;
  try {
    themeBackup = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    themeBackup = null;
  }

  try {
    const drop = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (!k || k === THEME_STORAGE_KEY) continue;
      if (k.startsWith('sb-')) drop.push(k);
    }
    drop.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
    BROWSER_CLIENT_DRAFT_STORAGE_KEYS.forEach((k) => {
      try {
        window.localStorage.removeItem(k);
      } catch {
        /* ignore */
      }
    });
  } catch {
    /* ignore */
  }

  try {
    window.sessionStorage.clear();
  } catch {
    /* ignore */
  }

  try {
    if (themeBackup === 'dark' || themeBackup === 'light') {
      window.localStorage.setItem(THEME_STORAGE_KEY, themeBackup);
    }
  } catch {
    /* ignore */
  }
}

/**
 * Local sign-out, purge storage/cache, navigate to solicitor login with `portal_cleared=1`.
 * @param {{ loginPath?: string }} opts
 */
export async function portalFreshStartReload(opts = {}) {
  if (typeof window === 'undefined') return;

  try {
    if (supabase) {
      await supabase.auth.signOut({ scope: 'local' });
    }
  } catch {
    /* continue — still purge local storage */
  }

  purgePortalBrowserStorageSync();
  await deleteWebCachesIfAny();
  assignLogin(opts.loginPath ?? SOLICITOR_LOGIN_PATH);
}

function assignLogin(loginPath) {
  const sep = loginPath.includes('?') ? '&' : '?';
  const url = `${window.location.origin}${loginPath}${sep}portal_cleared=1`;
  window.location.assign(url);
}
