import { describe, expect, it } from 'vitest';
import { getMobileInputHints } from './mobileInputHints.js';

describe('getMobileInputHints', () => {
  it('gives phone fields a number keyboard and contact autofill', () => {
    expect(getMobileInputHints({ id: 'mobile' })).toEqual({ inputMode: 'tel', autoComplete: 'tel' });
    expect(getMobileInputHints({ id: 'tel2' }).inputMode).toBe('tel');
  });

  it('never autofills the client\'s own details into partner fields', () => {
    expect(getMobileInputHints({ id: 'partnerMobile' })).toEqual({ inputMode: 'tel', autoComplete: 'off' });
    expect(getMobileInputHints({ id: 'partnerEmail' }).autoComplete).toBe('off');
    expect(getMobileInputHints({ id: 'partnerPostcode' }).autoComplete).toBe('off');
  });

  it('handles email, postcode, address and names', () => {
    expect(getMobileInputHints({ id: 'email' }).inputMode).toBe('email');
    expect(getMobileInputHints({ id: 'postcode' }).autoCapitalize).toBe('characters');
    expect(getMobileInputHints({ id: 'address2' }).autoComplete).toBe('address-line2');
    expect(getMobileInputHints({ id: 'firstName' }).autoComplete).toBe('given-name');
    expect(getMobileInputHints({ id: 'lastName' }).autoComplete).toBe('family-name');
  });

  it('leaves other fields alone', () => {
    expect(getMobileInputHints({ id: 'hotelName' })).toEqual({});
    expect(getMobileInputHints({ id: 'estateAdditionalNotes' })).toEqual({});
    expect(getMobileInputHints({})).toEqual({});
  });
});
