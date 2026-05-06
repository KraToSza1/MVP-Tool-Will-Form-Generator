import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggleButton from '../components/ThemeToggleButton.jsx';
import {
  beginMicrosoftSignInAttempt,
  buildAuthDiagnosticBundle,
  copyAuthDiagnosticsToClipboard,
  getCurrentSignInAttemptId,
  pushAuthDiagnosticEvent,
} from '../lib/authDiagnostics.js';
import {
  SOLICITOR_LOGIN_PATH,
  SOLICITOR_ADMIN_OVERRIDE_EMAIL,
  SOLICITOR_ALLOWED_EMAIL_DOMAIN,
  isMicrosoftSignInEnabled,
  startMicrosoft365SignIn,
} from '../lib/auth.js';
import { captureAuthSupportEvent } from '../monitoring/sentry.js';
import { POST_CALENDAR_CONNECT_RETURN_KEY } from '../lib/staffCalendar.js';
import { portalFreshStartReload } from '../lib/portalBrowserFreshStart.js';

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
  const [portalFreshBusy, setPortalFreshBusy] = useState(false);
  const [inIframe, setInIframe] = useState(false);
  const staffDeniedToastRef = useRef(false);
  const oauthReturnHandledRef = useRef(false);
  const oauthCodeNotedRef = useRef(false);
  const msEnabled = useMemo(() => isMicrosoftSignInEnabled(), []);

  const showSupportDebug = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const v = (q.get('support') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }, [location.search]);

  const ownerMode = useMemo(() => {
    const q = new URLSearchParams(location.search);
    const v = (q.get('owner') || '').toLowerCase();
    return v === '1' || v === 'true' || v === 'yes';
  }, [location.search]);

  const [ownerPanelVisible, setOwnerPanelVisible] = useState(() => ownerMode || !msEnabled);

  useEffect(() => {
    if (ownerMode || !msEnabled) {
      setOwnerPanelVisible(true);
    }
  }, [ownerMode, msEnabled]);

  useEffect(() => {
    setInIframe(typeof window !== 'undefined' && window.self !== window.top);
  }, []);

  /** After “Clear browser data & reload” — show confirmation and drop query param. */
  useEffect(() => {
    const q = new URLSearchParams(location.search);
    if (q.get('portal_cleared') !== '1') return;
    toast.success('Browser data cleared', {
      id: 'portal-fresh-cleared',
      description: 'You can sign in again with Microsoft 365 or emergency access.',
      duration: 9000,
    });
    const u = new URL(window.location.href);
    u.searchParams.delete('portal_cleared');
    const rest = u.searchParams.toString();
    window.history.replaceState({}, '', `${u.pathname}${rest ? `?${rest}` : ''}`);
  }, [location.search, location.pathname]);

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
      if (!oauthCodeNotedRef.current) {
        oauthCodeNotedRef.current = true;
        pushAuthDiagnosticEvent({
          type: 'oauth_return_code_present',
          hint: 'supabase_exchange_pending',
        });
      }
    }
    if (err || desc) {
      const decoded = desc ? decodeURIComponent(desc.replace(/\+/g, ' ')) : '';
      console.warn('[WillTool M365 Auth] OAuth return error', { error: err, error_description: decoded });
      if (!oauthReturnHandledRef.current) {
        oauthReturnHandledRef.current = true;
        pushAuthDiagnosticEvent({
          type: 'oauth_return_error',
          oauthErrorParam: err || null,
          errorDescriptionPreview: (decoded || '').slice(0, 500),
        });
        captureAuthSupportEvent('oauth_return', 'Microsoft OAuth return error', {
          oauthErrorParam: err,
          descriptionPreview: (decoded || '').slice(0, 320),
        });
        const isExchange = /exchange|external code/i.test(decoded || '');
        const lay =
          'You did not do anything wrong and you do not need to use any menus or diagnostics. Someone with administrator access should fix this—it can be checked from their side. If they ask when it happened, say roughly what time this message appeared (no technical steps needed from you).';
        const tech = isExchange
          ? `Technical (for admins): Usually wrong or expired Microsoft client secret in Supabase (paste a fresh Value from Azure), or Client ID mismatch, or missing “Grant admin consent” on Microsoft Graph. Check Supabase Dashboard → Logs → Auth for the precise error — same timeframe as staff’s attempt is enough (no screenshots required from staff). Original message: ${decoded || err}`
          : `Details: ${decoded || err || 'Unknown OAuth error'}`;
        toast.error('Microsoft sign-in could not finish', {
          id: 'oauth-return-error',
          description: `${lay}\n\n${tech}`,
          duration: 26000,
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
      pushAuthDiagnosticEvent({
        type: 'solicitor_staff_denied',
        hint: 'signed_in_user_not_on_staff_list',
      });
      captureAuthSupportEvent('policy', 'User signed in but solicitor staff access denied', {});
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

  const openOwnerUrl = `${SOLICITOR_LOGIN_PATH}?owner=1`;

  const handleMicrosoftSignIn = async () => {
    if (inIframe) {
      toast('Open in a full browser tab', {
        id: 'embedded-m365-open-tab',
        description: 'Use "Open solicitor login in new tab" below, then continue with Microsoft 365 there.',
        duration: 7000,
      });
      return;
    }
    beginMicrosoftSignInAttempt();
    setMsSigningIn(true);
    const result = await startMicrosoft365SignIn();
    setMsSigningIn(false);
    if (result?.error) {
      console.warn('[WillTool M365 Auth] start failed (stayed on this page)', { error: result.error });
      captureAuthSupportEvent('m365_start', 'Could not start Microsoft 365 sign-in', { message: result.error });
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
      pushAuthDiagnosticEvent({
        type: 'owner_password_sign_in_failed',
        supabaseAuthCode: result.code ?? null,
      });
      captureAuthSupportEvent('owner_sign_in', 'Owner password sign-in failed', {
        message: String(result.error).slice(0, 200),
        code: result.code ?? null,
      });
      toast.error('Owner sign-in failed', { description: result.error });
      return;
    }
    setAdminPassword('');
    toast.success('Signed in', { description: 'Owner access granted.' });
    navigate(location.state?.from?.pathname || '/solicitor', { replace: true });
  };

  const handleCopySignInDiagnostics = async () => {
    const copied = await copyAuthDiagnosticsToClipboard();
    const refId = getCurrentSignInAttemptId();
    if (copied) {
      toast.success('Diagnostics copied', {
        description:
          refId && refId !== 'unknown'
            ? `Send this paste to IT. Attempt reference: ${refId} — match approximate time in Supabase → Logs → Auth.`
            : 'Send this paste to IT — match approximate time in Supabase → Logs → Auth.',
        duration: 12000,
      });
    } else {
      toast.error('Could not copy', {
        description: 'Allow clipboard access for this site, or add ?support=1 to the URL to view diagnostics on screen.',
      });
    }
  };

  const handleForgotPasswordClick = () => {
    toast.message('Forgot password?', {
      description:
        'Solicitors and staff reset their password through Microsoft 365 or your IT team. Emergency owner accounts: contact your system administrator.',
      duration: 10000,
    });
  };

  const handleLoginPortalFreshStart = async () => {
    if (portalFreshBusy || msSigningIn || adminSubmitting) return;
    if (
      typeof window !== 'undefined' &&
      !window.confirm(
        'Remove saved Will Tool data in this browser and reload?\n\nUse if Microsoft sign-in loops or looks stuck. Light/dark theme stays the same.',
      )
    ) {
      return;
    }
    setPortalFreshBusy(true);
    try {
      await portalFreshStartReload({});
    } catch {
      setPortalFreshBusy(false);
      toast.error('Could not clear browser data', {
        description:
          'Try Safari or Chrome settings → clear website data for this site, then open the login page again.',
        duration: 14000,
      });
    }
  };

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center bg-slate-900 px-4 py-8 text-slate-900 dark:bg-neutral-950">
      <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-indigo-950/25 to-transparent dark:from-indigo-950/40" aria-hidden />
      <div className="absolute right-4 top-4 z-20">
        <ThemeToggleButton compact elevated />
      </div>

      <div className="relative z-10 w-full max-w-[420px] min-w-0">
        <div className="mb-5">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center gap-2 rounded-lg px-1 text-sm font-medium text-slate-300 hover:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-slate-900 dark:text-slate-400 dark:hover:text-slate-100 dark:focus:ring-offset-neutral-950"
          >
            <ArrowLeft size={16} className="shrink-0" aria-hidden />
            <span className="wrap-break-word">Back to Will Tool</span>
          </Link>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-6 py-9 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:px-10 sm:py-10">
          <p className="mb-1 text-[28px] font-bold leading-tight tracking-tight text-slate-900 dark:text-slate-100">
            Aristone<em className="not-italic text-indigo-600 dark:text-indigo-400">.</em>
          </p>
          <p className="mb-8 text-[13px] text-slate-600 dark:text-slate-400">
            Solicitor Portal <span className="text-slate-400 dark:text-slate-500">&middot;</span> Sign in to continue
          </p>

          {inIframe && (
            <div
              className="mb-6 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3 text-left text-sm text-amber-100"
              role="region"
              aria-label="Embedded sign-in notice"
            >
              <p className="font-semibold text-amber-50">Using the Will Tool inside your website?</p>
              <p className="mt-1 text-amber-100/90">
                You can sign in here — same login as a full tab. Some browsers slow down or block embedded pages; if
                sign-in spins too long or times out, open the link below and sign in there (same account).
              </p>
              <a
                href={directLoginUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                <ExternalLink size={16} aria-hidden />
                Open solicitor login in new tab
              </a>
            </div>
          )}

          {msEnabled ? (
            <div className="space-y-3 text-left">
              <button
                type="button"
                onClick={handleMicrosoftSignIn}
                disabled={msSigningIn}
                className="flex w-full min-h-[48px] items-center justify-center gap-3 rounded-lg border-[1.5px] border-slate-300 bg-white px-5 py-3 text-[14px] font-semibold text-slate-900 shadow-sm transition hover:border-blue-600 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-indigo-400 dark:hover:bg-slate-700"
              >
                <svg className="h-5 w-5 shrink-0" viewBox="0 0 21 21" fill="none" aria-hidden>
                  <rect width="10" height="10" fill="#f25022" />
                  <rect x="11" width="10" height="10" fill="#7fba00" />
                  <rect y="11" width="10" height="10" fill="#00a4ef" />
                  <rect x="11" y="11" width="10" height="10" fill="#ffb900" />
                </svg>
                <span>{msSigningIn ? 'Redirecting to Microsoft…' : 'Sign in with Microsoft 365'}</span>
              </button>
              <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                Sign in with your work Microsoft account. If your firm uses 2FA, Microsoft will prompt you — nothing extra
                to approve in this portal.
              </p>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-500/35 bg-amber-950/20 px-3 py-2 text-center text-xs text-amber-100 dark:border-amber-500/40">
              Microsoft sign-in is turned off for this deployment. Use owner email and password below.
            </div>
          )}

          {msEnabled && (
            <>
              <div className="my-5 flex items-center gap-3">
                <span className="h-px min-w-0 flex-1 bg-slate-200 dark:bg-slate-600" aria-hidden />
                <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">or use email &amp; password</span>
                <span className="h-px min-w-0 flex-1 bg-slate-200 dark:bg-slate-600" aria-hidden />
              </div>

              {ownerPanelVisible ? (
                <form onSubmit={handleAdminFallbackSignIn} className="space-y-3 text-left">
                  <label className="block" htmlFor="solicitor-owner-email">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">Work email</span>
                    <input
                      id="solicitor-owner-email"
                      type="email"
                      value={adminEmail}
                      onChange={(event) => setAdminEmail(event.target.value)}
                      required
                      autoComplete="username"
                      placeholder={`you@${SOLICITOR_ALLOWED_EMAIL_DOMAIN}`}
                      className="w-full min-w-0 rounded-lg border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <label className="block" htmlFor="solicitor-owner-password">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">Password</span>
                    <input
                      id="solicitor-owner-password"
                      type="password"
                      value={adminPassword}
                      onChange={(event) => setAdminPassword(event.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="••••••••"
                      className="w-full min-w-0 rounded-lg border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={adminSubmitting || msSigningIn}
                    className="w-full min-h-[48px] rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-900"
                  >
                    {adminSubmitting ? 'Signing in…' : 'Sign in'}
                  </button>
                  <button
                    type="button"
                    onClick={handleForgotPasswordClick}
                    className="mx-auto mt-1 block min-h-[44px] w-full text-center text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
                  >
                    Forgot password?
                  </button>
                  <p className="text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                    Owner and emergency access only.{' '}
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      Solicitor access is Microsoft 365 and must use @{SOLICITOR_ALLOWED_EMAIL_DOMAIN}.
                    </span>
                  </p>
                </form>
              ) : (
                <div className="space-y-3 text-center">
                  <p className="text-left text-sm text-slate-600 dark:text-slate-300">
                    Day-to-day solicitor access is <strong className="font-semibold text-slate-800 dark:text-slate-100">Microsoft 365 only</strong>
                    {' '}( @{SOLICITOR_ALLOWED_EMAIL_DOMAIN} ).
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerPanelVisible(true);
                      navigate(openOwnerUrl, { replace: false });
                    }}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Emergency owner sign-in (email &amp; password)
                  </button>
                </div>
              )}
            </>
          )}

          {!msEnabled && (
            <form onSubmit={handleAdminFallbackSignIn} className="mt-2 space-y-3 text-left">
              <label className="block" htmlFor="solicitor-owner-email-disabled-ms">
                <span className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">Work email</span>
                <input
                  id="solicitor-owner-email-disabled-ms"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                  required
                  autoComplete="username"
                  placeholder={`you@${SOLICITOR_ALLOWED_EMAIL_DOMAIN}`}
                  className="w-full min-w-0 rounded-lg border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <label className="block" htmlFor="solicitor-owner-password-disabled-ms">
                <span className="mb-1.5 block text-xs font-semibold text-slate-800 dark:text-slate-200">Password</span>
                <input
                  id="solicitor-owner-password-disabled-ms"
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full min-w-0 rounded-lg border-[1.5px] border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-600 focus:ring-[3px] focus:ring-indigo-500/15 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100"
                />
              </label>
              <button
                type="submit"
                disabled={adminSubmitting}
                className="w-full min-h-[48px] rounded-lg border border-indigo-600 bg-indigo-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
              >
                {adminSubmitting ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}

          <div className="mt-6 border-t border-slate-200 pt-5 text-left dark:border-slate-600">
            <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Trouble signing in?</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              After a failed attempt, tap the button below. It copies a short technical summary{' '}
              <span className="font-medium text-slate-600 dark:text-slate-300">without your password</span>.
              Send it to your administrator — they align it with Supabase Dashboard → Logs → Auth (filtered by time).
              Works on Mac, iPhone Safari, and other browsers if clipboard permission is allowed.
            </p>
            <button
              type="button"
              onClick={() => void handleCopySignInDiagnostics()}
              className="mt-3 inline-flex min-h-[44px] w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
            >
              <Copy size={16} className="shrink-0" aria-hidden />
              Copy sign-in diagnostics for support
            </button>
            <button
              type="button"
              onClick={() => void handleLoginPortalFreshStart()}
              disabled={portalFreshBusy || msSigningIn || adminSubmitting}
              className="mt-2 inline-flex min-h-[44px] w-full flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-55 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} className={`shrink-0 ${portalFreshBusy ? 'animate-spin' : ''}`} aria-hidden />
              Clear saved browser data &amp; reload sign-in page
            </button>
            <p className="mt-2 text-[10px] leading-relaxed text-slate-400 dark:text-slate-500">
              Clears cached sign-in and site storage on{' '}
              <span className="font-medium text-slate-500 dark:text-slate-400">this phone or Mac only</span>. Does not
              change cloud settings.
            </p>
            <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
              Tip: add <span className="wrap-break-word font-mono text-slate-500 dark:text-slate-400">{SOLICITOR_LOGIN_PATH}?support=1</span> to this page URL to preview the diagnostic JSON on screen.
            </p>
            {showSupportDebug ? (
              <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-slate-300 bg-slate-50 p-3 text-[10px] leading-snug wrap-break-word text-slate-800 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200">
                {JSON.stringify(buildAuthDiagnosticBundle(), null, 2)}
              </pre>
            ) : null}
          </div>

          <p className="mt-6 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
            Aristone Solicitors uses Microsoft 365 for secure authentication.
            <br />
            Your data is protected in accordance with our Privacy Policy and UK GDPR. Solicitor access must use{' '}
            <span className="break-all font-medium text-slate-600 dark:text-slate-300">@{SOLICITOR_ALLOWED_EMAIL_DOMAIN}</span>.
          </p>
        </div>
      </div>
    </div>
  );
}
