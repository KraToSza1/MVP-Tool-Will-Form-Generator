/**
 * Completion + validation for guided Property Trust (client intake).
 */

function trim(s) {
  if (s == null) return '';
  return String(s).trim();
}

/** @param {unknown} raw */
export function normalizePtReason(raw) {
  if (Array.isArray(raw)) return raw.map((x) => trim(x)).filter(Boolean);
  if (raw == null || raw === '') return [];
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p.map((x) => trim(x)).filter(Boolean);
    } catch {
      /* ignore */
    }
    return raw
      .split(/[,;]+/)
      .map((x) => trim(x))
      .filter(Boolean);
  }
  return [];
}

/**
 * @param {Record<string, unknown>} formValues
 * @returns {boolean}
 */
export function isPropertyTrustGuidedComplete(formValues) {
  if (!formValues || typeof formValues !== 'object') return true;
  const inc = formValues.includePropertyTrust;
  if (inc !== 'Yes' && inc !== 'Unsure') return true;

  const typeOk = trim(formValues.propertyTrustType) !== '';
  const fn = trim(formValues.propertyTrustLifeTenantFirstName);
  const ln = trim(formValues.propertyTrustLifeTenantLastName);
  const lifeOk = fn !== '' && ln !== '';
  const props = formValues.propertyTrustPropertiesList;
  const hasProps = Array.isArray(props) && props.length > 0;

  const tenureOk = trim(formValues.pt_tenure) !== '';
  const shareOk = trim(formValues.pt_ownership_share) !== '';
  const rightsOk = trim(formValues.pt_life_tenant_rights) !== '';
  const saleOk = trim(formValues.pt_sale_instruction) !== '';
  const remainderOk = trim(formValues.pt_remainder_beneficiaries) !== '';
  const overOk = trim(formValues.pt_overreaching) !== '';
  const reasons = normalizePtReason(formValues.pt_reason);
  const reasonsOk = reasons.length > 0;

  return (
    typeOk
    && lifeOk
    && hasProps
    && tenureOk
    && shareOk
    && rightsOk
    && saleOk
    && remainderOk
    && overOk
    && reasonsOk
  );
}

/**
 * @param {Record<string, unknown>} formValues
 * @param {string} fieldId
 * @returns {{ fieldLabel: string, message: string, type: string }[]}
 */
export function getPropertyTrustGuidedValidationIssues(formValues, fieldId) {
  const issues = [];
  const inc = formValues?.includePropertyTrust;
  if (inc !== 'Yes' && inc !== 'Unsure') return issues;

  const fieldLabel = 'Property trust';

  if (trim(formValues.propertyTrustType) === '') {
    issues.push({
      fieldLabel,
      message:
        'Choose the type of property trust that fits best, or select that you would like your solicitor to advise.',
      type: 'required',
    });
  }

  const fn = trim(formValues.propertyTrustLifeTenantFirstName);
  const ln = trim(formValues.propertyTrustLifeTenantLastName);
  if (!fn || !ln) {
    issues.push({
      fieldLabel,
      message:
        'Enter the life tenant’s first and last name (the person who will benefit during their lifetime), or pick someone already entered on the form.',
      type: 'required',
    });
  }

  const props = formValues.propertyTrustPropertiesList;
  if (!Array.isArray(props) || props.length === 0) {
    issues.push({
      fieldLabel,
      message:
        'Add at least one property address to go into the trust, or change your answer if you no longer want a property trust.',
      type: 'required',
    });
  }

  if (trim(formValues.pt_tenure) === '') {
    issues.push({
      fieldLabel,
      message: 'Say whether the main trust property is freehold, leasehold, or not sure — your solicitor needs this for the title.',
      type: 'required',
    });
  }

  if (trim(formValues.pt_ownership_share) === '') {
    issues.push({
      fieldLabel,
      message: 'Choose the option that best describes what share of the property you own (sole owner, tenants in common, joint tenants, or not sure).',
      type: 'required',
    });
  }

  if (trim(formValues.pt_life_tenant_rights) === '') {
    issues.push({
      fieldLabel,
      message: 'Choose what rights the life tenant should have over the property (or select that you will discuss with your solicitor).',
      type: 'required',
    });
  }

  if (trim(formValues.pt_sale_instruction) === '') {
    issues.push({
      fieldLabel,
      message: 'Choose what should happen if the life tenant wants to sell or move (or select that your solicitor should advise).',
      type: 'required',
    });
  }

  if (trim(formValues.pt_remainder_beneficiaries) === '') {
    issues.push({
      fieldLabel,
      message: 'Say who should inherit after the life tenant dies — children, named people, residue, or discuss at your appointment.',
      type: 'required',
    });
  }

  if (trim(formValues.pt_overreaching) === '') {
    issues.push({
      fieldLabel,
      message: 'Choose whether to include standard overreaching protection for a future sale (or ask your solicitor to advise).',
      type: 'required',
    });
  }

  if (normalizePtReason(formValues.pt_reason).length === 0) {
    issues.push({
      fieldLabel,
      message: 'Select at least one reason you want a property trust (you can choose more than one).',
      type: 'required',
    });
  }

  return issues.map((i) => ({ ...i, fieldId }));
}
