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
  if (!isSupabaseConfigured()) return { session: null, user: null, profile: null };

  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.error('[auth] getSession error:', error);
    return { session: null, user: null, profile: null, error: error.message };
  }

  const session = data.session ?? null;
  const user = session?.user ?? null;
  const profile = user ? await getProfile(user.id) : null;

  return { session, user, profile };
}

export async function signInSolicitor({ email, password }) {
  if (!isSupabaseConfigured()) {
    return { error: 'Supabase not configured' };
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message };
  }

  const profile = data.user ? await getProfile(data.user.id) : null;
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
