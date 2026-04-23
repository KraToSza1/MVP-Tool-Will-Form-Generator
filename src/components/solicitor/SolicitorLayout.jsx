import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  Clock,
  FileEdit,
  HelpCircle,
  Home,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import ThemeToggleButton from '../ThemeToggleButton.jsx';
import { mattersLoadTrace } from '../../lib/mattersLoadTrace.js';

function initialsFromName(name) {
  if (!name || typeof name !== 'string') return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase() || '—';
}

/** Primary links inside the nav pill (dark / light). */
function navPillLinkClass(isActive, isDark, variant = 'default') {
  const base =
    'inline-flex min-h-[40px] sm:min-h-[42px] items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-0';
  if (isActive) {
    if (variant === 'urgent') {
      return `${base} bg-amber-500/25 text-amber-100 ring-1 ring-amber-400/40 dark:bg-amber-500/20 dark:text-amber-50`;
    }
    return `${base} bg-indigo-600 text-white shadow-md shadow-indigo-950/25 ring-1 ring-white/10 dark:shadow-indigo-950/40`;
  }
  if (variant === 'urgent') {
    return isDark
      ? `${base} text-amber-200/90 hover:bg-slate-800/90 hover:text-amber-100`
      : `${base} text-amber-800 hover:bg-amber-50/90`;
  }
  return isDark
    ? `${base} text-slate-300 hover:bg-slate-800/80 hover:text-white`
    : `${base} text-slate-600 hover:bg-slate-200/80 hover:text-slate-900`;
}

