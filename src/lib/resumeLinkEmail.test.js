import { describe, expect, it } from 'vitest';
import {
  buildClientReferenceEmail,
  buildClientResumeEmail,
  buildClientResumeUrl,
  isSecureResumeUrlAvailable,
} from './resumeLinkEmail.js';

describe('resumeLinkEmail', () => {
  it('requires ref and secret for a secure resume URL', () => {
    expect(
      buildClientResumeUrl({
        origin: 'https://example.com',
        sessionRef: 'ABC123',
        sessionSecret: 'SECRET',
      }),
    ).toBe('https://example.com/?ref=ABC123&s=SECRET');
    expect(
      buildClientResumeUrl({
        origin: 'https://example.com',
        sessionRef: 'ABC123',
      }),
    ).toBeNull();
    expect(isSecureResumeUrlAvailable({ sessionRef: 'ABC', sessionSecret: 'x' })).toBe(true);
    expect(isSecureResumeUrlAvailable({ sessionRef: 'ABC' })).toBe(false);
  });

  it('builds secure resume email only with full URL', () => {
    const body = buildClientResumeEmail({
      clientName: 'Jane Doe',
      resumeUrl: 'https://example.com/?ref=X&s=Y',
    });
    expect(body).toContain('Dear Jane Doe');
    expect(body).toContain('do not forward');
    expect(body).toContain('https://example.com/?ref=X&s=Y');
    expect(body).not.toContain('cannot send');
  });

  it('rejects resume email without secret in URL', () => {
    expect(() =>
      buildClientResumeEmail({
        clientName: 'Jane',
        resumeUrl: 'https://example.com/?ref=X',
      }),
    ).toThrow();
  });

  it('builds reference-only email without a resume URL', () => {
    const body = buildClientReferenceEmail({
      clientName: 'Jane Doe',
      clientReference: 'WILL-001',
      sessionRef: 'ABC123',
    });
    expect(body).toContain('Dear Jane Doe');
    expect(body).toContain('WILL-001');
    expect(body).toContain('cannot send a new working resume link');
    expect(body).not.toMatch(/https?:\/\//);
    expect(body).not.toContain('?ref=');
  });
});
