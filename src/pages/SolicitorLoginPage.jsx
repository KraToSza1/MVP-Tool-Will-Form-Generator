import React, { useState, useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, Copy, ExternalLink, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggleButton from '../components/ThemeToggleButton.jsx';

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
  const { isAuthenticated, isStaff, loading, signIn } = useAuth();
  const [email, setEmail] = useState(() => getStoredEmail() || '');
  const [password, setPassword] = useState('');
  const [rememberEmail, setRememberEmail] = useState(() => !!getStoredEmail());
  const [submitting, setSubmitting] = useState(false);
  const [adminFixSql, setAdminFixSql] = useState(null);
  const [inIframe, setInIframe] = useState(false);

  useEffect(() => {
    setInIframe(typeof window !== 'undefined' && window.self !== window.top);
  }, []);

  if (!loading && isAuthenticated && isStaff) {
    const target = location.state?.from?.pathname || '/solicitor';
    return <Navigate to={target} replace />;
  }

  const SIGN_IN_TIMEOUT_MS = 48_000;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const emailTrimmed = email.trim();
    setSubmitting(true);
    setAdminFixSql(null);
    let result;
    try {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Sign-in timed out')), SIGN_IN_TIMEOUT_MS);
      });
      result = await Promise.race([signIn({ email: emailTrimmed, password }), timeoutPromise]);
    } catch (err) {
      console.error('[Solicitor Login] signIn threw', err);
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
    console.log('[Solicitor Login] signIn returned', { hasError: !!result?.error, error: result?.error, hasProfile: !!result?.profile, role: result?.profile?.role });

    if (result?.error) {
      const isNotConfigured = result.error === 'Supabase not configured';
      const isNoProfile = result.error.includes('No solicitor profile') || result.error.includes('not in the staff list');
      const isInvalidCreds = (result.code === 'invalid_credentials') || /invalid login|invalid credentials/i.test(result.error || '');
      let description = result.error;
      if (isNotConfigured) {
        description = 'Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env, then restart the dev server (npm run dev).';
      } else if (isNoProfile) {
        const sql = `INSERT INTO public.profiles (id, email, display_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'display_name', split_part(COALESCE(email,''), '@', 1)), 'admin'
FROM auth.users WHERE email = ${emailTrimmed ? `'${emailTrimmed.replace(/'/g, "''")}'` : "'YOUR_EMAIL@example.com'"}
ON CONFLICT (id) DO UPDATE SET role = 'admin', email = EXCLUDED.email;`;
        setAdminFixSql(sql);
        description = "You're in Auth but not in the staff list. Run the SQL below in Supabase → SQL Editor, then sign in again.";
      } else if (isInvalidCreds) {
        description = 'Wrong email or password. Check your credentials and try again.';
      }
      toast.error('Sign-in failed', { description, duration: 12000 });
      return;
    }

    if (result?.profile?.role !== 'solicitor' && result?.profile?.role !== 'admin') {
      toast.error('Access denied', { description: 'Your account is not provisioned for solicitor access. Ask an admin to set your role in Supabase (profiles.role = solicitor or admin).' });
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

  return (
    <div className="min-h-dvh bg-slate-100 flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white shadow-xl p-8 relative">
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
          <h1 className="text-2xl font-bold text-slate-900">Solicitor sign in</h1>
          <p className="text-sm text-slate-600 mt-2">
            Use your Aristone Solicitors account to access client matters and solicitor-only workflow.
          </p>
        </div>

        {inIframe && (
          <div
            className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
            role="region"
            aria-label="Embedded sign-in notice"
          >
            <p className="font-semibold text-amber-900">Signing in from an embedded page?</p>
            <p className="mt-1 text-amber-800/95">
              Browsers often block or delay login when the Will Tool runs inside WordPress. Use the same email and password in a{' '}
              <strong>new tab</strong> — that usually fixes timeouts.
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

        {adminFixSql && (
          <div className="solicitor-login-fix-box mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-semibold text-amber-900">Add yourself as admin</p>
            <p className="mt-1 text-xs text-amber-800">Supabase → SQL Editor → paste and Run, then sign in again.</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-amber-100/80 p-3 text-xs text-amber-950 whitespace-pre font-mono">
              {adminFixSql}
            </pre>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(adminFixSql);
                    toast.success('SQL copied', { description: 'Paste it in Supabase SQL Editor and run it.' });
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
