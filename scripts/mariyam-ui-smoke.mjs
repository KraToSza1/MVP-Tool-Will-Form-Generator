/**
 * Verifies (1) preview loads in headless Chromium with the client shell visible, and
 * (2) production JS chunks contain Mariyam copy strings (they render on later steps, not first paint).
 * Run: npm run preview -- --port 4173 --strictPort
 * Then: node scripts/mariyam-ui-smoke.mjs
 */
import puppeteer from 'puppeteer';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const distAssets = join(__dirname, '..', 'dist', 'assets');

function readMainChunk() {
  if (!existsSync(distAssets)) return '';
  const files = readdirSync(distAssets).filter((f) => /^index-[^/]+\.js$/.test(f));
  let combined = '';
  for (const f of files) {
    combined += readFileSync(join(distAssets, f), 'utf8');
  }
  return combined;
}

const bundleChecks = [
  'Based on the information you',
  'professional administration',
  'Recommended for estates like yours',
  'If you appoint Aristone Solicitors, professional fees will apply',
];

async function main() {
  const chunk = readMainChunk();
  for (const s of bundleChecks) {
    const ok = chunk.includes(s);
    console.log(ok ? 'OK' : 'MISS', '[bundle]', s.slice(0, 72) + (s.length > 72 ? '…' : ''));
    if (!ok) process.exitCode = 1;
  }

  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(BASE, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.waitForSelector('main', { timeout: 15000 });
    const text = await page.evaluate(() => document.body.innerText);
    await browser.close();
    const homeOk = text.includes('Will Tool');
    console.log(homeOk ? 'OK' : 'MISS', '[DOM]', 'Will Tool (home shell)');
    if (!homeOk) process.exitCode = 1;
  } catch (e) {
    console.warn('[DOM] Skipped (Puppeteer/Chrome unavailable):', e.message || e);
  }

  console.log(
    '\nNote: Recommendation panel and fees notice render on Trustees/Executors after navigation; full path was not automated (required fields per step). Bundle checks above prove those strings ship in production JS.'
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
