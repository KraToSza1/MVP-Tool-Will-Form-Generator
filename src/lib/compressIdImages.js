/**
 * Compress image data URLs (e.g. ID verification photos) so the submit payload
 * stays under a safe size and the RPC doesn't time out.
 *
 * - Resize to max 1200px, then compress to JPEG.
 * - If result exceeds maxBytes (e.g. 3MB), reduce quality/dimensions until under limit.
 * - Non-image values (e.g. PDF data URLs) are left as-is.
 */

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

/** Approximate bytes of base64 data URL (excluding data:...;base64, prefix) */
function dataUrlByteSize(dataUrl) {
  if (typeof dataUrl !== 'string') return 0;
  const base64 = dataUrl.indexOf(',') >= 0 ? dataUrl.slice(dataUrl.indexOf(',') + 1) : '';
  return Math.floor((base64.length * 3) / 4);
}

/**
 * Compress an image data URL so it does not exceed maxBytes.
 * @param {string} dataUrl - data:image/...
 * @param {number} maxBytes - max size in bytes (default 3MB)
 * @returns {Promise<string>} - compressed data URL
 */
export function compressImageDataUrlToMaxBytes(dataUrl, maxBytes = 3 * 1024 * 1024) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(dataUrl);
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const ctx = document.createElement('canvas').getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        const qualities = [0.82, 0.7, 0.5, 0.35, 0.25];
        let targetW = w;
        let targetH = h;
        if (w > MAX_DIMENSION || h > MAX_DIMENSION) {
          if (w >= h) {
            targetW = MAX_DIMENSION;
            targetH = Math.round((h * MAX_DIMENSION) / w);
          } else {
            targetH = MAX_DIMENSION;
            targetW = Math.round((w * MAX_DIMENSION) / h);
          }
        }
        for (let q of qualities) {
          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const c = canvas.getContext('2d');
          if (!c) continue;
          c.drawImage(img, 0, 0, targetW, targetH);
          const compressed = canvas.toDataURL('image/jpeg', q);
          if (dataUrlByteSize(compressed) <= maxBytes) {
            resolve(compressed);
            return;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const c = canvas.getContext('2d');
        if (c) {
          c.drawImage(img, 0, 0, targetW, targetH);
          resolve(canvas.toDataURL('image/jpeg', 0.2));
        } else {
          resolve(dataUrl);
        }
      } catch (e) {
        console.warn('[compressIdImages] compress to max size failed', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

/**
 * @param {string} dataUrl - data:image/... or data:application/pdf;base64,...
 * @returns {Promise<string>} - compressed data URL (≤3MB for images) or original if not compressible
 */
export function compressImageDataUrl(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return Promise.resolve(dataUrl);
  }
  const MAX_FILE_SIZE_BYTES = 3 * 1024 * 1024;
  return compressImageDataUrlToMaxBytes(dataUrl, MAX_FILE_SIZE_BYTES);
}

/**
 * @param {Record<string, string>} identityVerification - map of key to data URL
 * @returns {Promise<Record<string, string>>} - same shape with images compressed
 */
export async function compressIdentityVerification(identityVerification) {
  if (!identityVerification || typeof identityVerification !== 'object') {
    return identityVerification;
  }
  const out = {};
  for (const [key, value] of Object.entries(identityVerification)) {
    if (typeof value === 'string' && value.startsWith('data:image/')) {
      out[key] = await compressImageDataUrl(value);
    } else {
      out[key] = value;
    }
  }
  return out;
}
