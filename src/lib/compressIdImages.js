/**
 * Compress image data URLs (e.g. ID verification photos) so the submit payload
 * stays under a safe size and the RPC doesn't time out.
 *
 * - Max dimension 1200px, JPEG quality 0.82.
 * - Non-image values (e.g. PDF data URLs) are left as-is.
 */

const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.82;

/**
 * @param {string} dataUrl - data:image/... or data:application/pdf;base64,...
 * @returns {Promise<string>} - compressed data URL or original if not compressible
 */
export function compressImageDataUrl(dataUrl) {
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
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(dataUrl);
          return;
        }
        ctx.drawImage(img, 0, 0, targetW, targetH);
        const compressed = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(compressed);
      } catch (e) {
        console.warn('[compressIdImages] compress failed', e);
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
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
