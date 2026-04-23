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

function navClass(isActive, isDark) {
  return `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
    isActive
      ? 'bg-indigo-600/90 text-white'
      : isDark
        ? 'text-slate-200 hover:bg-slate-800/80'
        : 'text-slate-700 hover:bg-slate-100'
  }`;
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
    ? 'border-slate-600 bg-slate-800/95 text-slate-200 hover:border-indigo-500 hover:bg-slate-800'
    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/80';

  return (
    <div className={shellClass}>
      <header className={`sticky top-0 z-50 ${headerClass}`}>
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-14 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <Link
                to="/solicitor"
                className={`font-bold tracking-tight text-lg sm:text-[1.125rem] ${brandLinkClass}`}
              >
                Aristone<span className="text-indigo-500 dark:text-indigo-400">.</span>
              </Link>
              <span className={`text-xs font-medium uppercase tracking-wider ${subClass}`}>Solicitor Portal</span>
            </div>

            <nav
              className="order-3 flex w-full min-w-0 flex-wrap items-center gap-1 sm:order-2 sm:w-auto lg:max-w-3xl"
              aria-label="Portal navigation"
            >
              <NavLink to="/solicitor" end className={({ isActive }) => navClass(isActive, isDark)} title="Dashboard & matters">
                <BriefcaseBusiness size={16} className="shrink-0 opacity-90" aria-hidden />
                <span>Dashboard</span>
              </NavLink>
              <NavLink
                to="/solicitor/calendar"
                className={({ isActive }) => navClass(isActive, isDark)}
                title="Calendar (coming soon)"
              >
                <Calendar size={16} className="shrink-0 opacity-90" aria-hidden />
                <span>Calendar</span>
              </NavLink>
              <NavLink
                to="/solicitor/availability"
                className={({ isActive }) => navClass(isActive, isDark)}
                title="Availability (coming soon)"
              >
                <Clock size={16} className="shrink-0 opacity-90" aria-hidden />
                <span>Availability</span>
              </NavLink>
              <NavLink
                to="/solicitor/reports"
                className={({ isActive }) => navClass(isActive, isDark)}
                title="Reports (coming soon)"
              >
                <BarChart3 size={16} className="shrink-0 opacity-90" aria-hidden />
                <span>Reports</span>
              </NavLink>
              <NavLink
                to="/solicitor/urgent"
                className={({ isActive }) => navClass(isActive, isDark)}
                title="Matters with outstanding actions"
              >
                <AlertTriangle size={16} className="shrink-0 text-amber-400" aria-hidden />
                <span>Urgent</span>
              </NavLink>
              <NavLink
                to="/solicitor/questionnaire"
                className={({ isActive }) => navClass(isActive, isDark)}
                title="Edit questionnaire schema"
              >
                <FileEdit size={16} className="shrink-0 opacity-90" aria-hidden />
                <span>Questionnaire</span>
              </NavLink>
              <a
                href="/"
                target="_blank"
                rel="noopener noreferrer"
                className={`inline-flex min-h-[44px] w-full min-w-0 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors sm:w-auto ${previewLinkClass}`}
              >
                <Home size={16} className="shrink-0" aria-hidden />
                <span className="text-center">Client intake</span>
              </a>
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
                    <span className="block max-w-[10rem] truncate font-medium lg:max-w-[14rem]">{profileDisplay}</span>
                    {profile?.role ? (
                      <span className="block max-w-[10rem] truncate text-xs uppercase tracking-wide text-slate-500 lg:max-w-[14rem]">
                        {profile.role}
                      </span>
                    ) : null}
                  </span>
                </button>
                {profileOpen ? (
                  <div
                    role="menu"
                    className={`absolute right-0 z-[200] mt-2 w-[min(100vw-1.5rem,280px)] overflow-hidden rounded-xl border shadow-2xl ${
                      isDark
                        ? 'border-slate-600 bg-slate-900 ring-1 ring-white/5'
                        : 'border-slate-200 bg-white ring-1 ring-black/5'
                    }`}
                  >
                    <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                      <p className={`text-sm font-semibold break-words ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>
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
