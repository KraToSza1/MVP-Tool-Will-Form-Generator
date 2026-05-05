import React from 'react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'sonner';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './styles/aristone-guardians.css';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { initBrowserMonitoring } from './monitoring/sentry.js';

/** Warm connection to Supabase API (helps sign-in and data calls, including in embedded iframes). */
function injectSupabasePreconnect() {
  const u = import.meta.env.VITE_SUPABASE_URL;
  if (typeof document === 'undefined' || !u) return;
  try {
    const origin = new URL(u).origin;
    const link = document.createElement('link');
    link.rel = 'preconnect';
    link.href = origin;
    link.crossOrigin = 'anonymous';
    document.head.appendChild(link);
  } catch {
    /* ignore */
  }
}

initBrowserMonitoring();
injectSupabasePreconnect();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Toaster richColors position="top-right" duration={1000} />
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);
