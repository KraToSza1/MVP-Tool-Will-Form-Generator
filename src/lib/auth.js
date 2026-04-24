import { supabase, isSupabaseConfigured } from './supabase.js';
import { primeFormDefinitionSessionUserId } from './formDefinition.js';

/** Set for the duration of signInSolicitor — used for nested timing logs */
let activeAuthPipelineStart = null;

/** Safe for console: which Supabase project the browser is using (compare to dashboard URL). */
function getSupabaseProjectHost() {
  try {
    const u = import.meta.env.VITE_SUPABASE_URL;
    return u ? new URL(u).hostname : '(VITE_SUPABASE_URL missing)';
  } catch {
    return '(invalid VITE_SUPABASE_URL)';
  }
}

function maskEmail(email) {
  if (!email || typeof email !== 'string') return '(empty)';
  const at = email.indexOf('@');
  if (at < 1) return '(invalid)';
  const local = email.slice(0, at);
  const domain = email.slice(at);
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}***${domain}`;
}

function nowPerfMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/** Browser hints when diagnosing slow auth (network / tab throttling). */
function getAuthEnvironmentSnapshot() {
  if (typeof window === 'undefined') return {};
  const nav = navigator;
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  return {
    onLine: nav.onLine,
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : undefined,
    iframe: window.self !== window.top,
    connectionEffectiveType: conn?.effectiveType ?? null,
    connectionDownlink: conn?.downlink ?? null,
    connectionRtt: conn?.rtt ?? null,
    saveData: conn?.saveData ?? null,
  };
}

/** Structured pipeline logs — filter console by: WillTool Auth */
function authLog(phase, detail) {
  const ctx = typeof window !== 'undefined' && window.self !== window.top ? 'iframe' : 'top-level';
  if (detail !== undefined) {
    console.log(`[WillTool Auth] ${phase}`, { ...detail, context: ctx });
  } else {
    console.log(`[WillTool Auth] ${phase}`, { context: ctx });
  }
}

/** Timing: stepMs = since last mark, totalMs = since pipeline start */
function authLogTiming(phase, pipelineStart, lastMark) {
  const t = nowPerfMs();
  const stepMs = lastMark != null ? Math.round(t - lastMark) : null;
  const totalMs = pipelineStart != null ? Math.round(t - pipelineStart) : null;
  authLog(phase, {
    ...(stepMs != null ? { stepMs } : {}),
    ...(totalMs != null ? { totalMs } : {}),
    env: getAuthEnvironmentSnapshot(),
  });
  return t;
}

function authError(phase, err) {
  const extra = err && typeof err === 'object'
    ? { message: err.message, code: err.code, details: err.details, hint: err.hint, status: err.status }
    : { raw: String(err) };
  console.error(`[WillTool Auth] ${phase}`, extra);
}

async function fetchProfileRow(userId) {
  if (!supabase || !userId) {
    authLog('profiles.select skipped', { reason: !supabase ? 'no client' : 'no userId' });
    return { profile: null, error: null };
  }

  const q0 = nowPerfMs();
  authLog('profiles.select HTTP start', { userId });
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  const qMs = Math.round(nowPerfMs() - q0);
  authLog('profiles.select HTTP done', { userId, queryMs: qMs });

  if (error) {
    authError('profiles.select failed', error);
    return { profile: null, error };
  }

  authLog('profiles.select ok', {
    userId,
    hasRow: !!data,
    role: data?.role ?? null,
    email: data?.email ? maskEmail(data.email) : null,
    queryMs: qMs,
  });
  primeFormDefinitionSessionUserId(userId);
  return { profile: data ?? null, error: null };
}

/** @deprecated use fetchProfileRow; kept for callers that need only data */
async function getProfile(userId) {
  const { profile } = await fetchProfileRow(userId);
  return profile;
}

export async function getCurrentSession() {
  if (!isSupabaseConfigured()) {
    return { session: null, user: null, profile: null };
  }

  try {
    const g0 = nowPerfMs();
    const { data, error } = await supabase.auth.getSession();
    authLog('getCurrentSession: getSession completed', { ms: Math.round(nowPerfMs() - g0) });
    if (error) {
      console.error('[Solicitor Login] getSession error:', error);
      return { session: null, user: null, profile: null, error: error.message };
    }

    const session = data.session ?? null;
    const user = session?.user ?? null;
    if (user?.id) {
      primeFormDefinitionSessionUserId(user.id);
    }
    const profile = user ? await getProfile(user.id) : null;
    if (session && user) {
      authLog('getCurrentSession', { hasSession: true, hasProfile: !!profile, role: profile?.role, userId: user.id });
    }
    return { session, user, profile };
  } catch (err) {
    console.error('[Solicitor Login] getCurrentSession threw', err);
    return { session: null, user: null, profile: null };
  }
}

/** Embedded iframes (e.g. WordPress) can be slow or throttle auth; allow longer wait. */
const SIGN_IN_TIMEOUT_MS = 60_000;
const PROFILE_FETCH_TIMEOUT_MS = 35_000;

function withTimeout(promise, ms, message = 'Sign-in timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

/**
 * Load public.profiles after sign-in; if missing, run ensure_profile_from_auth then re-fetch.
 * Used for password and Microsoft 365 (OAuth) flows.
 */
async function fetchProfileWithEnsure(userId) {
  if (!userId || !supabase) {
    return { profile: null, error: null };
  }
  let fetchResult = await withTimeout(
    fetchProfileRow(userId),
    PROFILE_FETCH_TIMEOUT_MS,
    'Profile lookup timed out',
  );
  if (fetchResult.error) {
    return { profile: null, error: fetchResult.error };
  }
  let profile = fetchResult.profile;
  if (!profile) {
    authLog('fetchProfileWithEnsure: no profile — calling ensure_profile_from_auth', { userId });
    const { error: rpcError } = await supabase.rpc('ensure_profile_from_auth');
    if (rpcError) {
      authError('fetchProfileWithEnsure: ensure_profile_from_auth failed', rpcError);
    } else {
      authLog('fetchProfileWithEnsure: re-fetching profiles', { userId });
    }
    fetchResult = await withTimeout(
      fetchProfileRow(userId),
      PROFILE_FETCH_TIMEOUT_MS,
      'Profile lookup timed out',
    );
    if (fetchResult.error) {
      return { profile: null, error: fetchResult.error };
    }
    profile = fetchResult.profile;
  }
  return { profile, error: null };
}

async function signInWithPasswordOnce(email, password) {
  const t0 = nowPerfMs();
  authLog('signInWithPassword: inner await start', {
    timeoutCapMs: SIGN_IN_TIMEOUT_MS,
    elapsedSincePipelineStartMs:
      activeAuthPipelineStart != null ? Math.round(t0 - activeAuthPipelineStart) : undefined,
  });
  const result = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    SIGN_IN_TIMEOUT_MS
  );
  authLog('signInWithPassword: inner await done', {
    innerMs: Math.round(nowPerfMs() - t0),
    hasError: !!result?.error,
    hasSession: !!result?.data?.session,
  });
  return result;
}

export async function signInSolicitor({ email, password }) {
  const pipelineStart = nowPerfMs();
  activeAuthPipelineStart = pipelineStart;
  let lastMark = pipelineStart;
  const mark = (phase) => {
    lastMark = authLogTiming(phase, pipelineStart, lastMark);
  };

  const host = getSupabaseProjectHost();
  authLog('pipeline start', {
    supabaseHost: host,
    email: maskEmail(email),
    hasPassword: !!password,
    supabaseConfigured: isSupabaseConfigured(),
    t0: 0,
    env: getAuthEnvironmentSnapshot(),
  });

  if (!isSupabaseConfigured()) {
    authError('abort: Supabase client missing', new Error('Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'));
    activeAuthPipelineStart = null;
    return { error: 'Supabase not configured' };
  }

  let data, error;
  try {
    authLog('step 1/4: auth.signInWithPassword (request)', {
      sincePipelineMs: Math.round(nowPerfMs() - pipelineStart),
    });
    const result = await signInWithPasswordOnce(email, password);
    mark('step 1/4: auth.signInWithPassword (resolved)');
    data = result.data;
    error = result.error;
  } catch (err) {
    if (err?.message === 'Sign-in timed out') {
      authLog('step 1 retry: first attempt timed out, retrying once', {
        sincePipelineMs: Math.round(nowPerfMs() - pipelineStart),
      });
      try {
        const retry = await signInWithPasswordOnce(email, password);
        data = retry.data;
        error = retry.error;
      } catch (err2) {
        if (err2?.message === 'Sign-in timed out') {
          authError('step 1 FAILED: timeout after retry', err2);
          activeAuthPipelineStart = null;
          return {
            error:
              'Sign-in timed out. Your browser may be limiting the embedded page — try opening the Will Tool in a full tab (use “Open solicitor login in new tab” on the login page), or check your connection.',
          };
        }
        activeAuthPipelineStart = null;
        throw err2;
      }
    } else {
      activeAuthPipelineStart = null;
      throw err;
    }
  }

  if (error) {
    authError('step 1 FAILED: auth.signInWithPassword', error);
    activeAuthPipelineStart = null;
    authLog('hint: invalid_credentials = wrong password or email not in THIS project; confirm VITE_SUPABASE_URL host matches Supabase dashboard', {
      supabaseHost: host,
    });
    return { error: error.message, code: error.code };
  }

  authLog('step 1 OK: password accepted by Supabase Auth', {
    userId: data.user?.id,
    emailFromAuth: data.user?.email ? maskEmail(data.user.email) : null,
    sincePipelineMs: Math.round(nowPerfMs() - pipelineStart),
  });

  // Ensure JWT is applied before RLS-protected queries (helps iframe / storage edge cases)
  if (data.session?.access_token && data.session?.refresh_token) {
    authLog('step 2/4: auth.setSession (apply JWT for RLS)', { hasAccessToken: true });
    const set0 = nowPerfMs();
    const { data: sessData, error: setErr } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    authLog('step 2/4: setSession await finished', { setSessionMs: Math.round(nowPerfMs() - set0) });
    mark('step 2/4: setSession marked');
    if (setErr) {
      authError('step 2 WARNING: setSession', setErr);
    } else {
      authLog('step 2 OK: session applied', { sessionUserId: sessData?.session?.user?.id ?? null });
    }
  } else {
    authLog('step 2/4: skipped (no tokens in signIn response — unexpected)', {});
  }

  const userId = data.user?.id ?? null;
  authLog('step 3/4: public.profiles (with ensure)', { userId, sincePipelineMs: Math.round(nowPerfMs() - pipelineStart) });
  let profile = null;
  if (userId) {
    try {
      const { profile: p, error: profErr } = await fetchProfileWithEnsure(userId);
      mark('step 3/4: profile fetch completed');
      if (profErr) {
        authError('step 3 FAILED: profiles', profErr);
        activeAuthPipelineStart = null;
        return {
          code: 'profile_fetch_failed',
          error:
            'We could not load your staff account from the server. Please try again in a moment. If this continues, contact technical support.',
          session: data.session ?? null,
          user: data.user ?? null,
          profile: null,
        };
      }
      profile = p;
    } catch (err) {
      authError('step 3 FAILED: exception during profile load', err);
      activeAuthPipelineStart = null;
      return {
        error:
          'Signed in but could not load your staff profile in time. Refresh the page, or open the Will Tool in a new tab and try again.',
        session: data.session ?? null,
        user: data.user ?? null,
        profile: null,
      };
    }
  }
  if (!profile) {
    authLog('pipeline end: NO PROFILE after auth + RPC', {
      userId,
      supabaseHost: getSupabaseProjectHost(),
      hint: 'Insert row in public.profiles for this user id, or fix RPC',
    });
    activeAuthPipelineStart = null;
    return {
      code: 'no_staff_profile',
      error:
        'Your sign-in worked, but this account is not enabled for staff access yet. Ask your firm administrator to add you to the staff list in the Will Tool.',
      session: data.session ?? null,
      user: data.user ?? null,
      profile: null,
    };
  }
  authLog('pipeline end: SUCCESS', {
    step: '4/4',
    userId,
    role: profile.role,
    email: maskEmail(profile.email || ''),
    totalPipelineMs: Math.round(nowPerfMs() - pipelineStart),
  });
  activeAuthPipelineStart = null;
  return { session: data.session ?? null, user: data.user ?? null, profile };
}

/**
 * Start Microsoft 365 (Entra / Azure AD) sign-in via Supabase OAuth.
 * Configure Azure in Supabase Dashboard (Authentication → Providers → Azure) and add this redirect URL to
 * “Additional redirect URLs”: `https://<your-app-origin>/solicitor/login` (e.g. production + localhost for dev).
 * Supabase callback URL must be in Azure app Redirect URIs: `https://<project-ref>.supabase.co/auth/v1/callback`
 */
