import { describe, expect, it } from 'vitest';
import { CLIENT_SUBMIT_UNREACHABLE_MESSAGE, isNetworkishError } from './clientSubmitErrors.js';

describe('isNetworkishError', () => {
  it('detects browser network failures', () => {
    expect(isNetworkishError('TypeError: Failed to fetch')).toBe(true);
    expect(isNetworkishError('Load failed')).toBe(true);
    expect(isNetworkishError(new Error('NetworkError when attempting to fetch resource.'))).toBe(true);
    expect(isNetworkishError('Request timed out')).toBe(true);
  });

  it('ignores validation / business errors', () => {
    expect(isNetworkishError('Session not found or invalid secret')).toBe(false);
    expect(isNetworkishError('')).toBe(false);
    expect(isNetworkishError(null)).toBe(false);
  });
});

describe('CLIENT_SUBMIT_UNREACHABLE_MESSAGE', () => {
  it('reassures the client and gives a way to contact the firm', () => {
    expect(CLIENT_SUBMIT_UNREACHABLE_MESSAGE).toMatch(/saved on this device/);
    expect(CLIENT_SUBMIT_UNREACHABLE_MESSAGE).toMatch(/info@aristonesolicitors\.co\.uk/);
  });
});
