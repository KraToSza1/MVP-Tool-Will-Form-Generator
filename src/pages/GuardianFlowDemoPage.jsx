import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import GuardianFlow from '../components/GuardianFlow.jsx';

/**
 * Standalone preview of Mariyam's GuardianFlow prototype.
 * Not wired into the main questionnaire yet — use to review UX and onComplete payload.
 */
export default function GuardianFlowDemoPage() {
  const onComplete = useCallback((data) => {
    if (import.meta.env.DEV) {
      console.log('[GuardianFlow] onComplete', data);
    }
    toast.success('Guardian flow completed', {
      description: `Option: ${data.guardianOption}. See browser console for full JSON.`,
    });
  }, []);

  return (
    <div className="min-h-dvh w-full bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Link
            to="/"
            className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            ← Back to Will Tool
          </Link>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Dev preview: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">/dev/guardian-flow</code>
          </p>
        </div>
        <GuardianFlow onComplete={onComplete} />
      </div>
    </div>
  );
}