function logM365Auth(phase, detail) {
  if (typeof console !== 'undefined' && console.info) {
    console.info(`[WillTool M365 Auth] ${phase}`, detail ?? '');
  }
}

function safeParseAuthRedirectUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.host,
      path: u.pathname,
      provider: u.searchParams.get('provider'),
      redirect_to: u.searchParams.get('redirect_to'),
    };
  } catch {
    return { parseFailed: true };
  }
}

export async function startMicrosoft365SignIn() {
  if (!isSupabaseConfigured() || !supabase) {
    logM365Auth('abort', { reason: 'Supabase not configured' });
    return { error: 'Supabase not configured' };
  }
  if (typeof window === 'undefined') {
    return { error: 'Microsoft sign-in is only available in the browser' };
  }
  const origin = window.location.origin;
  const redirectTo = `${origin}/solicitor/login`;
  logM365Auth('start', {
    supabaseHost: getSupabaseProjectHost(),
    origin,
    redirectTo,
  });
  authLog('startMicrosoft365SignIn: signInWithOAuth azure', { redirectTo, host: getSupabaseProjectHost() });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo,
      scopes: 'email openid profile',
      queryParams: {
        prompt: 'select_account',
      },
    },
  });
  if (error) {
    logM365Auth('signInWithOAuth error', {
      message: error.message,
      name: error.name,
      status: error.status,
      code: error.code,
    });
    authError('startMicrosoft365SignIn failed', error);
    return { error: error.message || 'Could not start Microsoft sign-in' };
  }
  if (data?.url) {
    logM365Auth('redirect (next navigation — Supabase → Microsoft)', safeParseAuthRedirectUrl(data.url));
    window.location.assign(data.url);
    return { ok: true };
  }
  logM365Auth('unexpected response', { hasData: !!data, dataKeys: data ? Object.keys(data) : [] });
  return { error: 'No sign-in URL returned. Enable the Azure provider in the Supabase project and try again.' };
}

