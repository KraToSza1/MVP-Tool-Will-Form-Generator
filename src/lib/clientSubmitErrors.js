import { ARISTONE_PROFILE } from '../constants/aristoneSolicitors.js';

/** Shown to clients when their answers could not reach Aristone (offline, server down, timeout). */
export const CLIENT_SUBMIT_UNREACHABLE_MESSAGE =
  `We couldn't send your answers to ${ARISTONE_PROFILE.firmName} just now. ` +
  'Your answers are still saved on this device, so nothing is lost. ' +
  'Please check your internet connection and press Submit again in a few minutes. ' +
  `If it keeps happening, call ${ARISTONE_PROFILE.primaryOffice.phoneFormatted} or email ${ARISTONE_PROFILE.email}.`;

const NETWORKISH_PATTERNS = [
  /failed to fetch/i,
  /networkerror/i,
  /network request failed/i,
  /load failed/i, // Safari
  /err_name_not_resolved/i,
  /err_internet_disconnected/i,
  /timed? ?out/i,
  /timeout/i,
  /fetch failed/i,
];

/** True when an error message looks like a connectivity/server-reachability problem rather than a validation error. */
export function isNetworkishError(error) {
  const msg = typeof error === 'string' ? error : error?.message || '';
  if (!msg) return false;
  return NETWORKISH_PATTERNS.some((re) => re.test(msg));
}
