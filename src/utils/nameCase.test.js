import { describe, expect, it } from 'vitest';
import {
  toProperNameCase,
  toProperAddressCase,
  normalizePostcode,
  normalizePersonRecordCasing,
} from './nameCase.js';

describe('toProperNameCase', () => {
  it('title-cases ALL CAPS names', () => {
    expect(toProperNameCase('MR GUARDIAN 1 SMITHY')).toBe('Mr Guardian 1 Smithy');
    expect(toProperNameCase('MRS CARMEN WENTZEL')).toBe('Mrs Carmen Wentzel');
  });

  it('title-cases all-lowercase names', () => {
    expect(toProperNameCase('john smith')).toBe('John Smith');
  });

  it('keeps mixed-case names untouched (trusts the user)', () => {
    expect(toProperNameCase('McDonald')).toBe('McDonald');
    expect(toProperNameCase("O'Brien")).toBe("O'Brien");
    expect(toProperNameCase('iPad Trust')).toBe('iPad Trust');
  });

  it('handles Mc / hyphenated / apostrophe names from ALL CAPS', () => {
    expect(toProperNameCase('MCDONALD')).toBe('McDonald');
    expect(toProperNameCase('SMITH-JONES')).toBe('Smith-Jones');
    expect(toProperNameCase("O'BRIEN")).toBe("O'Brien");
  });

  it('keeps name particles lowercase except as the first word', () => {
    expect(toProperNameCase('VON DER BERG')).toBe('Von der Berg');
    expect(toProperNameCase('VAN HELSING')).toBe('Van Helsing');
  });

  it('returns empty string for nullish/empty input', () => {
    expect(toProperNameCase(null)).toBe('');
    expect(toProperNameCase('')).toBe('');
  });
});

describe('toProperAddressCase', () => {
  it('title-cases an ALL CAPS address but preserves the postcode', () => {
    expect(toProperAddressCase('14 HIGHT STREET,LUTON, LU1 1QG')).toBe(
      '14 Hight Street, Luton, LU1 1QG',
    );
  });

  it('inserts a space after commas', () => {
    expect(toProperAddressCase('GROUND FLOOR,12 CARDIFF ROAD,LUTON,LU1 1QG')).toBe(
      'Ground Floor, 12 Cardiff Road, Luton, LU1 1QG',
    );
  });

  it('keeps mixed-case addresses untouched', () => {
    expect(toProperAddressCase('221B Baker Street, London, NW1 6XE')).toBe(
      '221B Baker Street, London, NW1 6XE',
    );
  });
});

describe('normalizePostcode', () => {
  it('upper-cases and inserts the standard space', () => {
    expect(normalizePostcode('lu11qg')).toBe('LU1 1QG');
    expect(normalizePostcode('LU1  1QG')).toBe('LU1 1QG');
    expect(normalizePostcode('sw1a1aa')).toBe('SW1A 1AA');
  });

  it('returns uppercased input for non-postcode-shaped values', () => {
    expect(normalizePostcode('TBA')).toBe('TBA');
  });
});

describe('normalizePersonRecordCasing', () => {
  it('normalises name + address fields together', () => {
    const out = normalizePersonRecordCasing({
      title: 'MR',
      firstName: 'GUARDIAN',
      lastName: 'SMITHY',
      address1: '14 HIGHT STREET',
      address3: 'LUTON',
      postcode: 'lu11qg',
    });
    expect(out).toEqual({
      title: 'Mr',
      firstName: 'Guardian',
      lastName: 'Smithy',
      address1: '14 Hight Street',
      address3: 'Luton',
      postcode: 'LU1 1QG',
    });
  });

  it('returns input unchanged for non-objects', () => {
    expect(normalizePersonRecordCasing(null)).toBe(null);
    expect(normalizePersonRecordCasing('foo')).toBe('foo');
  });
});
