/**
 * Gated debug logging for Will Tool (client intake, matters, PDF).
 * Production: off unless VITE_DEBUG_WILL_TOOL=true.
 * Never pass formValues, identity images, signatures, or full payloads here.
 */

export function isWillToolDebugEnabled() {
  if (typeof import.meta !== 'undefined' && import.meta.env?.DEV) return true;
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_DEBUG_WILL_TOOL === 'true') {
    return true;
  }
  if (typeof globalThis !== 'undefined' && globalThis.__WILL_TOOL_DEBUG__ === true) {
    return true;
  }
  return false;
}

/** General debug log (dev / VITE_DEBUG_WILL_TOOL only). */
export function debugLog(...args) {
  if (isWillToolDebugEnabled()) console.log(...args);
}

/** Structured flow log — filter console by [WillTool Flow]. */
export function flowLog(phase, detail) {
  if (!isWillToolDebugEnabled()) return;
  if (detail !== undefined) {
    console.log(`[WillTool Flow] ${phase}`, detail);
  } else {
    console.log(`[WillTool Flow] ${phase}`);
  }
}

export function flowWarn(phase, detail) {
  if (!isWillToolDebugEnabled()) return;
  if (detail !== undefined) {
    console.warn(`[WillTool Flow] ${phase}`, detail);
  } else {
    console.warn(`[WillTool Flow] ${phase}`);
  }
}

/** Safe ref for logs (no secret). */
export function safeRefLog(ref) {
  if (ref == null || ref === '') return '(no ref)';
  const s = String(ref);
  return s.length <= 4 ? s : `${s.slice(0, 2)}…${s.slice(-2)}`;
}
