/**
 * Property trust — client intent (guided intake) vs solicitor completion.
 * Solicitor field IDs: propertyTrustDetails, propertyTrustScheduleNumber, propertyTrustTerms.
 */

export function getPropertyTrustClientIntent(formValues) {
  if (!formValues || typeof formValues !== 'object') return '';
  const v = formValues.includePropertyTrust;
  if (v === 'Yes' || v === 'No' || v === 'Unsure') return v;
  return '';
}

export function isPropertyTrustSolicitorPackageComplete(formValues) {
  const d = String(formValues?.propertyTrustDetails ?? '').trim();
  const s = String(formValues?.propertyTrustScheduleNumber ?? '').trim();
  const t = String(formValues?.propertyTrustTerms ?? '').trim();
  return Boolean(d && s && t);
}
