import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ExternalLink, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggleButton from '../components/ThemeToggleButton.jsx';
import {
  SOLICITOR_LOGIN_PATH,
  SOLICITOR_ADMIN_OVERRIDE_EMAIL,
  SOLICITOR_ALLOWED_EMAIL_DOMAIN,
  isMicrosoftSignInEnabled,
  startMicrosoft365SignIn,
} from '../lib/auth.js';
import { POST_CALENDAR_CONNECT_RETURN_KEY } from '../lib/staffCalendar.js';

function takePostCalendarConnectReturnPath() {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.sessionStorage.getItem(POST_CALENDAR_CONNECT_RETURN_KEY);
    if (!value) return null;
    window.sessionStorage.removeItem(POST_CALENDAR_CONNECT_RETURN_KEY);
    return value.startsWith('/solicitor') ? value : null;
  } catch {
    return null;
  }
}

export default function SolicitorLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isStaff, loading, user, signIn } = useAuth();
  const [msSigningIn, setMsSigningIn] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const staffDeniedToastRef = useRef(false);
  const oauthReturnHandledRef = useRef(false);
  const ownerMode = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const v = (q.get('owner') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }, [location.search]);

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
          `Use a Microsoft 365 account on @${SOLICITOR_ALLOWED_EMAIL_DOMAIN} that is on the solicitor staff list.`,
        duration: 16000,
      });
    }
  }, [loading, isAuthenticated, isStaff, user]);

  if (!loading && isAuthenticated && isStaff) {
    const target = takePostCalendarConnectReturnPath() || location.state?.from?.pathname || '/solicitor';
    return <Navigate to={target} replace />;
  }

  const directLoginUrl =
    typeof window !== 'undefined' ? `${window.location.origin}${SOLICITOR_LOGIN_PATH}` : SOLICITOR_LOGIN_PATH;

  const handleMicrosoftSignIn = async () => {
    if (inIframe) {
      toast('Open in a full browser tab', {
        id: 'embedded-m365-open-tab',
        description: 'Use "Open solicitor login in new tab" below, then continue with Microsoft 365 there.',
        duration: 7000,
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

  const handleAdminFallbackSignIn = async (event) => {
    event.preventDefault();
    const email = String(adminEmail || '').trim().toLowerCase();
    const isOverrideEmail = email === SOLICITOR_ADMIN_OVERRIDE_EMAIL;
    const isFirmDomainEmail = email.endsWith(`@${SOLICITOR_ALLOWED_EMAIL_DOMAIN}`);
    if (!isOverrideEmail && !isFirmDomainEmail) {
      toast.error('Owner login restricted', {
        description: `Use the configured owner account or an admin @${SOLICITOR_ALLOWED_EMAIL_DOMAIN} address.`,
      });
      return;
    }
    if (!adminPassword) {
      toast.error('Password required', { description: 'Enter your owner account password.' });
      return;
    }
    setAdminSubmitting(true);
    const result = await signIn({ email, password: adminPassword });
    setAdminSubmitting(false);
    if (result?.error) {
      toast.error('Owner sign-in failed', { description: result.error });
      return;
    }
    setAdminPassword('');
    toast.success('Signed in', { description: 'Owner access granted.' });
    navigate(location.state?.from?.pathname || '/solicitor', { replace: true });
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
              disabled={msSigningIn}
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
              Sign in with your work Microsoft account. If your firm uses 2FA, Microsoft will send the code to you or
              your IT process — nothing extra to &quot;approve&quot; in the Will Tool.
            </p>
          </div>
        )}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 dark:border-indigo-500/40 dark:bg-indigo-950/30 dark:text-indigo-100">
          <p className="font-semibold">Sign-in policy</p>
          <p className="mt-1 wrap-break-word">
            Solicitor access is Microsoft 365 only and must use <strong>@{SOLICITOR_ALLOWED_EMAIL_DOMAIN}</strong>.
          </p>
        </div>
        {ownerMode ? (
          <form onSubmit={handleAdminFallbackSignIn} className="mt-4 rounded-xl border border-slate-300 bg-slate-50 p-4 dark:border-slate-600 dark:bg-slate-800/60">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Owner access</p>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              Hidden owner-only login mode for emergency access.
            </p>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Owner email</span>
              <input
                type="email"
                value={adminEmail}
                onChange={(event) => setAdminEmail(event.target.value)}
                required
                placeholder="Enter owner email"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <label className="mt-3 block">
              <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Owner password</span>
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-500 dark:bg-slate-900 dark:text-slate-100"
              />
            </label>
            <button
              type="submit"
              disabled={adminSubmitting || msSigningIn}
              className="mt-3 inline-flex min-h-[44px] w-full items-center justify-center rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-indigo-600 dark:hover:bg-indigo-700"
            >
              {adminSubmitting ? 'Signing in…' : 'Sign in as owner'}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