/** @returns {boolean} */
export function isMicrosoftSignInEnabled() {
  return import.meta.env.VITE_MICROSOFT_SIGNIN_ENABLED !== 'false';
}

export async function signOutSolicitor() {
  if (!supabase) {
    authLog('signOut: no Supabase client (UI should still clear session)', {});
    return { ok: true };
  }
  authLog('signOut: calling supabase.auth.signOut', {});
  const { error } = await supabase.auth.signOut();
  if (error) {
    authError('signOut failed', error);
    return { error: error.message };
  }
  authLog('signOut: supabase.auth.signOut completed', {});
  return { ok: true };
}

export function subscribeToAuthChanges(callback) {
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const t0 = nowPerfMs();
    authLog('onAuthStateChange', { event, hasSession: !!session });
    const user = session?.user ?? null;

    // IMPORTANT: Do not `await` inside this handler. Supabase can hold resolution of
    // signInWithPassword until the callback completes; if profiles.select hangs (RLS/network),
    // the login button stays on "Signing in..." forever. Defer profile work to the next tick.
    queueMicrotask(() => {
      void (async () => {
        const p0 = nowPerfMs();
        let profile = null;
        if (user?.id) {
          try {
            const { profile: p, error: profErr } = await fetchProfileWithEnsure(user.id);
            profile = p;
            if (profErr) {
              authError('onAuthStateChange: profile load failed', profErr);
            }
          } catch (err) {
            authError('onAuthStateChange: profile fetch exception', err);
          }
        }
        authLog('onAuthStateChange: getProfile done', {
          ms: Math.round(nowPerfMs() - p0),
          sinceEventMs: Math.round(nowPerfMs() - t0),
          hasProfile: !!profile,
        });
        callback({ session: session ?? null, user, profile });
      })();
    });
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
