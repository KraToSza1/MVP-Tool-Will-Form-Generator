/**
 * Client resume-link URL and email copy for solicitors (clipboard only — no send).
 * Secure resume links require both ref and secret (?ref=&s=). Never expose ref-only URLs as working links.
 */

const DEFAULT_SIGN_OFF = 'Aristone Solicitors';

export const RESUME_EMAIL_HELPER_NO_SECRET =
  'A secure resume link cannot be regenerated because the secret is not stored. Ask the client to use their original resume link, or send a new secure link only if the app supports generating one.';

/**
 * @param {{ sessionRef?: string, sessionSecret?: string }} opts
 * @returns {boolean}
 */
export function isSecureResumeUrlAvailable({ sessionRef, sessionSecret }) {
  return Boolean(String(sessionRef || '').trim() && String(sessionSecret || '').trim());
}

/**
 * Full secure resume URL only when ref and secret are both present.
 * @param {{ origin?: string, sessionRef?: string, sessionSecret?: string }} opts
 * @returns {string | null}
 */
export function buildClientResumeUrl({ origin, sessionRef, sessionSecret }) {
  if (!isSecureResumeUrlAvailable({ sessionRef, sessionSecret })) return null;
  const ref = String(sessionRef).trim();
  const secret = String(sessionSecret).trim();
  const base =
    typeof origin === 'string' && origin.trim()
      ? origin.replace(/\/$/, '')
      : typeof window !== 'undefined'
        ? window.location.origin
        : '';
  if (!base) return null;
  const url = new URL('/', base);
  url.searchParams.set('ref', ref);
  url.searchParams.set('s', secret);
  return url.toString();
}

/**
 * Email with a working secure resume link (ref + secret). Do not call without a secure URL.
 * @param {{ clientName?: string, resumeUrl: string, signOff?: string }} opts
 * @returns {string}
 */
export function buildClientResumeEmail({ clientName, resumeUrl, signOff = DEFAULT_SIGN_OFF }) {
  const url = String(resumeUrl || '').trim();
  if (!url || !/[?&]s=/.test(url)) {
    throw new Error('buildClientResumeEmail requires a secure resume URL with secret');
  }
  const name = String(clientName || '').trim() || 'Client';
  return (
    `Dear ${name},\n\n` +
    `Thank you for starting your Will questionnaire with ${signOff}.\n\n` +
    `You can securely continue your questionnaire using the link below:\n\n` +
    `${url}\n\n` +
    `Please do not forward this link to anyone else, as anyone with the link may be able to access or update your draft.\n\n` +
    `Kind regards,\n${signOff}`
  );
}

/**
 * Reference-only email when the secret is unavailable — no resume URL included.
 * @param {{ clientName?: string, clientReference?: string, sessionRef?: string, signOff?: string }} opts
 * @returns {string}
 */
export function buildClientReferenceEmail({
  clientName,
  clientReference,
  sessionRef,
  signOff = DEFAULT_SIGN_OFF,
}) {
  const name = String(clientName || '').trim() || 'Client';
  const refLine =
    String(clientReference || '').trim() ||
    String(sessionRef || '').trim() ||
    'your matter reference';
  return (
    `Dear ${name},\n\n` +
    `Thank you for your Will questionnaire with ${signOff}.\n\n` +
    `Your matter reference is: ${refLine}\n\n` +
    `To continue your questionnaire, please use the secure resume link you saved when you started (the link that was shown in your browser). ` +
    `We cannot send a new working resume link from this screen because the secure part of the link is not stored on our system.\n\n` +
    `If you have lost your link, please reply to this email and we will help you continue securely.\n\n` +
    `Kind regards,\n${signOff}`
  );
}
