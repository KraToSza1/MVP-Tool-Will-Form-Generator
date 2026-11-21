import { describe, expect, it } from 'vitest';
import { bandLowerBound, shouldRecommendAristoneFromEstate } from './clientMode.js';
import { mergeFormDefinitions } from '../utils/mergeFormDefinitions.js';

describe('estate bands from text', () => {
  it('reads lower bounds', () => {
    expect(bandLowerBound('Under £325,000')).toBe(0);
    expect(bandLowerBound('£650,001 – £1,000,000')).toBe(650001);
    expect(bandLowerBound('Over £2,000,000')).toBe(2000000);
  });
  it('recommends Aristone for relabelled bands too', () => {
    expect(shouldRecommendAristoneFromEstate({ estateApproxValue: '£650,001 – £1,000,000', estateApproxLiabilities: '£50,001 – £200,000' })).toBe(true);
    expect(shouldRecommendAristoneFromEstate({ estateApproxValue: 'Under £50,000', estateApproxLiabilities: 'None' })).toBe(false);
  });
});

describe('money-band option repair', () => {
  it('saves what the client sees', () => {
    const remote = { formSections: [{ formSection: 'Estate Overview', fields: [{ id: 'estateApproxValue', type: 'select', options: [
      { label: '£650,001 – £1,000,000', value: '£150,001 – £325,000' }, { label: 'As shares', value: 'AsShares' } ] }] }] };
    const merged = mergeFormDefinitions(remote, { formSections: [{ formSection: 'Estate Overview', fields: [{ id: 'estateApproxValue' }] }] });
    const opts = merged.formSections[0].fields[0].options;
    expect(opts[0].value).toBe('£650,001 – £1,000,000');
    expect(opts[1].value).toBe('AsShares');
  });
});
