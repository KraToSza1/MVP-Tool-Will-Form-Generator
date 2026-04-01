/**
 * Shared console traces for the solicitor matters list pipeline (auth → route → Supabase).
 * Filter the console by: WillTool Matters Load
 */

export const MATTERS_LOAD_TAG = '[WillTool Matters Load]';

export function mattersLoadTrace(phase, detail = {}) {
  const perfMs = typeof performance !== 'undefined' ? Math.round(performance.now()) : 0;
  console.log(MATTERS_LOAD_TAG, phase, { ...detail, perfMs });
}