export default function SolicitorLayout() {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const { isDark } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileWrapRef = useRef(null);

  useEffect(() => {
    mattersLoadTrace('SolicitorLayout mounted / route changed', {
      pathname: location.pathname,
    });
  }, [location.pathname]);

  useEffect(() => {
    if (!profileOpen) return;
    const onDoc = (e) => {
      if (profileWrapRef.current && !profileWrapRef.current.contains(e.target)) {
        setProfileOpen(false);
      }
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [profileOpen]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setProfileOpen(false);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  };

  const shellClass = isDark
    ? 'min-h-dvh bg-slate-950 text-slate-100 transition-colors'
    : 'min-h-dvh bg-slate-100 text-slate-900 transition-colors';
  const headerClass = isDark
    ? 'border-b border-slate-800 bg-[#0f172a] text-slate-100'
    : 'border-b border-slate-200 bg-white text-slate-900';
  const brandLinkClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const subClass = isDark ? 'text-slate-400' : 'text-slate-500';
  const profileDisplay = profile?.display_name || profile?.email || 'Solicitor';
  const profileEmail = profile?.email || '';
  const av = initialsFromName(profileDisplay);

  const previewLinkClass = isDark
    ? 'border-slate-500/50 bg-slate-800/80 text-slate-100 ring-1 ring-white/5 hover:border-indigo-400/50 hover:bg-slate-800 hover:ring-indigo-400/20'
    : 'border-slate-300/90 bg-white text-slate-800 shadow-sm hover:border-indigo-400/60 hover:bg-indigo-50/90';
  const navPillSurface = isDark
    ? 'rounded-2xl border border-slate-600/50 bg-slate-900/50 p-1 shadow-inner shadow-black/20 ring-1 ring-white/[0.04]'
    : 'rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-sm ring-1 ring-slate-900/[0.04]';
  const navDivider = isDark ? 'hidden h-9 w-px shrink-0 bg-slate-600/70 sm:block' : 'hidden h-9 w-px shrink-0 bg-slate-300/80 sm:block';

  return (
    <div className={shellClass}>
      <header className={`sticky top-0 z-50 ${headerClass}`}>
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-14 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 shrink-0">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                <Link
                  to="/solicitor"
                  className={`font-bold tracking-tight text-lg sm:text-[1.125rem] ${brandLinkClass}`}
                >
                  Aristone<span className="text-indigo-500 dark:text-indigo-400">.</span>
                </Link>
                <span
                  className={`rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] ${isDark ? 'border-slate-600/80 bg-slate-800/50 text-slate-400' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                >
                  Portal
                </span>
              </div>
              <p className={`mt-0.5 text-[11px] font-medium sm:text-xs ${subClass}`}>Solicitor workspace</p>
            </div>

            <nav
              className="order-3 flex w-full min-w-0 flex-1 flex-col items-stretch gap-2.5 sm:order-2 sm:items-center lg:justify-center"
              aria-label="Portal navigation"
            >
              <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-center sm:gap-3">
                <div
                  className={`${navPillSurface} flex w-full min-w-0 flex-wrap items-center justify-center gap-0.5 sm:justify-start`}
                >
                  <NavLink
                    to="/solicitor"
                    end
                    className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                    title="Dashboard and matters"
                  >
                    <BriefcaseBusiness size={16} className="shrink-0 opacity-90" aria-hidden />
                    <span className="whitespace-nowrap">Dashboard</span>
                  </NavLink>
                  <NavLink
                    to="/solicitor/calendar"
                    className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                    title="Calendar (coming soon)"
                  >
                    <Calendar size={16} className="shrink-0 opacity-90" aria-hidden />
                    <span className="whitespace-nowrap">Calendar</span>
                  </NavLink>
                  <NavLink
                    to="/solicitor/availability"
                    className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                    title="Availability (coming soon)"
                  >
                    <Clock size={16} className="shrink-0 opacity-90" aria-hidden />
                    <span className="whitespace-nowrap">Availability</span>
                  </NavLink>
                  <NavLink
                    to="/solicitor/reports"
                    className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                    title="Reports (coming soon)"
                  >
                    <BarChart3 size={16} className="shrink-0 opacity-90" aria-hidden />
                    <span className="whitespace-nowrap">Reports</span>
                  </NavLink>
                  <NavLink
                    to="/solicitor/urgent"
                    className={({ isActive }) => navPillLinkClass(isActive, isDark, 'urgent')}
                    title="Matters with outstanding actions"
                  >
                    <AlertTriangle size={16} className="shrink-0 opacity-95" aria-hidden />
                    <span className="whitespace-nowrap">Urgent</span>
                  </NavLink>
                </div>

                <div className={navDivider} aria-hidden="true" />

                <div className="flex w-full min-w-0 flex-wrap items-center justify-center gap-1.5 sm:w-auto sm:justify-end">
                  <NavLink
                    to="/solicitor/questionnaire"
                    className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                    title="Edit questionnaire schema"
                  >
                    <FileEdit size={16} className="shrink-0 opacity-90" aria-hidden />
                    <span className="whitespace-nowrap">Questionnaire</span>
                  </NavLink>
                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-flex min-h-[44px] w-full min-w-0 max-w-full items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors sm:w-auto sm:max-w-none ${previewLinkClass}`}
                  >
                    <Home size={16} className="shrink-0" aria-hidden />
                    <span className="whitespace-nowrap">Client intake</span>
                  </a>
                </div>
              </div>
            </nav>

            <div className="order-2 flex flex-wrap items-center justify-end gap-2 sm:order-3 lg:shrink-0">
              <ThemeToggleButton compact />
              <div className="relative" ref={profileWrapRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className={`flex min-h-[44px] min-w-0 max-w-full items-center gap-2 rounded-xl border px-2 py-1.5 sm:px-3 ${
                    isDark ? 'border-slate-600 bg-slate-900/50 hover:bg-slate-800' : 'border-slate-200 bg-slate-50 hover:bg-slate-100'
                  } focus:outline-none focus:ring-2 focus:ring-indigo-400`}
                  aria-expanded={profileOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-indigo-500/40 bg-indigo-100 text-xs font-bold text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200"
                    aria-hidden
                  >
                    {av}
                  </span>
                  <span className="hidden min-w-0 sm:block text-left text-sm">
                    <span className="block max-w-40 truncate font-medium lg:max-w-56">{profileDisplay}</span>
                    {profile?.role ? (
                      <span className="block max-w-40 truncate text-xs uppercase tracking-wide text-slate-500 lg:max-w-56">
                        {profile.role}
                      </span>
                    ) : null}
                  </span>
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    className={`absolute right-0 z-200 mt-2 w-[min(100vw-1.5rem,280px)] overflow-hidden rounded-xl border shadow-2xl ${
                      isDark
                        ? 'border-slate-600 bg-slate-900 ring-1 ring-white/5'
                        : 'border-slate-200 bg-white ring-1 ring-black/5'
                    }`}
                  >
                    <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                      <p className={`text-sm font-semibold wrap-break-word ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
                        {profileDisplay}
                      </p>
                      {profileEmail ? (
                        <p className={`mt-0.5 text-xs break-all ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                          {profileEmail}
                        </p>
                      ) : null}
                    </div>
                    <a
                      href="mailto:it@aristone.co.uk?subject=Will%20Tool%20Solicitor%20Portal%20—%20help"
                      className={`flex w-full min-h-[44px] items-center gap-2 px-4 py-2.5 text-left text-sm ${
                        isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                      onClick={() => setProfileOpen(false)}
                    >
                      <HelpCircle size={16} className={`shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      Help &amp; support
                    </a>
                    <Link
                      to="/solicitor/questionnaire"
                      className={`flex min-h-[44px] items-center gap-2 px-4 py-2.5 text-sm ${
                        isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                      onClick={() => setProfileOpen(false)}
                    >
                      <FileEdit size={16} className={`shrink-0 ${isDark ? 'text-slate-400' : 'text-slate-500'}`} />
                      Edit questionnaire
                    </Link>
                    <div className={`my-1 h-px ${isDark ? 'bg-slate-700' : 'bg-slate-200'}`} />
                    <button
                      type="button"
                      onClick={handleSignOut}
                      disabled={signingOut}
                      className={`flex w-full min-h-[44px] items-center gap-2 px-4 py-2.5 text-left text-sm font-medium disabled:opacity-50 ${
                        isDark ? 'text-rose-300 hover:bg-rose-950/50' : 'text-rose-700 hover:bg-rose-50'
                      }`}
                    >
                      <LogOut size={16} className="shrink-0" />
                      {signingOut ? 'Signing out…' : 'Sign out'}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
        <p className={`border-t px-3 py-1.5 text-center text-xs sm:px-6 sm:text-left ${isDark ? 'border-slate-800 text-slate-500' : 'border-slate-100 text-slate-500'}`}>
          <span className="hidden sm:inline">Secure matter management and Will Tool continuation.</span>
          <span className="sm:hidden">Secure workspace</span>
        </p>
      </header>

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full min-w-0">
        <Outlet />
      </div>
    </div>
  );
}
