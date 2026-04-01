import React, { useEffect, useState } from 'react';
import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { mattersLoadTrace } from '../../lib/mattersLoadTrace.js';

const FALLBACK_DELAY_MS = 6000;

export default function ProtectedRoute() {
  const { loading, isAuthenticated, isStaff } = useAuth();
  const location = useLocation();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setShowFallback(true), FALLBACK_DELAY_MS);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    mattersLoadTrace('ProtectedRoute', {
      path: location.pathname,
      authLoading: loading,
      isAuthenticated,
      isStaff,
      rendersOutlet: !loading && isAuthenticated && isStaff,
      note: loading
        ? 'Blocking — showing "Loading solicitor workspace" (dashboard / matters list not mounted).'
        : !isAuthenticated || !isStaff
          ? 'Redirecting to login.'
          : 'Rendering solicitor routes (e.g. dashboard — may show "Loading matters…").',
    });
  }, [loading, isAuthenticated, isStaff, location.pathname]);

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5 text-center max-w-md w-full">
          <p className="text-sm font-semibold text-gray-900">Loading solicitor workspace...</p>
          <p className="text-sm text-gray-600 mt-2">Checking your secure session and permissions.</p>
          {showFallback && (
            <p className="mt-4 text-sm text-slate-600">
              Taking too long?{' '}
              <Link to="/solicitor/login" state={{ from: location }} className="font-medium text-indigo-600 hover:text-indigo-700">
                Sign in again
              </Link>
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return <Navigate to="/solicitor/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
