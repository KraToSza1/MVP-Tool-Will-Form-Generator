/**
 * Structured console logging for questionnaire editor and form definition API.
 * Use VITE_DEBUG_QUESTIONNAIRE=true for full payload objects in logs.
 */
const PREFIX = '[WillTool Questionnaire]';
const FORM_PREFIX = '[WillTool Form]';

export const isQuestionnaireDebug = () => import.meta.env.VITE_DEBUG_QUESTIONNAIRE === 'true';

/** Approximate JSON size for telemetry (not full content). */
export function payloadByteSize(obj) {
  try {
    return new Blob([JSON.stringify(obj ?? {})]).size;
  } catch {
    return 0;
  }
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} [data]
 */
export function qLog(event, data = {}) {
  if (isQuestionnaireDebug()) {
    console.log(PREFIX, event, data);
    return;
  }
  const safe = { ...data };
  if (safe.payload && typeof safe.payload === 'object') {
    safe.payloadBytes = payloadByteSize(safe.payload);
    delete safe.payload;
  }
  if (safe.before && typeof safe.before === 'object') {
    safe.beforeBytes = payloadByteSize(safe.before);
    delete safe.before;
  }
  if (safe.after && typeof safe.after === 'object') {
    safe.afterBytes = payloadByteSize(safe.after);
    delete safe.after;
  }
  console.log(PREFIX, event, safe);
}

export function formLog(event, data = {}) {
  if (isQuestionnaireDebug()) {
    console.log(FORM_PREFIX, event, data);
    return;
  }
  const safe = { ...data };
  if (safe.payload && typeof safe.payload === 'object') {
    safe.payloadBytes = payloadByteSize(safe.payload);
    delete safe.payload;
  }
  console.log(FORM_PREFIX, event, safe);
}
