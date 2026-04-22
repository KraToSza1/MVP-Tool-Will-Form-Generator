/**
 * Estate residue guided: trust-end option values, completion check, validation issues.
 * Extracted from the component module so Vite Fast Refresh only sees a default export in the .jsx file.
 */

export const TRUST_END = {
  toBeneficiaries: 'to-beneficiaries',
  perStirpes: 'per-stirpes',
  solicitor: 'solicitor',
};

export function textForTrustEnd(key) {
  if (key === TRUST_END.toBeneficiaries) {
    return 'Equally to the trust beneficiaries named above (or as my solicitor shall confirm in the will).';
  }
  if (key === TRUST_END.perStirpes) {
    return 'To the named beneficiaries, with the share of any beneficiary who dies before the life tenant passing to their children in equal shares (per stirpes) if they have issue.';
  }
  if (key === TRUST_END.solicitor) {
    return 'As my solicitor shall specify, following the instructions I give at my will-taking appointment.';
  }
  return '';
}

/** @param {Record<string, unknown>|null|undefined} v */
export function isEstateResidueGuidedComplete(v) {
  const x = v || {};
  const dist = x.howResidueDistributed;
  if (dist !== 'AsShares' && dist !== 'IntoFLIT') return false;

  if (dist === 'AsShares') {
    if (!String(x.residualGiftsDetails || '').trim()) return false;
    if (x.failedResiduePassProportionately !== 'Yes' && x.failedResiduePassProportionately !== 'No') return false;
  } else {
    if (x.powerToRevokeLifeInterest !== 'Yes' && x.powerToRevokeLifeInterest !== 'No') return false;
    if (x.appointSeparateTrusteesFLIT !== 'Yes' && x.appointSeparateTrusteesFLIT !== 'No') return false;
    if (x.appointSeparateTrusteesFLIT === 'Yes') {
      const rows = x.separateTrusteeData;
      if (!Array.isArray(rows) || rows.length < 1) return false;
    }
    if (!String(x.lifeTenantDetails || '').trim()) return false;
    if (!String(x.beneficiariesDetails || '').trim()) return false;
    const m = x.flitTrustEndMode || x._flitTrustEndMode;
    if (m !== TRUST_END.toBeneficiaries && m !== TRUST_END.perStirpes && m !== TRUST_END.solicitor) return false;
  }

  if (x.specifyFurtherResidualGiftsOnFail !== 'Yes' && x.specifyFurtherResidualGiftsOnFail !== 'No') return false;
  if (x.specifyFurtherResidualGiftsOnFail === 'Yes' && !String(x.furtherResidualGiftsDetails || '').trim()) return false;

  if (x.give10PercentToCharity !== 'Yes' && x.give10PercentToCharity !== 'No') return false;
  if (x.give10PercentToCharity === 'Yes') {
    if (x.charityGiftOnlyIfIHTDue !== 'Yes' && x.charityGiftOnlyIfIHTDue !== 'No') return false;
    if (x.splitCharitableGift !== 'Yes' && x.splitCharitableGift !== 'No') return false;
    if (!String(x.charityBenefitDetails || '').trim()) return false;
    if (x.minimumCharityAmount !== 'Yes' && x.minimumCharityAmount !== 'No') return false;
    if (x.minimumCharityAmount === 'Yes' && !String(x.minimumCharityAmountValue || '').trim()) return false;
  }

  const iht = x.howIHTDealtWithSplitting;
  if (iht !== 'NA' && iht !== 'AfterTax' && iht !== 'BeforeTax') return false;

  return true;
}

/** @returns {Array<{ fieldId: string, fieldLabel: string, message: string, type: string }>} */
export function getEstateResidueGuidedValidationIssues(v) {
  const issues = [];
  const x = v || {};
  if (!isEstateResidueGuidedComplete(x)) {
    if (x.howResidueDistributed !== 'AsShares' && x.howResidueDistributed !== 'IntoFLIT') {
      issues.push({
        fieldId: 'estateResidueGuided',
        fieldLabel: 'Residuary distribution',
        message: 'Please choose how the remainder of your estate should be distributed.',
        type: 'required',
      });
    } else {
      issues.push({
        fieldId: 'estateResidueGuided',
        fieldLabel: 'Estate administration / residue',
        message: 'Please complete the remaining questions in this section (scroll up if needed).',
        type: 'required',
      });
    }
  }
  return issues;
}
