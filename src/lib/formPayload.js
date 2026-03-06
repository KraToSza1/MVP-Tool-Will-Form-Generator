const SCI_NOTATION_PATTERN = /[eE][+-]?2\d+/;

const SENSITIVE_ROOT_KEYS = new Set([
  'identityVerification',
]);

const CLIENT_SNAPSHOT_FIELDS = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phoneNumber',
  'mobileNumber',
  'telephoneNumber',
  'dateOfBirth',
  'addressLine1',
  'addressLine2',
  'city',
  'postcode',
];

export function isCorruptScientificNumber(value) {
  return value != null && typeof value === 'string' && (value.includes('e+22') || SCI_NOTATION_PATTERN.test(value));
}

export function isDataImageUrl(value) {
  return typeof value === 'string' && value.startsWith('data:image');
}

export function isDataFileUrl(value) {
  return typeof value === 'string' && value.startsWith('data:');
}

function sanitizeValue(value, options) {
  const {
    excludeDataUrls = true,
    excludeIdentityVerification = true,
  } = options;

  if (value == null) return value;

  if (typeof value === 'string') {
    if (isCorruptScientificNumber(value)) return undefined;
    if (excludeDataUrls && isDataFileUrl(value)) return undefined;
    return value;
  }

  if (Array.isArray(value)) {
    const next = value
      .map((item) => sanitizeValue(item, options))
      .filter((item) => item !== undefined);
    return next;
  }

  if (typeof value === 'object') {
    const next = {};
    for (const [key, nestedValue] of Object.entries(value)) {
      if (excludeIdentityVerification && SENSITIVE_ROOT_KEYS.has(key)) continue;
      const sanitized = sanitizeValue(nestedValue, options);
      if (sanitized !== undefined) {
        next[key] = sanitized;
      }
    }
    return next;
  }

  return value;
}

export function buildCloudPayload(formValues, currentIndex) {
  const dataToSave = { _step: currentIndex };

  for (const [key, value] of Object.entries(formValues || {})) {
    if (key === '_step') continue;
    if (SENSITIVE_ROOT_KEYS.has(key)) continue;
    if (key.toLowerCase().includes('signature')) continue;

    const sanitized = sanitizeValue(value, {
      excludeDataUrls: true,
      excludeIdentityVerification: true,
    });

    if (sanitized !== undefined) {
      dataToSave[key] = sanitized;
    }
  }

  return dataToSave;
}

export function buildLocalDraftPayload(formValues) {
  const dataToSave = {};

  for (const [key, value] of Object.entries(formValues || {})) {
    if (key.toLowerCase().includes('signature')) continue;
    if (isDataImageUrl(value)) continue;
    if (isCorruptScientificNumber(value)) continue;
    dataToSave[key] = value;
  }

  return dataToSave;
}

export function buildMatterPayload(formValues, currentIndex) {
  return buildCloudPayload(formValues, currentIndex);
}

export function mergeMatterPayloads(clientPayload, solicitorPayload) {
  const base = { ...(clientPayload || {}) };
  const overlay = { ...(solicitorPayload || {}) };
  return { ...base, ...overlay };
}

export function buildClientSnapshot(formValues) {
  const snapshot = {};

  for (const fieldId of CLIENT_SNAPSHOT_FIELDS) {
    const value = formValues?.[fieldId];
    if (typeof value === 'string' && value.trim() === '') continue;
    if (value != null) {
      snapshot[fieldId] = value;
    }
  }

  const fullName = snapshot.fullName || [snapshot.firstName, snapshot.lastName].filter(Boolean).join(' ').trim();

  return {
    fullName: fullName || 'Unknown client',
    email: snapshot.email || '',
    phoneNumber: snapshot.phoneNumber || snapshot.mobileNumber || snapshot.telephoneNumber || '',
    dateOfBirth: snapshot.dateOfBirth || '',
    addressLine1: snapshot.addressLine1 || '',
    postcode: snapshot.postcode || '',
    raw: snapshot,
  };
}
