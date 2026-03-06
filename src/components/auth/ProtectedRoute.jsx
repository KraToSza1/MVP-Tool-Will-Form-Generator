import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute() {
  const { loading, isAuthenticated, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-gray-50 px-4">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-sm px-6 py-5 text-center max-w-md w-full">
          <p className="text-sm font-semibold text-gray-900">Loading solicitor workspace...</p>
          <p className="text-sm text-gray-600 mt-2">Checking your secure session and permissions.</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isStaff) {
    return <Navigate to="/solicitor/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
