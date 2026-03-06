import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LockKeyhole, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import ThemeToggleButton from '../components/ThemeToggleButton.jsx';

export default function SolicitorLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isStaff, loading, signIn } = useAuth();
  const [email, setEmail] = useState('Raymondvdw@gmail.com');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!loading && isAuthenticated && isStaff) {
    const target = location.state?.from?.pathname || '/solicitor';
    return <Navigate to={target} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    const result = await signIn({ email, password });
    setSubmitting(false);

    if (result?.error) {
      toast.error('Sign-in failed', { description: result.error });
      return;
    }

    if (result?.profile?.role !== 'solicitor' && result?.profile?.role !== 'admin') {
      toast.error('Access denied', { description: 'Your account is not provisioned for solicitor access.' });
      return;
    }

    toast.success('Signed in', { description: 'Secure solicitor workspace ready.' });
    navigate(location.state?.from?.pathname || '/solicitor', { replace: true });
  };

  return (
    <div className="min-h-dvh bg-slate-100 flex items-center justify-center px-4">
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-2xl bg-slate-950 text-white px-4 py-3 text-sm font-semibold hover:bg-slate-900 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            {submitting ? 'Signing in...' : 'Sign in securely'}
          </button>
        </form>
      </div>
    </div>
  );
}
