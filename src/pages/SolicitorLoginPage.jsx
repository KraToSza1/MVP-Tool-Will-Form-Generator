import React, { useState, useEffect, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggleButton from '../components/ThemeToggleButton.jsx';
import { isMicrosoftSignInEnabled, startMicrosoft365SignIn } from '../lib/auth.js';

const REMEMBER_EMAIL_KEY = 'solicitor-remember-email';

function getStoredEmail() {
  try {
    return typeof window !== 'undefined' ? window.localStorage.getItem(REMEMBER_EMAIL_KEY) : null;
  } catch {
    return null;
  }
}

export default function SolicitorLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isStaff, loading, signIn, user } = useAuth();
  const [email, setEmail] = useState(() => getStoredEmail() || '');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(() => !!getStoredEmail());
  const [submitting, setSubmitting] = useState(false);
  const [msSigningIn, setMsSigningIn] = useState(false);
  const [adminFixSql, setAdminFixSql] = useState(null);
  const [inIframe, setInIframe] = useState(false);
  const staffDeniedToastRef = useRef(false);
  const oauthReturnHandledRef = useRef(false);

  useEffect(() => {
    setInIframe(typeof window !== 'undefined' && window.self !== window.top);
  }, []);

  /** After OAuth, Supabase may add ?error= / ?code= — log, toast on failure, strip params from URL. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const fromQuery = new URLSearchParams(window.location.search);
    let err = fromQuery.get('error');
    let desc = fromQuery.get('error_description');
    if (!err && window.location.hash && window.location.hash.length > 1) {
      const h = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      err = h.get('error');
      desc = h.get('error_description');
      if (h.get('access_token') || h.get('provider_token')) {
        console.info('[WillTool M365 Auth] return URL: auth fragment present (token exchange path)');
      }
    }
    if (fromQuery.get('code')) {
      console.info('[WillTool M365 Auth] return URL: ?code= present (Supabase will exchange for session)');
    }
    if (err || desc) {
      const decoded = desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : '';
      console.warn('[WillTool M365 Auth] OAuth return error', { error: err, error_description: decoded });
      if (!oauthReturnHandledRef.current) {
        oauthReturnHandledRef.current = true;
        const isExchange = /exchange|external code/i.test(decoded || '');
        toast.error('Microsoft sign-in could not finish', {
          id: 'oauth-return-error',
          description: isExchange
            ? `${decoded || err} — Usually: wrong or expired Client Secret in Supabase (paste a new secret Value from Azure), or Client ID mismatch, or missing “Grant admin consent” on the app’s Microsoft Graph permissions. Check Supabase Dashboard → Logs → Auth for details.`
            : decoded || err || 'Unknown OAuth error',
          duration: 22000,
        });
        const u = new URL(window.location.href);
        u.search = '';
        u.hash = '';
        window.history.replaceState({}, '', `${u.pathname}${u.search}`);
      }
    }
  }, [location.pathname, location.search, location.hash]);

  /** Signed in (e.g. Microsoft) but not in staff list / role */
  useEffect(() => {
    if (loading || staffDeniedToastRef.current) return;
    if (isAuthenticated && user && !isStaff) {
      staffDeniedToastRef.current = true;
      toast.error('Solicitor access not enabled for this sign-in', {
        id: 'solicitor-staff-denied',
        description:
          'Microsoft accepted your sign-in, but this account is not on the staff list for the Will Tool yet. Ask your firm administrator to add your work email, or use email and password if your firm set that up.',
        duration: 16000,
      });
    }
  }, [loading, isAuthenticated, isStaff, user]);

  if (!loading && isAuthenticated && isStaff) {
    const target = location.state?.from?.pathname || '/solicitor';
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    const emailTrimmed = email.trim();
    const uiT0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
    console.log('[WillTool Auth UI] form submit start', {
      email: emailTrimmed ? `${emailTrimmed.slice(0, 2)}***` : '(empty)',
      rememberEmail,
    });
    setSubmitting(true);
    setAdminFixSql(null);
    let result;
    try {
      // Timeouts are handled inside signInSolicitor (can exceed 45s when it retries once + profile fetch).
      result = await signIn({ email: emailTrimmed, password });
      const uiMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - uiT0;
      console.log('[WillTool Auth UI] signIn promise settled', {
        uiTotalMs: Math.round(uiMs),
        hasError: !!result?.error,
        code: result?.code ?? null,
      });
    } catch (err) {
      const uiMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - uiT0;
      console.error('[WillTool Auth UI] signIn threw', err, { uiTotalMs: Math.round(uiMs) });
      const isTimeout = err?.message === 'Sign-in timed out';
      const inIframe = typeof window !== 'undefined' && window.self !== window.top;
      toast.error('Sign-in failed', {
        description: isTimeout
          ? inIframe
            ? 'Sign-in often times out inside an embedded page (e.g. WordPress). Open solicitor login in a new tab using the link below, then sign in there.'
            : 'Request took too long. Try again, or open this page in a new tab. Check your connection.'
          : (err?.message || 'Network or unexpected error. Check the console.'),
        duration: 16000,
      });
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    console.log('[WillTool Auth UI] signIn result (post-try)', {
      hasError: !!result?.error,
      error: result?.error,
      hasProfile: !!result?.profile,
      role: result?.profile?.role,
    });

    if (result?.error) {
      const isNotConfigured = result.error === 'Supabase not configured';
      const isNoProfile =
        result.code === 'no_staff_profile' ||
        result.error.includes('No solicitor profile') ||
        result.error.includes('not in the staff list');
      const isInvalidCreds = (result.code === 'invalid_credentials') || /invalid login|invalid credentials/i.test(result.error || '');
      let description = result.error;
      if (isNotConfigured) {
        description = import.meta.env.DEV
          ? 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the dev server (npm run dev).'
          : 'This site is not fully configured. Please contact technical support.';
      } else if (isNoProfile) {
        description =
          'Your email and password were accepted, but this account is not set up for staff access yet. Please contact your firm administrator so they can enable your account.';
        if (import.meta.env.DEV) {
          const sql = `INSERT INTO public.profiles (id, email, display_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'display_name', split_part(COALESCE(email,''), '@', 1)), 'admin'
FROM auth.users WHERE email = ${emailTrimmed ? `'${emailTrimmed.replace(/'/g, "''")}'` : "'YOUR_EMAIL@example.com'"}
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;`;
          setAdminFixSql(sql);
        }
      } else if (isInvalidCreds) {
        description = 'Wrong email or password. Check your credentials and try again.';
      }
      toast.error('Unable to open staff workspace', { description, duration: 14000 });
      return;
    }

    if (result?.profile?.role !== 'solicitor' && result?.profile?.role !== 'admin') {
      toast.error('Access not enabled', {
        description:
          'This account does not have solicitor access. Ask your firm administrator to assign you the correct role in the staff list.',
        duration: 12000,
      });
      return;
    }

    if (rememberEmail && emailTrimmed) {
      try {
        window.localStorage.setItem(REMEMBER_EMAIL_KEY, emailTrimmed);
      } catch {
        /* ignore */
      }
    } else {
      try {
        window.localStorage.removeItem(REMEMBER_EMAIL_KEY);
      } catch {
        /* ignore */
      }
    }

    toast.success('Signed in', { description: 'Secure solicitor workspace ready.' });
    navigate(location.state?.from?.pathname || '/solicitor', { replace: true });
  };

  const directLoginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/solicitor/login` : '/solicitor/login';

  const handleMicrosoftSignIn = async () => {
    if (inIframe) {
      toast.error('Open in a full browser tab', {
        description: 'Microsoft sign-in usually does not work inside an embedded page. Use “Open solicitor login in new tab” first, then try again.',
        duration: 12000,
      });
      return;
    }
    setMsSigningIn(true);
    const result = await startMicrosoft365SignIn();
    setMsSigningIn(false);
    if (result?.error) {
      console.warn('[WillTool M365 Auth] start failed (stayed on this page)', { error: result.error });
      toast.error('Could not start Microsoft 365 sign-in', {
        description: result.error,
        duration: 14000,
      });
    } else if (result?.ok) {
      console.info('[WillTool M365 Auth] browser navigating away to Microsoft/Supabase (if you see this, redirect was quick)');
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center bg-slate-100 px-4 py-6 dark:bg-slate-950">
      <div className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="absolute right-4 top-4">
          <ThemeToggleButton compact />
        </div>
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded-lg px-1"
          >
            <ArrowLeft size={16} />
            Back to Will Tool
          </Link>
        </div>
        <div className="text-center mb-8">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-slate-950 text-white flex items-center justify-center mb-4">
            <LockKeyhole size={24} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Solicitor sign in</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Use your Aristone Solicitors account to access client matters and solicitor-only workflow.
          </p>
        </div>

        {inIframe && (
          <div
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="region"
            aria-label="Embedded sign-in notice"
          >
            <p className="font-semibold text-amber-900">Using the Will Tool inside your website?</p>
            <p className="mt-1 text-amber-800/95">
              You can sign in here — same login as a full tab. Some browsers slow down or block embedded pages; if sign-in spins too long or times out, open the link below and sign in there (same account).
            </p>
            <a
              href={directLoginUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-amber-800 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-900 focus:outline-none focus:ring-2 focus:ring-amber-600"
            >
              <ExternalLink size={16} aria-hidden />
              Open solicitor login in new tab
            </a>
          </div>
        )}

        {isMicrosoftSignInEnabled() && (
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={handleMicrosoftSignIn}
              disabled={msSigningIn || submitting}
              className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center" aria-hidden>
                <svg viewBox="0 0 23 23" className="h-6 w-6" role="img" aria-label="Microsoft">
                  <path fill="#f35325" d="M1 1h10v10H1z" />
                  <path fill="#81bc06" d="M12 1h10v10H12z" />
                  <path fill="#05a6f0" d="M1 12h10v10H1z" />
                  <path fill="#ffba08" d="M12 12h10v10H12z" />
                </svg>
              </span>
              {msSigningIn ? 'Redirecting to Microsoft…' : 'Continue with Microsoft 365'}
            </button>
            <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Sign in with your work email. If your firm uses 2FA, Microsoft will send the code to you or your IT
              process — nothing extra to &quot;approve&quot; in the Will Tool.
            </p>
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 top-1/2 h-px bg-slate-200 dark:bg-slate-600" aria-hidden />
              <span className="relative z-10 bg-white px-3 text-xs font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                or use email
              </span>
            </div>
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block">
            <span className="text-sm font-medium text-slate-700">Email address</span>
            <div className="mt-2 relative">
              <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-slate-300 px-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="name@aristonesolicitors.co.uk"
              />
            </div>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Enter your password"
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberEmail}
              onChange={(e) => setRememberEmail(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span className="text-sm text-slate-700">Remember my email on this device</span>
          </label>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-slate-950 text-white px-4 py-3 text-sm font-semibold hover:bg-slate-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {submitting ? 'Signing in...' : 'Sign in securely'}
          </button>
        </form>

        {import.meta.env.DEV && adminFixSql && (
          <div className="solicitor-login-fix-box mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Developer: add profile in Supabase</p>
            <p className="mt-1 text-xs text-amber-800">Local dev only — Supabase → SQL Editor → paste and Run, then sign in again.</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-amber-100/80 p-3 text-xs text-amber-950 whitespace-pre font-mono">
              {adminFixSql}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(adminFixSql);
                    toast.success('SQL copied', { description: 'Paste in Supabase SQL Editor (dev only).' });
                  } catch {
                    toast.error('Copy failed');
                  }
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-3 py-2 text-sm font-medium text-white hover:bg-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <Copy size={14} />
                Copy SQL
              </button>
              <button
                type="button"
                onClick={() => setAdminFixSql(null)}
                className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
