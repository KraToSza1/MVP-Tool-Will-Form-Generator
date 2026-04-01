import { createContext } from 'react';

/**
 * Stable context identity for HMR: keep `createContext` out of `AuthContext.jsx`.
 * If the provider file hot-reloads, Vite must not recreate this object or consumers
 * (e.g. ProtectedRoute) will see "useAuth must be used within AuthProvider".
 */
export const AuthContext = createContext(null);
