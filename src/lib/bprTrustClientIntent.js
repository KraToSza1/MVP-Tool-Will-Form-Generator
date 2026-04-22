/**
 * Business Property Relief (BPR) trust — client intent (guided intake) vs solicitor completion.
 * Solicitor-facing field IDs stay: bprTrustDetails, bprTrustScheduleNumber, bprTrustTerms (PDF / clauses).
 */

export function getBprTrustClientIntent(formValues) {
  if (!formValues || typeof formValues !== 'object') return '';
  const v = formValues.bprTrustClientIntent;
  if (v === 'Yes' || v === 'No' || v === 'Unsure') return v;
  if (formValues.includeBPRTrust === 'Yes' || formValues.includeBPRTrust === true) return 'Yes';
  return '';
}

export function isBprSolicitorPackageComplete(formValues) {
  const d = String(formValues?.bprTrustDetails ?? '').trim();
  const s = String(formValues?.bprTrustScheduleNumber ?? '').trim();
  const t = String(formValues?.bprTrustTerms ?? '').trim();
  return Boolean(d && s && t);
}
