import { describe, expect, it } from 'vitest';
import { buildCloudPayload, buildClientSnapshot, mergeMatterPayloads } from './formPayload.js';

describe('form payload helpers', () => {
  it('excludes nested identity verification data from cloud payloads', () => {
    const payload = buildCloudPayload({
      firstName: 'Alice',
      identityVerification: {
        photoId: 'data:image/png;base64,abc123',
      },
      nested: {
        proof: 'data:image/png;base64,proof',
      },
    }, 4);

    expect(payload).toEqual({
      _step: 4,
      firstName: 'Alice',
      nested: {},
    });
    expect(payload.identityVerification).toBeUndefined();
  });

  it('builds a client snapshot from common intake fields', () => {
    const snapshot = buildClientSnapshot({
      firstName: 'Alice',
      lastName: 'Smith',
      email: 'alice@example.com',
      phoneNumber: '0123456789',
    });

    expect(snapshot.fullName).toBe('Alice Smith');
    expect(snapshot.email).toBe('alice@example.com');
    expect(snapshot.phoneNumber).toBe('0123456789');
  });

  it('merges client and solicitor payloads with solicitor values winning', () => {
    expect(mergeMatterPayloads(
      { firstName: 'Alice', status: 'client' },
      { status: 'solicitor', witness1Name: 'John Witness' },
    )).toEqual({
      firstName: 'Alice',
      status: 'solicitor',
      witness1Name: 'John Witness',
    });
  });
});
