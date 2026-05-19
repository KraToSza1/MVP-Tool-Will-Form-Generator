import { describe, expect, it } from 'vitest';
import formData from '../data/Complete-WillSuite-Form-Data.json';
import { getMissingIdVerificationDocs } from '../lib/matterOutstanding.js';
import { CLIENT_AUTOFILL_STRIP_FIELD_IDS } from '../constants/clientMode.js';
import { buildClientSubmitReviewSections } from '../lib/clientSubmitReviewSummary.js';
import { OUTSTANDING_CATEGORY, getMatterOutstandingCategories } from '../lib/matterOutstanding.js';
import { pruneStaleBranchValues } from './pruneStaleBranchValues.js';
import {
  clearIdentityVerificationAutofill,
  filterAutofillPayloadToFormSchema,
  generateDummyFormData,
} from './autoFillForm.js';

describe('autoFillForm', () => {
  it('fills critical client fields and guided gift lists', () => {
    const data = generateDummyFormData(formData);
    expect(data.firstName).toBe('Marcus');
    expect(data.lastName).toBe('Ellwood');
    expect(Array.isArray(data.executorData)).toBe(true);
    expect(data.executorData.length).toBeGreaterThan(0);
    expect(data.howResidueDistributed).toBe('IntoFLIT');
    expect(data.leaveMoneyGifts).toBe('Yes');
    expect(data.monetaryGiftsList?.length).toBeGreaterThan(0);
    expect(data.leaveSpecificGifts).toBe('Yes');
    expect(data.specificGiftsList?.length).toBeGreaterThan(0);
    expect(data.leavePropertyGifts).toBe('Yes');
    expect(data.propertyGiftsList?.length).toBeGreaterThan(0);
    expect(data.guardianFlowState).toBeTruthy();
    expect(data.appointGuardians).toBe('Yes, but appoint different guardians for children');
  });

  it('leaves identity verification uploads empty', () => {
    const data = generateDummyFormData(formData);
    expect(getMissingIdVerificationDocs({ identityVerification: data.identityVerification })).toHaveLength(4);
    expect(data.identityVerification?.identityVerificationPhotoId).toBeFalsy();
  });

  it('clearIdentityVerificationAutofill removes demo slots', () => {
    const payload = {
      identityVerification: { identityVerificationPhotoId: 'data:image/png;base64,x' },
      identityVerificationFileNames: { identityVerificationPhotoId: 'x.png' },
    };
    clearIdentityVerificationAutofill(payload);
    expect(payload.identityVerification).toEqual({});
    expect(payload.identityVerificationFileNames).toEqual({});
  });

  it('keeps property trust solicitor fields after schema filter (not in form JSON ids)', () => {
    const filled = generateDummyFormData(formData);
    const filtered = filterAutofillPayloadToFormSchema(filled, formData);
    expect(filtered.includePropertyTrust).toBe('Yes');
    expect(String(filtered.propertyTrustDetails ?? '').trim()).not.toBe('');
    expect(String(filtered.propertyTrustScheduleNumber ?? '').trim()).not.toBe('');
    expect(String(filtered.propertyTrustTerms ?? '').trim()).not.toBe('');
  });

  it('keeps BPR and property trust drafting on client autofill for matter workflow checks', () => {
    const filled = generateDummyFormData(formData);
    const clientPayload = filterAutofillPayloadToFormSchema(filled, formData);
    CLIENT_AUTOFILL_STRIP_FIELD_IDS.forEach((key) => {
      delete clientPayload[key];
    });
    expect(clientPayload.bprTrustDetails).toBeTruthy();
    expect(clientPayload.bprTrustScheduleNumber).toBeTruthy();
    expect(clientPayload.bprTrustTerms).toBeTruthy();
    expect(clientPayload.propertyTrustDetails).toBeTruthy();
    expect(clientPayload.propertyTrustScheduleNumber).toBeTruthy();
    expect(clientPayload.propertyTrustTerms).toBeTruthy();
    expect(clientPayload.physicalHealthDescription).toBeTruthy();

    const categories = getMatterOutstandingCategories({
      outstanding_verification: true,
      client_payload: clientPayload,
      solicitor_payload: {},
    });
    expect(categories).not.toContain(OUTSTANDING_CATEGORY.BPR_TRUST_REQUIRED);
    expect(categories).not.toContain(OUTSTANDING_CATEGORY.PROPERTY_TRUST_REQUIRED);
    expect(categories).not.toContain(OUTSTANDING_CATEGORY.TESTAMENTARY_CAPACITY);
    expect(categories).toContain(OUTSTANDING_CATEGORY.ID_VERIFICATION);
  });

  it('survives pruneStaleBranchValues so submit review shows executors and guardians', () => {
    const filled = generateDummyFormData(formData);
    const afterPrune = pruneStaleBranchValues({}, filled);
    const sections = buildClientSubmitReviewSections(afterPrune);
    const exec = sections.find((s) => s.id === 'executors')?.lines ?? [];
    const guard = sections.find((s) => s.id === 'guardians')?.lines ?? [];
    expect(exec[0]).not.toBe('None recorded');
    expect(exec.some((l) => l.includes('Aristone'))).toBe(true);
    expect(guard[0]).not.toBe('None recorded');
  });

  it('fills business and property trust guided state', () => {
    const data = generateDummyFormData(formData);
    expect(data.biz_has_interests).toBeTruthy();
    expect(data.includePropertyTrust).toBe('Yes');
    expect(data.propertyTrustClientSummary).toBeTruthy();
    expect(data.includeBPRTrust).toBe('Yes');
    expect(data.bprTrustDetails).toBeTruthy();
  });
});
