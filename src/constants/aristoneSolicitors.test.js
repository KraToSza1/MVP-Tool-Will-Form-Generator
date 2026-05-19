import { describe, expect, it } from 'vitest';
import { getAristoneProfessionalExecutorOptions } from './aristoneSolicitors.js';

describe('getAristoneProfessionalExecutorOptions', () => {
  it('uses the canonical Luton office address, not a placeholder', () => {
    const opts = getAristoneProfessionalExecutorOptions();
    expect(opts.address).toContain('Cardiff Road');
    expect(opts.address).toContain('LU1 1QG');
    expect(opts.address).not.toContain('[Office Address]');
    expect(opts.fullDetails).toContain('649717');
  });
});
