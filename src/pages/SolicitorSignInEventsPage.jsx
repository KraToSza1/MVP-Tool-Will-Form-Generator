import React, { useCallback, useEffect, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { supabase } from '../lib/supabase.js';

function formatWhen(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(iso);
  }
}

export default function SolicitorSignInEventsPage() {
  const { loading: authLoading, canViewSignInSupport } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [loadError, setLoadError] = useState(null);

  const load = useCallback(async () => {
    if (!supabase) {
      setLoadError('Supabase is not configured.');
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await supabase
      .from('sign_in_support_events')
      .select('id,created_at,event_type,attempt_id,payload,origin,pathname,user_agent')
      .order('created_at', { ascending: false })
      .limit(100);
    setLoading(false);
    if (error) {
      console.warn('[SolicitorSignInEventsPage]', error);
      setLoadError(
        error.code === '42P01' || error.message?.includes('does not exist')
          ? 'Table not found — apply the migration `20260506120000_sign_in_support_events.sql` in Supabase SQL Editor, then refresh.'
          : error.message || 'Could not load events',
      );
      setRows([]);
      return;
    }
    setRows(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!canViewSignInSupport) return;
    void load();
  }, [authLoading, canViewSignInSupport, load]);

  const onRefresh = async () => {
    await load();
    toast.success('Refreshed');
  };

  if (!authLoading && !canViewSignInSupport) {
    return <Navigate to="/solicitor" replace />;
  }

  const panelBorder = isDark ? 'border-slate-600' : 'border-slate-200';
  const panelBg = isDark ? 'bg-slate-900' : 'bg-white';
  const textMain = isDark ? 'text-slate-100' : 'text-slate-900';
  const textMuted = isDark ? 'text-slate-400' : 'text-slate-600';
  const cardInner = isDark ? 'border-slate-600 bg-slate-950' : 'border-slate-200 bg-slate-50';

  return (
    <div className="mx-auto max-w-7xl px-3 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link
            to="/solicitor"
            className={`mb-2 inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold ${
              isDark ? 'text-indigo-400 hover:text-indigo-300' : 'text-indigo-700 hover:text-indigo-800'
            }`}
          >
            <ArrowLeft size={16} aria-hidden />
            Back to dashboard
          </Link>
          <h1 className={`flex items-center gap-2 text-xl font-bold sm:text-2xl ${textMain}`}>
            <ClipboardList className="shrink-0" size={26} aria-hidden />
            <span className="wrap-break-word">Sign-in support log</span>
          </h1>
          <p className={`mt-1 max-w-2xl text-sm ${textMuted}`}>
            Failures reported from the solicitor login page (Microsoft OAuth, policy blocks, emergency password sign-in).
            No passwords are stored. Rows appear when staff hit errors and this database migration is applied.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void onRefresh()}
          disabled={loading}
          className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 self-start rounded-xl border px-4 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:cursor-not-allowed disabled:opacity-60 bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700"
        >
          {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <RefreshCw size={18} aria-hidden />}
          Refresh
        </button>
      </div>

      <div className={`rounded-2xl border p-4 sm:p-6 ${panelBorder} ${panelBg}`}>
        {loadError ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              isDark ? 'border-amber-500/40 bg-amber-950/30 text-amber-100' : 'border-amber-200 bg-amber-50 text-amber-950'
            }`}
            role="alert"
          >
            {loadError}
          </div>
        ) : null}

        {!loadError && loading ? (
          <div className={`flex items-center gap-3 py-10 text-sm ${textMuted}`}>
            <Loader2 className="animate-spin" size={22} aria-hidden />
            Loading…
          </div>
        ) : null}

        {!loadError && !loading && rows.length === 0 ? (
          <p className={`text-sm ${textMuted}`}>
            No events yet. Ask someone to try Microsoft sign-in once; OAuth errors here should populate automatically if the migration is deployed.
          </p>
        ) : null}

        {!loadError && !loading && rows.length > 0 ? (
          <>
            {/* Cards: mobile; table xl */}
            <ul className="space-y-3 lg:hidden">
              {rows.map((r) => (
                <li
                  key={r.id}
                  className={`rounded-xl border p-4 ${cardInner} ${panelBorder}`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className={`break-all font-mono text-xs font-semibold ${textMain}`}>{r.event_type}</span>
                    <time className={`shrink-0 text-xs ${textMuted}`} dateTime={r.created_at}>
                      {formatWhen(r.created_at)}
                    </time>
                  </div>
                  {r.attempt_id ? (
                    <p className={`mt-2 break-all text-xs ${textMuted}`}>
                      Attempt: <span className="font-mono text-[11px]">{r.attempt_id}</span>
                    </p>
                  ) : null}
                  <pre
                    className={`mt-2 max-h-40 overflow-auto wrap-break-word rounded-lg border px-3 py-2 text-[11px] leading-relaxed bg-slate-900/05 dark:bg-black/25 ${textMain} dark:border-slate-600`}
                  >
                    {JSON.stringify(r.payload || {}, null, 2)}
                  </pre>
                </li>
              ))}
            </ul>

            <div className={`hidden lg:block overflow-x-auto rounded-xl border ${panelBorder}`}>
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className={`border-b text-xs uppercase tracking-wide ${panelBorder} ${isDark ? 'bg-slate-800 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                  <tr>
                    <th className="px-4 py-3 font-semibold">When</th>
                    <th className="px-4 py-3 font-semibold">Event</th>
                    <th className="px-4 py-3 font-semibold">Attempt</th>
                    <th className="px-4 py-3 font-semibold">Payload</th>
                  </tr>
                </thead>
                <tbody className={isDark ? 'divide-slate-700' : 'divide-slate-200'}>
                  {rows.map((r) => (
                    <tr key={r.id} className={isDark ? 'border-b border-slate-800' : 'border-b border-slate-100'}>
                      <td className={`whitespace-nowrap px-4 py-3 align-top text-xs ${textMuted}`}>{formatWhen(r.created_at)}</td>
                      <td className={`px-4 py-3 align-top font-mono text-xs break-all ${textMain}`}>{r.event_type}</td>
                      <td className={`px-4 py-3 align-top break-all font-mono text-[11px] ${textMuted}`}>
                        {r.attempt_id || '—'}
                      </td>
                      <td className="max-w-xl px-4 py-3 align-top">
                        <pre className={`max-h-36 overflow-auto wrap-break-word text-[11px] ${textMain}`}>
                          {JSON.stringify(r.payload || {}, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
