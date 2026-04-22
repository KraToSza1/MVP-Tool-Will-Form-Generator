/**
 * Single place for the lazy-loaded PDF chunk. After a new deploy, users who still have an old
 * main bundle in memory can request a hashed child chunk that no longer exists; the browser
 * then throws. We detect that and show a "refresh" message instead of a raw fetch error.
 */

export function isStaleChunkLoadError(err) {
  if (!err) return false;
  const name = String(err.name || '');
  if (name === 'ChunkLoadError') return true;
  const msg = String(err.message || err);
  if (/Failed to fetch dynamically imported module/i.test(msg)) return true;
  if (/Failed to import module script/i.test(msg)) return true;
  if (/import\(\) is only supported in module scripts/i.test(msg)) return false;
  if (/Failed to import/i.test(msg) && /module/i.test(msg)) return true;
  if (/Loading chunk [\d-]+ failed/i.test(msg)) return true;
  if (/dynamically imported module/i.test(msg) && (/\bfetch\b/i.test(msg) || /network/i.test(msg)))
    return true;
  return false;
}

/**
 * @returns {Promise<typeof import('../components/PDFGeneratorJSPDF.js')>}
 */
export function importPdfGeneratorModule() {
  return import('../components/PDFGeneratorJSPDF.js');
}
