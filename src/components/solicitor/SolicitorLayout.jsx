import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BriefcaseBusiness, FileEdit, Home, LogOut, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import ThemeToggleButton from '../ThemeToggleButton.jsx';

export default function SolicitorLayout() {
  const { profile, signOut } = useAuth();
  const { isDark } = useTheme();

  const shellClass = isDark
    ? 'min-h-dvh bg-slate-950 text-slate-100 transition-colors'
    : 'min-h-dvh bg-slate-100 text-slate-900 transition-colors';
  const navInactive = isDark
    ? 'bg-slate-800/95 text-slate-200 border-slate-600 hover:border-slate-500 hover:bg-slate-800'
    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300';
  const previewLinkClass = isDark
    ? 'border-slate-600 bg-slate-800/95 text-slate-200 hover:border-indigo-500 hover:bg-slate-800'
    : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-indigo-50/80';

  return (
    <div className={shellClass}>
      <header className="border-b border-slate-200 bg-slate-950 text-white transition-colors">
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <Link to="/solicitor" className="inline-flex items-center gap-2 font-semibold tracking-wide break-words text-left">
              <ShieldCheck size={18} className="shrink-0" />
              <span className="leading-snug">Aristone Solicitors Workspace</span>
            </Link>
            <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-prose">Secure matter management and solicitor-only workflow.</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3 sm:justify-end shrink-0">
            <ThemeToggleButton compact />
            <div className="text-left sm:text-right min-w-0">
              <p className="text-sm font-semibold truncate max-w-[12rem] sm:max-w-none">{profile?.display_name || profile?.email || 'Solicitor'}</p>
              <p className="text-xs uppercase tracking-wide text-slate-400">{profile?.role || 'staff'}</p>
            </div>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 sm:px-4 py-2 text-sm font-medium hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-400 min-h-[44px] min-w-[44px] sm:min-w-0"
            >
              <LogOut size={16} />
              <span className="sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full min-w-0">
        <nav className="mb-4 sm:mb-6 flex flex-wrap gap-2" aria-label="Workspace navigation">
          <NavLink
            to="/solicitor"
            end
            className={({ isActive }) =>
              `inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-medium border transition-colors min-h-[44px] ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : navInactive}`
            }
          >
            <BriefcaseBusiness size={16} className="shrink-0" />
            Matters
          </NavLink>
          <NavLink
            to="/solicitor/questionnaire"
            className={({ isActive }) =>
              `inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl px-3 sm:px-4 py-2.5 text-sm font-medium border transition-colors min-h-[44px] ${isActive ? 'bg-indigo-600 text-white border-indigo-600' : navInactive}`
            }
          >
            <FileEdit size={16} className="shrink-0" />
            <span className="text-center leading-tight">Edit questionnaire</span>
          </NavLink>
          <a
            href="/"
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-xl border px-3 sm:px-4 py-2.5 text-sm font-medium transition-colors min-h-[44px] ${previewLinkClass}`}
          >
            <Home size={16} className="shrink-0" />
            <span className="text-center leading-tight">Client intake (preview)</span>
          </a>
        </nav>

        <Outlet />
      </div>
    </div>
  );
}
