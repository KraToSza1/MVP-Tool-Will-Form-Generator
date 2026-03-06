import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getCurrentSession, signInSolicitor, signOutSolicitor, subscribeToAuthChanges } from '../lib/auth.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    getCurrentSession().then((result) => {
      if (!active) return;
      setSession(result.session ?? null);
      setUser(result.user ?? null);
      setProfile(result.profile ?? null);
      setLoading(false);
    });

    const unsubscribe = subscribeToAuthChanges((result) => {
      if (!active) return;
      setSession(result.session ?? null);
      setUser(result.user ?? null);
      setProfile(result.profile ?? null);
      setLoading(false);
    });

    return () => {
      active = false;
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
