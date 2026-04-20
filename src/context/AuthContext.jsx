/* eslint-disable react-refresh/only-export-components -- provider + hook pattern */
import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { signInSolicitor, signOutSolicitor, subscribeToAuthChanges } from '../lib/auth.js';
import { AuthContext } from './authContext.js';
import { mattersLoadTrace } from '../lib/mattersLoadTrace.js';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const gotInitial = useRef(false);
  const authBootT0 = useRef(typeof performance !== 'undefined' ? performance.now() : 0);

  useEffect(() => {
    mattersLoadTrace('AuthProvider snapshot', {
      authLoading: loading,
      hasSession: !!session?.user,
      userIdPrefix: session?.user?.id ? `${String(session.user.id).slice(0, 8)}…` : null,
      profileRole: profile?.role ?? null,
      isStaff: profile?.role === 'solicitor' || profile?.role === 'admin',
      note: loading
        ? 'While true, ProtectedRoute shows "Loading solicitor workspace" and dashboard does not mount.'
        : 'Auth settled — dashboard can mount and run listMatters.',
    });
  }, [loading, session?.user, profile?.role]);

  /** Clear UI session immediately; then revoke Supabase tokens (listener may also fire). */
  const signOut = useCallback(async () => {
    setSession(null);
    setUser(null);
    setProfile(null);
    setLoading(false);
    try {
      const result = await signOutSolicitor();
      if (import.meta.env.DEV && result?.error) {
        console.warn('[WillTool Auth UI] signOut server warning:', result.error);
      }
    } catch (err) {
      console.error('[WillTool Auth UI] signOut failed', err);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const FALLBACK_MS = 6_000;

    const unsubscribe = subscribeToAuthChanges((result) => {
      if (!active) return;
      gotInitial.current = true;
      const sinceBootMs =
        authBootT0.current && typeof performance !== 'undefined'
          ? Math.round(performance.now() - authBootT0.current)
          : null;
      mattersLoadTrace('onAuthStateChange → session/profile applied', {
        hasSession: !!result?.session,
        hasUser: !!result?.user,
        hasProfile: !!result?.profile,
        role: result?.profile?.role ?? null,
        sinceBootMs,
      });
      if (import.meta.env.DEV) {
        console.log('[WillTool Auth UI] AuthProvider: onAuthStateChange callback', {
          hasSession: !!result?.session,
          hasUser: !!result?.user,
          hasProfile: !!result?.profile,
          role: result?.profile?.role ?? null,
        });
      }
      setSession(result.session ?? null);
      setUser(result.user ?? null);
      setProfile(result.profile ?? null);
      setLoading(false);
    });

    const fallback = setTimeout(() => {
      if (!active) return;
      if (!gotInitial.current) {
        mattersLoadTrace('Auth 6s fallback — no auth event yet (clearing loading)', {
          hint: 'Check [WillTool Auth] logs if sign-in hangs',
        });
        console.warn('[WillTool Auth UI] AuthProvider: 6s fallback — no auth event yet, clearing loading (initial load only)', {
          hint: 'If sign-in hangs, check [WillTool Auth] logs for step 1/4 (Supabase password request)',
        });
        setSession(null);
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }, FALLBACK_MS);

    return () => {
      active = false;
      clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  const value = useMemo(() => ({
    session,
    user,
    profile,
    loading,
    isAuthenticated: !!session?.user,
    isStaff: profile?.role === 'solicitor' || profile?.role === 'admin',
    signIn: signInSolicitor,
    signOut,
  }), [loading, profile, session, signOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
