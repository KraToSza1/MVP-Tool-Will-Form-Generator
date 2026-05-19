import React, { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  BarChart3,
  BriefcaseBusiness,
  Calendar,
  ClipboardList,
  Clock,
  FileEdit,
  HelpCircle,
  Home,
  LogOut,
  PencilLine,
  RefreshCw,
  Save,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import ThemeToggleButton from '../ThemeToggleButton.jsx';
import { mattersLoadTrace } from '../../lib/mattersLoadTrace.js';
import { listMatters } from '../../lib/matters.js';
import { summarizeUrgentMatters } from '../../lib/matterOutstanding.js';
import { FRESH_CLIENT_INTAKE_URL } from '../../lib/clientIntakeFresh.js';
import { portalFreshStartReload } from '../../lib/portalBrowserFreshStart.js';

function initialsFromName(name) {
  if (!name || typeof name !== 'string') return '—';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '—';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase() || '—';
}

/**
 * Nav links: Aristone mock — dark header uses light grey inactive, solid indigo active (flat on #0f172a).
 */
function navPillLinkClass(isActive, isDark, variant = 'default') {
  const base =
    'inline-flex min-h-[44px] shrink-0 sm:min-h-[44px] items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-all duration-150 sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-0';
  if (isActive) {
    if (variant === 'urgent') {
      return `${base} bg-indigo-600 text-white shadow-sm shadow-indigo-950/30 ring-1 ring-white/10`;
    }
    return `${base} bg-indigo-600 text-white shadow-sm shadow-indigo-950/30 ring-1 ring-indigo-500/30 sm:shadow-md`;
  }
  if (variant === 'urgent') {
    return isDark
      ? `${base} text-slate-200/95 hover:bg-white/[0.08] hover:text-white`
      : `${base} text-slate-600 hover:bg-slate-200/80 hover:text-slate-900`;
  }
  return isDark
    ? `${base} text-slate-200/95 hover:bg-white/[0.08] hover:text-white`
    : `${base} text-slate-600 hover:bg-slate-200/80 hover:text-slate-900`;
}

export default function SolicitorLayout() {
  const { profile, signOut, user, loading: authLoading, updateDisplayName, canViewSignInSupport } = useAuth();
  const location = useLocation();
  const { isDark } = useTheme();
  const [signingOut, setSigningOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [freshStartBusy, setFreshStartBusy] = useState(false);
  const [editingDisplayName, setEditingDisplayName] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [savingDisplayName, setSavingDisplayName] = useState(false);
  const [urgentBadge, setUrgentBadge] = useState(null);
  const profileWrapRef = useRef(null);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    let active = true;
    listMatters(
      { search: '', status: 'all', assignedOnly: false, userId: user.id, sortBy: 'last_activity_at' },
      'solicitor_header_urgent_badge',
    ).then((r) => {
      if (!active) return;
      if (r.error) {
        setUrgentBadge(null);
        return;
      }
      const summary = summarizeUrgentMatters(r.data || []);
      setUrgentBadge(summary);
    });
    return () => {
      active = false;
    };
  }, [authLoading, user?.id, location.pathname]);

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

  useEffect(() => {
    if (!profileOpen) {
      setEditingDisplayName(false);
      setSavingDisplayName(false);
    }
  }, [profileOpen]);

  useEffect(() => {
    setDisplayNameInput(profile?.display_name || profile?.email || '');
  }, [profile?.display_name, profile?.email]);

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

  const handlePortalFreshStart = async () => {
    if (freshStartBusy) return;
    const ok =
      typeof window === 'undefined' ||
      window.confirm(
        'Clear this browser’s saved Will Tool portal data?\n\nYou will be signed out on this device. Light/dark theme is kept.\nUse this after a stuck Microsoft sign-in or odd behaviour.',
      );
    if (!ok) return;
    setFreshStartBusy(true);
    setProfileOpen(false);
    try {
      await portalFreshStartReload({});
    } catch {
      setFreshStartBusy(false);
      toast.error('Could not reload', {
        description: 'Close Safari/Chrome tabs for this site and try again.',
      });
    }
  };

  const handleSaveDisplayName = async () => {
    const next = String(displayNameInput || '').trim();
    if (!next) {
      toast.error('Display name required', { description: 'Please enter a name before saving.' });
      return;
    }
    setSavingDisplayName(true);
    const result = await updateDisplayName(next);
    setSavingDisplayName(false);
    if (result?.error) {
      toast.error('Could not save profile', { description: result.error });
      return;
    }
    setEditingDisplayName(false);
    toast.success('Profile updated', {
      description: 'Your display name is now visible across the solicitor portal.',
    });
  };

  const shellClass = isDark
    ? 'min-h-dvh bg-slate-950 text-slate-100 transition-colors'
    : 'min-h-dvh bg-slate-100 text-slate-900 transition-colors';
  const headerClass = isDark
    ? 'border-b border-slate-700/50 bg-[#0f172a] text-slate-100'
    : 'border-b border-slate-200 bg-white text-slate-900';
  const brandLinkClass = isDark ? 'text-white' : 'text-slate-900';
  const subClass = isDark ? 'text-slate-300/90' : 'text-slate-500';
  const profileDisplay = profile?.display_name || profile?.email || 'Solicitor';
  const profileEmail = profile?.email || '';
  const av = initialsFromName(profileDisplay);

  const previewLinkClass = isDark
    ? 'border border-slate-500/45 bg-white/4 text-slate-200 hover:border-slate-400/55 hover:bg-white/8 hover:text-white'
    : 'border-slate-300/90 bg-white text-slate-800 shadow-sm hover:border-indigo-400/60 hover:bg-indigo-50/90';
  const navPillSurface = isDark
    ? 'rounded-2xl border border-slate-600/50 bg-slate-900/50 p-1 shadow-inner shadow-black/20 ring-1 ring-white/[0.04]'
    : 'rounded-2xl border border-slate-200/90 bg-slate-100/90 p-1 shadow-sm ring-1 ring-slate-900/[0.04]';
  const inPillDivider = isDark ? 'h-8 w-px shrink-0 self-center bg-white/15' : 'h-8 w-px shrink-0 self-center bg-slate-300/80';
  const headerNavRowClass = isDark
    ? 'flex w-full min-w-0 max-w-full flex-nowrap items-center justify-center gap-0 self-center overflow-x-auto overflow-y-hidden overscroll-x-contain p-0 [scrollbar-width:thin] sm:w-auto sm:max-w-none lg:max-w-[min(100%,56rem)]'
    : `${navPillSurface} flex w-full min-w-0 max-w-full flex-nowrap items-center justify-center gap-0 self-center overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:thin] sm:w-auto sm:max-w-none lg:max-w-[min(100%,56rem)]`;

  return (
    <div className={shellClass}>
      <header className={`sticky top-0 z-50 ${headerClass}`}>
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
          <div className="flex min-h-14 flex-col gap-3 py-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
            <div className="min-w-0 shrink-0">
              <Link to="/solicitor" className="block min-w-0">
                <span className={`block font-bold tracking-tight text-lg sm:text-[1.125rem] ${brandLinkClass}`}>
                  Aristone<span className="text-indigo-600 dark:text-indigo-400">.</span>
                </span>
                <span className={`mt-0.5 block text-[11px] font-medium sm:text-xs ${subClass}`}>Solicitor Portal</span>
              </Link>
            </div>

            <nav
              className="order-3 flex w-full min-w-0 flex-1 flex-col items-stretch sm:order-2 sm:items-center lg:min-w-0 lg:flex-1 lg:justify-center"
              aria-label="Portal navigation"
            >
              <div className={headerNavRowClass}>
                <NavLink
                  to="/solicitor"
                  end
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                  title="Dashboard and matters"
                >
                  <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Dashboard</span>
                </NavLink>
                <div className={inPillDivider} aria-hidden="true" />
                <NavLink
                  to="/solicitor/calendar"
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                  title="Calendar (coming soon)"
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Calendar</span>
                </NavLink>
                <div className={inPillDivider} aria-hidden="true" />
                <NavLink
                  to="/solicitor/availability"
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                  title="Availability (coming soon)"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Availability</span>
                </NavLink>
                <div className={inPillDivider} aria-hidden="true" />
                <NavLink
                  to="/solicitor/reports"
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                  title="Reports"
                >
                  <BarChart3 className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Reports</span>
                </NavLink>
                <div className={inPillDivider} aria-hidden="true" />
                <NavLink
                  to="/solicitor/staff"
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                  title="Staff and calendar links"
                >
                  <Users className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Staff</span>
                </NavLink>
                {canViewSignInSupport ? (
                  <>
                    <div className={inPillDivider} aria-hidden="true" />
                    <NavLink
                      to="/solicitor/sign-in-events"
                      className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                      title="Recorded sign-in failures — allowlisted emails only"
                    >
                      <ClipboardList className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                      <span className="whitespace-nowrap">Sign-in log</span>
                    </NavLink>
                  </>
                ) : null}
                <div className={inPillDivider} aria-hidden="true" />
                <NavLink
                  to="/solicitor/urgent"
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'urgent')}
                  title={
                    urgentBadge?.matterCount
                      ? `${urgentBadge.matterCount} client matter(s) with outstanding work (each matter counts once). ${
                          urgentBadge.totalOutstandingItems > urgentBadge.matterCount
                            ? `${urgentBadge.totalOutstandingItems} checklist lines firm-wide.`
                            : ''
                        }${
                          urgentBadge.solicitorWorkflowMatterCount > 0 &&
                          urgentBadge.solicitorWorkflowMatterCount < urgentBadge.matterCount
                            ? ` ${urgentBadge.solicitorWorkflowMatterCount} need solicitor workflow beyond ID upload.`
                            : ''
                        }`
                      : 'Matters with outstanding actions'
                  }
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 opacity-95 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Urgent</span>
                  {urgentBadge != null && urgentBadge.matterCount > 0 ? (
                    <span
                      className="ml-0.5 min-h-4.5 min-w-4.5 shrink-0 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white shadow-sm ring-1 ring-rose-500/30"
                      aria-label={`${urgentBadge.matterCount} urgent ${
                        urgentBadge.matterCount === 1 ? 'matter' : 'matters'
                      }, not ${urgentBadge.totalOutstandingItems} separate checklist items`}
                    >
                      {urgentBadge.matterCount > 99 ? '99+' : urgentBadge.matterCount}
                    </span>
                  ) : null}
                </NavLink>
                <div className={inPillDivider} aria-hidden="true" />
                <NavLink
                  to="/solicitor/questionnaire"
                  className={({ isActive }) => navPillLinkClass(isActive, isDark, 'default')}
                  title="Edit questionnaire schema"
                >
                  <FileEdit className="h-3.5 w-3.5 shrink-0 opacity-90 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Questionnaire</span>
                </NavLink>
                <div className={inPillDivider} aria-hidden="true" />
                <a
                  href={FRESH_CLIENT_INTAKE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Opens client intake with a blank form and a new reference (this device’s old draft is cleared)"
                  className={`inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors sm:min-h-[44px] sm:gap-2 sm:rounded-lg sm:px-2.5 sm:py-2 sm:text-sm ${previewLinkClass}`}
                >
                  <Home className="h-3.5 w-3.5 shrink-0 sm:h-4 sm:w-4" aria-hidden />
                  <span className="whitespace-nowrap">Client intake</span>
                </a>
              </div>
            </nav>

            <div className="order-2 flex flex-wrap items-center justify-end gap-2 sm:order-3 lg:shrink-0">
              <ThemeToggleButton compact />
              <div className="relative" ref={profileWrapRef}>
                <button
                  type="button"
                  onClick={() => setProfileOpen((o) => !o)}
                  className={`flex min-h-[44px] min-w-0 max-w-full items-center gap-2 rounded-xl border px-2 py-1.5 sm:px-3 ${
                    isDark
                      ? 'border-slate-500/50 bg-white/4 text-slate-100 hover:border-slate-400/50 hover:bg-white/8'
                      : 'border-slate-200 bg-slate-50 text-slate-900 hover:bg-slate-100'
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
                    <div className={`border-b px-4 py-3 ${isDark ? 'border-slate-700' : 'border-slate-100'}`}>
                      {!editingDisplayName ? (
                        <button
                          type="button"
                          onClick={() => setEditingDisplayName(true)}
                          className={`inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
                            isDark
                              ? 'border-slate-500 bg-slate-800 text-slate-100 hover:bg-slate-700'
                              : 'border-slate-300 bg-slate-50 text-slate-900 hover:bg-slate-100'
                          }`}
                        >
                          <PencilLine size={16} className="shrink-0" />
                          Edit display name
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <label className={`block text-xs font-semibold ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                            Display name shown to staff
                          </label>
                          <input
                            type="text"
                            value={displayNameInput}
                            onChange={(event) => setDisplayNameInput(event.target.value)}
                            maxLength={80}
                            className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
                              isDark
                                ? 'border-slate-500 bg-slate-800 text-slate-100'
                                : 'border-slate-300 bg-white text-slate-900'
                            }`}
                          />
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={handleSaveDisplayName}
                              disabled={savingDisplayName}
                              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <Save size={15} className="shrink-0" />
                              {savingDisplayName ? 'Saving…' : 'Save name'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingDisplayName(false);
                                setDisplayNameInput(profile?.display_name || profile?.email || '');
                              }}
                              disabled={savingDisplayName}
                              className={`inline-flex min-h-[44px] items-center justify-center rounded-lg border px-3 py-2 text-sm font-semibold ${
                                isDark
                                  ? 'border-slate-500 text-slate-200 hover:bg-slate-800'
                                  : 'border-slate-300 text-slate-700 hover:bg-slate-50'
                              }`}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
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
                      onClick={() => void handlePortalFreshStart()}
                      disabled={freshStartBusy || signingOut}
                      className={`flex w-full min-h-[44px] items-center gap-2 px-4 py-2.5 text-left text-sm disabled:opacity-50 ${
                        isDark ? 'text-slate-200 hover:bg-slate-800' : 'text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <RefreshCw size={16} className={`shrink-0 ${freshStartBusy ? 'animate-spin' : ''}`} />
                      Clear browser data &amp; reload
                    </button>
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
