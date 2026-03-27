import { supabase, isSupabaseConfigured } from './supabase.js';
import { primeFormDefinitionSessionUserId } from './formDefinition.js';

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

/** Structured pipeline logs — filter console by: WillTool Auth */
function authLog(phase, detail) {
  const ctx = typeof window !== 'undefined' && window.self !== window.top ? 'iframe' : 'top-level';
  if (detail !== undefined) {
    console.log(`[WillTool Auth] ${phase}`, { ...detail, context: ctx });
  } else {
    console.log(`[WillTool Auth] ${phase}`, { context: ctx });
  }
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

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    authError('profiles.select failed', error);
    return { profile: null, error };
  }

  authLog('profiles.select ok', {
    userId,
    hasRow: !!data,
    role: data?.role ?? null,
    email: data?.email ? maskEmail(data.email) : null,
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
    const { data, error } = await supabase.auth.getSession();
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
const SIGN_IN_TIMEOUT_MS = 45_000;
const PROFILE_FETCH_TIMEOUT_MS = 25_000;

function withTimeout(promise, ms, message = 'Sign-in timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function signInWithPasswordOnce(email, password) {
  const result = await withTimeout(
    supabase.auth.signInWithPassword({ email, password }),
    SIGN_IN_TIMEOUT_MS
  );
  return result;
}

export async function signInSolicitor({ email, password }) {
  const host = getSupabaseProjectHost();
  authLog('pipeline start', {
    supabaseHost: host,
    email: maskEmail(email),
    hasPassword: !!password,
    supabaseConfigured: isSupabaseConfigured(),
  });

  if (!isSupabaseConfigured()) {
    authError('abort: Supabase client missing', new Error('Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'));
    return { error: 'Supabase not configured' };
  }

  let data, error;
  try {
    authLog('step 1/4: auth.signInWithPassword (request)', {});
    const result = await signInWithPasswordOnce(email, password);
    data = result.data;
    error = result.error;
  } catch (err) {
    if (err?.message === 'Sign-in timed out') {
      authLog('step 1 retry: first attempt timed out, retrying once', {});
      try {
        const retry = await signInWithPasswordOnce(email, password);
        data = retry.data;
        error = retry.error;
      } catch (err2) {
        if (err2?.message === 'Sign-in timed out') {
          authError('step 1 FAILED: timeout after retry', err2);
          return {
            error:
              'Sign-in timed out. Your browser may be limiting the embedded page — try opening the Will Tool in a full tab (use “Open solicitor login in new tab” on the login page), or check your connection.',
          };
        }
        throw err2;
      }
    } else {
      throw err;
    }
  }

  if (error) {
    authError('step 1 FAILED: auth.signInWithPassword', error);
    authLog('hint: invalid_credentials = wrong password or email not in THIS project; confirm VITE_SUPABASE_URL host matches Supabase dashboard', {
      supabaseHost: host,
    });
    return { error: error.message, code: error.code };
  }

  authLog('step 1 OK: password accepted by Supabase Auth', {
    userId: data.user?.id,
    emailFromAuth: data.user?.email ? maskEmail(data.user.email) : null,
  });

  // Ensure JWT is applied before RLS-protected queries (helps iframe / storage edge cases)
  if (data.session?.access_token && data.session?.refresh_token) {
    authLog('step 2/4: auth.setSession (apply JWT for RLS)', { hasAccessToken: true });
    const { data: sessData, error: setErr } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });
    if (setErr) {
      authError('step 2 WARNING: setSession', setErr);
    } else {
      authLog('step 2 OK: session applied', { sessionUserId: sessData?.session?.user?.id ?? null });
    }
  } else {
    authLog('step 2/4: skipped (no tokens in signIn response — unexpected)', {});
  }

  const userId = data.user?.id ?? null;
  authLog('step 3/4: public.profiles SELECT', { userId });
  let profile = null;
  if (userId) {
    try {
      let fetchResult = await withTimeout(
        fetchProfileRow(userId),
        PROFILE_FETCH_TIMEOUT_MS,
        'Profile lookup timed out'
      );

      if (fetchResult.error) {
        authError('step 3 FAILED: profiles SELECT', fetchResult.error);
        return {
          code: 'profile_fetch_failed',
          error:
            'We could not load your staff account from the server. Please try again in a moment. If this continues, contact technical support.',
          session: data.session ?? null,
          user: data.user ?? null,
          profile: null,
        };
      }

      profile = fetchResult.profile;

      // auth.users row exists but public.profiles row missing (trigger/backfill gap) — sync once via RPC
      if (!profile) {
        authLog('step 3b: no profile row — calling RPC ensure_profile_from_auth', { userId });
        const { error: rpcError } = await supabase.rpc('ensure_profile_from_auth');
        if (rpcError) {
          authError('step 3b FAILED: RPC ensure_profile_from_auth (run migration 20260327120000 if missing)', rpcError);
        } else {
          authLog('step 3b OK: RPC finished, re-fetching profiles', {});
          fetchResult = await fetchProfileRow(userId);
          if (fetchResult.error) {
            authError('step 3 FAILED: profiles SELECT after RPC', fetchResult.error);
            return {
              code: 'profile_fetch_failed',
              error:
                'We could not load your staff account from the server. Please try again in a moment. If this continues, contact technical support.',
              session: data.session ?? null,
              user: data.user ?? null,
              profile: null,
            };
          }
          profile = fetchResult.profile;
        }
      }
    } catch (err) {
      authError('step 3 FAILED: exception during profile load', err);
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
  });
  return { session: data.session ?? null, user: data.user ?? null, profile };
}

export async function signOutSolicitor() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) {
    console.error('[auth] signOut error:', error);
    return { error: error.message };
  }
  return { ok: true };
}

export function subscribeToAuthChanges(callback) {
  if (!supabase) {
    return () => {};
  }

  const { data } = supabase.auth.onAuthStateChange(async (_event, session) => {
    const user = session?.user ?? null;
    const profile = user ? await getProfile(user.id) : null;
    callback({ session: session ?? null, user, profile });
  });

  return () => {
    data.subscription.unsubscribe();
  };
}
