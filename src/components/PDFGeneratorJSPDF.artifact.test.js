import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { generatePDFWithJSPDF } from './PDFGeneratorJSPDF.js';

/**
 * Writes a PDF built from the current PDFGeneratorJSPDF.js (same code path as the app).
 * Run: npx vitest run src/components/PDFGeneratorJSPDF.artifact.test.js
 * Output: artifacts/verify-pdf-from-source.pdf (repo root)
 */
describe('PDF artifact for verification', () => {
  it('writes artifacts/verify-pdf-from-source.pdf', async () => {
    const dir = join(process.cwd(), 'artifacts');
    mkdirSync(dir, { recursive: true });
    const outPath = join(dir, 'verify-pdf-from-source.pdf');
    const { doc } = await generatePDFWithJSPDF({}, {}, { isClientPDF: true });
    writeFileSync(outPath, Buffer.from(doc.output('arraybuffer')));
    console.log('[artifact] wrote', outPath);
  });
});
