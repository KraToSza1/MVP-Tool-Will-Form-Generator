import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { signInSolicitor, signOutSolicitor, subscribeToAuthChanges } from '../lib/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const gotInitial = useRef(false);

  useEffect(() => {
    let active = true;
    const FALLBACK_MS = 6_000;

    const unsubscribe = subscribeToAuthChanges((result) => {
      if (!active) return;
      gotInitial.current = true;
      setSession(result.session ?? null);
      setUser(result.user ?? null);
      setProfile(result.profile ?? null);
      setLoading(false);
    });

    const fallback = setTimeout(() => {
      if (!active) return;
      if (!gotInitial.current) {
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
    signOut: signOutSolicitor,
  }), [loading, profile, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
