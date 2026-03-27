import { supabase, isSupabaseConfigured } from './supabase.js';

async function fetchProfileRow(userId) {
  if (!supabase || !userId) {
    return { profile: null, error: null };
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth] getProfile error:', error);
    return { profile: null, error };
  }

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
    const profile = user ? await getProfile(user.id) : null;
    if (session && user) {
      console.log('[Solicitor Login] getCurrentSession', { hasSession: true, hasProfile: !!profile, role: profile?.role });
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
  console.log('[Solicitor Login] signIn attempt', { email, hasPassword: !!password, supabaseConfigured: isSupabaseConfigured() });

  if (!isSupabaseConfigured()) {
    console.warn('[Solicitor Login] Supabase not configured – check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
    return { error: 'Supabase not configured' };
  }

  let data, error;
  try {
    const result = await signInWithPasswordOnce(email, password);
    data = result.data;
    error = result.error;
  } catch (err) {
    if (err?.message === 'Sign-in timed out') {
      console.warn('[Solicitor Login] first signIn attempt timed out; retrying once (embedded iframes can be slow)');
      try {
        const retry = await signInWithPasswordOnce(email, password);
        data = retry.data;
        error = retry.error;
      } catch (err2) {
        if (err2?.message === 'Sign-in timed out') {
          console.warn('[Solicitor Login] signInWithPassword timed out after retry');
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
    console.error('[Solicitor Login] signInWithPassword failed', { message: error.message, status: error.status, code: error.code });
    return { error: error.message, code: error.code };
  }

  const userId = data.user?.id ?? null;
  console.log('[Solicitor Login] Supabase auth OK, fetching profile for user', userId);
  let profile = null;
  if (userId) {
    try {
      let fetchResult = await withTimeout(
        fetchProfileRow(userId),
        PROFILE_FETCH_TIMEOUT_MS,
        'Profile lookup timed out'
      );

      if (fetchResult.error) {
        console.error('[Solicitor Login] profile query failed', fetchResult.error);
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
        const { error: rpcError } = await supabase.rpc('ensure_profile_from_auth');
        if (rpcError) {
          console.warn('[Solicitor Login] ensure_profile_from_auth RPC failed (run latest DB migration if needed):', rpcError);
        } else {
          fetchResult = await fetchProfileRow(userId);
          if (fetchResult.error) {
            console.error('[Solicitor Login] profile query after sync failed', fetchResult.error);
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
      console.warn('[Solicitor Login] getProfile timed out or failed', err);
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
    console.warn('[Solicitor Login] No profile row after auth + sync. Add row in public.profiles or run migration ensure_profile_from_auth.');
    return {
      code: 'no_staff_profile',
      error:
        'Your sign-in worked, but this account is not enabled for staff access yet. Ask your firm administrator to add you to the staff list in the Will Tool.',
      session: data.session ?? null,
      user: data.user ?? null,
      profile: null,
    };
  }
  console.log('[Solicitor Login] signIn success', { role: profile.role, userId });
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
