/**
 * Completion rules for guided Business Interests (biz_* intake fields).
 * Legacy saves may lack biz_* — FormRenderer may treat those via migration / old keys separately.
 */

function trim(v) {
  if (v == null) return '';
  return String(v).trim();
}

function separateBizTrusteeComplete(fv) {
  const fn = trim(fv?.businessSeparateTrusteeFirstName);
  const ln = trim(fv?.businessSeparateTrusteeLastName);
  const a1 = trim(fv?.businessSeparateTrusteeAddress1);
  const town = trim(fv?.businessSeparateTrusteeTown);
  const pc = trim(fv?.businessSeparateTrusteePostcode);
  return !!(fn && ln && a1 && town && pc);
}

/**
 * @param {Record<string, unknown>} formValues
 * @returns {boolean}
 */
export function isBusinessInterestsGuidedComplete(formValues) {
  if (!formValues || typeof formValues !== 'object') return false;

  const biz = formValues.biz_has_interests;
  if (biz === 'no') return true;

  const disclosed =
    biz === 'yes' ||
    biz === 'unsure' ||
    (formValues.hasBusinessInterests === 'Yes' && (biz == null || biz === ''));

  if (!disclosed) return true;

  if (biz == null || biz === '') {
    const intent = formValues.bprTrustClientIntent;
    return intent === 'Yes' || intent === 'No' || intent === 'Unsure';
  }

  const req = [
    formValues.biz_type,
    formValues.biz_ownership_pct,
    formValues.biz_ownership_sole,
    formValues.biz_duration,
    formValues.biz_value,
    formValues.biz_agreement,
    formValues.biz_nature,
    formValues.biz_trustees_continue,
    formValues.biz_beneficiaries,
    formValues.biz_separate_trustee,
    formValues.biz_fallback,
  ];
  if (!req.every((x) => trim(x) !== '')) return false;

  if (formValues.biz_separate_trustee === 'yes' && !separateBizTrusteeComplete(formValues)) {
    return false;
  }

  return true;
}
