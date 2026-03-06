import React from 'react';
import { Moon, SunMedium } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggleButton({ compact = false }) {
  const { isDark, toggleTheme } = useTheme();
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
        compact
          ? 'h-11 w-11 border-gray-200 bg-white text-gray-700 hover:bg-indigo-50'
          : 'border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 hover:bg-indigo-50'
      }`}
      aria-label={label}
      title={label}
    >
      {isDark ? <SunMedium size={18} /> : <Moon size={18} />}
      {!compact ? <span>{isDark ? 'Light theme' : 'Dark theme'}</span> : null}
    </button>
  );
}
