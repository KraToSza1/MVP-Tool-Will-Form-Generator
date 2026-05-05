import React from 'react';
import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggleButton({ compact = false, elevated = false }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  const compactClass = elevated
    ? 'h-11 min-h-[44px] w-11 min-w-[44px] border border-white/20 bg-white/10 text-white shadow-sm backdrop-blur-sm hover:bg-white/15 focus:ring-offset-2 focus:ring-offset-slate-900'
    : 'h-11 min-h-[44px] w-11 min-w-[44px] border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
        compact
          ? compactClass
          : 'border-gray-200 bg-white px-4 py-2.5 text-sm text-slate-700 hover:bg-indigo-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700'
      }`}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunMedium size={18} /> : <Moon size={18} />}
      {!compact ? <span>{isDark ? 'Light theme' : 'Dark theme'}</span> : null}
    </button>
  );
}
