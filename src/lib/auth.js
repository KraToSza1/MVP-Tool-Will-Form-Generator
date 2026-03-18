import { supabase, isSupabaseConfigured } from './supabase.js';

async function getProfile(userId) {
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.error('[auth] getProfile error:', error);
    return null;
  }

  return data;
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

function withTimeout(promise, ms, message = 'Sign-in timed out') {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

export async function signInSolicitor({ email, password }) {
  console.log('[Solicitor Login] signIn attempt', { email, hasPassword: !!password, supabaseConfigured: isSupabaseConfigured() });

  if (!isSupabaseConfigured()) {
    console.warn('[Solicitor Login] Supabase not configured – check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
    return { error: 'Supabase not configured' };
  }

  let data, error;
  try {
    const result = await withTimeout(
      supabase.auth.signInWithPassword({ email, password }),
      SIGN_IN_TIMEOUT_MS
    );
    data = result.data;
    error = result.error;
  } catch (err) {
    if (err?.message === 'Sign-in timed out') {
      console.warn('[Solicitor Login] signInWithPassword timed out – Supabase may be stuck (e.g. lock). Refresh and try again.');
      return { error: 'Sign-in timed out. Refresh the page and try again.' };
    }
    throw err;
  }

  if (error) {
    console.error('[Solicitor Login] signInWithPassword failed', { message: error.message, status: error.status, code: error.code });
    return { error: error.message, code: error.code };
  }

  const userId = data.user?.id ?? null;
  console.log('[Solicitor Login] Supabase auth OK, fetching profile for user', userId);
  const profile = userId ? await getProfile(userId) : null;
  if (!profile) {
    console.warn('[Solicitor Login] No profile row found for this user. In Supabase: create a row in public.profiles for this user and set role = \'solicitor\'.');
    return {
      error: 'No solicitor profile. Your account is not in the staff list. Ask an admin to add you in Supabase (profiles table, role = solicitor).',
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
