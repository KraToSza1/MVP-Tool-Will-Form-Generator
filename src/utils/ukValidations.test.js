import { describe, it, expect } from 'vitest';
import {
  validateUKPostcode,
  formatUKPostcode,
  validateUKPhoneNumber,
  formatUKPhoneNumber,
  formatUKDate,
  ukDateToISO,
  validateUKAddress,
} from './ukValidations.js';

describe('UK Validations', () => {
  describe('validateUKPostcode', () => {
    it('should validate correct UK postcodes', () => {
      expect(validateUKPostcode('SW1A 1AA')).toBe(true);
      expect(validateUKPostcode('M1 1AA')).toBe(true);
      expect(validateUKPostcode('B33 8TH')).toBe(true);
      expect(validateUKPostcode('W1A 0AX')).toBe(true);
      expect(validateUKPostcode('SW1A1AA')).toBe(true); // Without space
    });

    it('should reject invalid postcodes', () => {
      expect(validateUKPostcode('12345')).toBe(false);
      expect(validateUKPostcode('ABC')).toBe(false);
      expect(validateUKPostcode('')).toBe(false);
      expect(validateUKPostcode(null)).toBe(false);
      expect(validateUKPostcode('SW1A 1A')).toBe(false); // Too short
    });
  });

  describe('formatUKPostcode', () => {
    it('should format postcodes correctly', () => {
      expect(formatUKPostcode('SW1A1AA')).toBe('SW1A 1AA');
      expect(formatUKPostcode('M11AA')).toBe('M1 1AA');
      expect(formatUKPostcode('B338TH')).toBe('B33 8TH');
    });

    it('should handle already formatted postcodes', () => {
      expect(formatUKPostcode('SW1A 1AA')).toBe('SW1A 1AA');
    });

    it('should handle empty or invalid input', () => {
      expect(formatUKPostcode('')).toBe('');
      expect(formatUKPostcode(null)).toBe('');
    });
  });

  describe('validateUKPhoneNumber', () => {
    it('should validate UK mobile numbers', () => {
      expect(validateUKPhoneNumber('07123456789')).toBe(true);
      expect(validateUKPhoneNumber('07123 456789')).toBe(true);
    });

    it('should validate UK landline numbers', () => {
      expect(validateUKPhoneNumber('020 1234 5678')).toBe(true);
      expect(validateUKPhoneNumber('01234567890')).toBe(true);
    });

    it('should validate numbers with country code', () => {
      expect(validateUKPhoneNumber('+44 20 1234 5678')).toBe(true);
      expect(validateUKPhoneNumber('+44 7123 456789')).toBe(true);
    });

    it('should reject invalid phone numbers', () => {
      expect(validateUKPhoneNumber('12345')).toBe(false);
      expect(validateUKPhoneNumber('')).toBe(false);
      expect(validateUKPhoneNumber(null)).toBe(false);
    });
  });

  describe('formatUKPhoneNumber', () => {
    it('should format UK phone numbers correctly', () => {
      expect(formatUKPhoneNumber('07123456789')).toBe('07123 456789');
      expect(formatUKPhoneNumber('02012345678')).toBe('020 1234 5678');
    });

    it('should handle empty input', () => {
      expect(formatUKPhoneNumber('')).toBe('');
      expect(formatUKPhoneNumber(null)).toBe('');
    });
  });

  describe('formatUKDate', () => {
    it('should format ISO dates to UK format', () => {
      expect(formatUKDate('2024-01-15')).toBe('15/01/2024');
      expect(formatUKDate('2023-12-25')).toBe('25/12/2023');
    });

    it('should return UK format dates as-is', () => {
      expect(formatUKDate('15/01/2024')).toBe('15/01/2024');
    });

    it('should handle empty input', () => {
      expect(formatUKDate('')).toBe('');
      expect(formatUKDate(null)).toBe('');
    });
  });

  describe('ukDateToISO', () => {
    it('should convert UK format to ISO', () => {
      expect(ukDateToISO('15/01/2024')).toBe('2024-01-15');
      expect(ukDateToISO('25/12/2023')).toBe('2023-12-25');
    });

    it('should return ISO dates as-is', () => {
      expect(ukDateToISO('2024-01-15')).toBe('2024-01-15');
    });

    it('should handle empty input', () => {
      expect(ukDateToISO('')).toBe('');
      expect(ukDateToISO(null)).toBe('');
    });
  });

  describe('validateUKAddress', () => {
    it('should validate addresses with sufficient length', () => {
      expect(validateUKAddress('123 High Street')).toBe(true);
      expect(validateUKAddress('Flat 5, 123 High Street, London')).toBe(true);
    });

    it('should reject addresses that are too short', () => {
      expect(validateUKAddress('123')).toBe(false);
      expect(validateUKAddress('')).toBe(false);
      expect(validateUKAddress(null)).toBe(false);
    });
  });
});
