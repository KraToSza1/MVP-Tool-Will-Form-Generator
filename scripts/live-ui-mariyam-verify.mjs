/**
 * Live UI verification (Playwright + dev server).
 * Run: npm run dev (port 5173) then: node scripts/live-ui-mariyam-verify.mjs
 */
import { chromium } from 'playwright';

const BASE = (process.env.VITE_URL || 'http://localhost:5173').replace(/\/$/, '');

function norm(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await context.newPage();

  const out = {
    estateOverview: {},
    choosingExecutors: {},
    recommendationOn: {},
    recommendationOff: {},
    fees: {},
    digital: {},
    executorAge: {},
    errors: [],
  };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    await page.getByRole('button', { name: /Auto-Fill Form/i }).click();
    await page.waitForTimeout(1500);

    // --- Estate Overview
    await page.getByRole('button', { name: 'Estate Overview' }).click();
    await page.waitForTimeout(400);
    const main = page.locator('main').last();
    const estateText = norm(await main.innerText());
    out.estateOverview = {
      hasApproxFigures: estateText.includes('Answer using approximate figures only'),
      hasAssetHeading: estateText.includes('What assets do you have?'),
      hasPropertyLabel: estateText.includes('What is the approximate value of your property?'),
      rawSnippet: estateText.slice(0, 800),
    };

    // --- Choosing your executors
    await page.getByRole('button', { name: 'Choosing your executors' }).click();
    await page.waitForTimeout(400);
    const chooseText = norm(await main.innerText());
    out.choosingExecutors = {
      hasParagraph1: chooseText.includes(
        'Your executor is responsible for managing your estate, including dealing with assets, liabilities, and distributing your estate in accordance with your Will.'
      ),
      hasNextStep: chooseText.includes('You will be able to choose your executors in the next step.'),
      rawSnippet: chooseText.slice(0, 600),
    };

    // --- Recommendation OFF: Under £50k gross + None liabilities
    await page.getByRole('button', { name: 'Estate Overview' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('radio', { name: 'Under £50,000' }).click();
    await page.getByRole('radio', { name: 'None' }).click();
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: 'Trustees/Executors' }).click();
    await page.waitForTimeout(500);
    let t = norm(await main.innerText());
    out.recommendationOff = {
      panelText: t.includes('Based on the information you'),
      aristoneLabel: t.match(/🥇 Aristone Solicitors[^\n]*/)?.[0] || '',
      hasYouQualify: t.includes('You qualify'),
    };

    // --- Recommendation ON: restore eligible bands
    await page.getByRole('button', { name: 'Estate Overview' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('radio', { name: /£50,000 – £150,000/ }).click();
    await page.getByRole('radio', { name: 'None' }).click();
    await page.waitForTimeout(200);

    await page.getByRole('button', { name: 'Trustees/Executors' }).click();
    await page.waitForTimeout(500);
    t = norm(await main.innerText());
    const recPanel = page.locator('[role="status"]').filter({ hasText: 'Based on the information' }).first();
    const panelVisible = await recPanel.isVisible().catch(() => false);
    const panelContent = panelVisible ? norm(await recPanel.innerText()) : '';
    const expectedPanel =
      "Based on the information you've provided, your estate may benefit from professional administration.";
    out.recommendationOn = {
      panelVisible,
      panelExact: panelContent === norm(expectedPanel),
      panelContent,
      aristoneLine:
        (await page
          .locator('label')
          .filter({ hasText: /Recommended for estates like yours/ })
          .first()
          .innerText()
          .catch(() => '')) || '',
      fullTrusteesSnippet: t.slice(0, 1200),
    };

    // --- Fees: ensure Aristone path shows single sentence + checkbox
    await page
      .locator('label')
      .filter({ hasText: /Recommended for estates like yours/ })
      .first()
      .click();
    await page.waitForTimeout(400);
    t = norm(await main.innerText());
    const feesRegion = page.locator('p').filter({ hasText: /^If you appoint Aristone Solicitors/ }).first();
    const feesBlock = norm((await feesRegion.innerText().catch(() => '')) || '');
    const feeSentenceVisible = feesBlock.includes(
      'If you appoint Aristone Solicitors, professional fees will apply.'
    );
    const ackCount = await page.getByRole('checkbox', { name: /I understand and agree/i }).count();
    out.fees = {
      feesBlock,
      feeSentenceVisible,
      websiteLinkVisible: await page.getByRole('link', { name: 'website' }).count(),
      ackCheckboxCount: ackCount,
      hasRequestParagraph: t.includes('If you request Aristone'),
    };

    // --- Digital assets (scroll to section within main)
    const digQ = page.getByText('Do you want someone to manage your digital assets', { exact: false });
    await digQ.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // No
    await page.locator('[data-field-id="digitalAssetsWantManagement"] input[value="No"]').click({ force: true });
    await page.waitForTimeout(300);
    t = norm(await main.innerText());
    out.digital.noStops = !t.includes('Who should be responsible for managing your digital assets');

    // Yes + My executors
    await page.locator('[data-field-id="digitalAssetsWantManagement"] input[value="Yes"]').click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('[data-field-id="digitalAssetsWhoManages"] input[value="MyExecutors"]').click({ force: true });
    await page.waitForTimeout(300);
    t = norm(await main.innerText());
    out.digital.yesMyExecutorsHidesAdd = !t.includes('Add Digital Executor');

    // Yes + Someone else
    await page.locator('[data-field-id="digitalAssetsWhoManages"] input[value="SomeoneElse"]').click({ force: true });
    await page.waitForTimeout(400);
    t = norm(await main.innerText());
    out.digital.someoneElseShowsAdd = t.includes('Add Digital Executor');

    // --- Executor age (not automated here: requires Individual + rich executor row; cloud sync can override raw localStorage reload)
    out.executorAge = {
      liveVerified: false,
      reason:
        'This run did not complete a full UI path (open Add Individual Executor → enter DOB → confirm age blocks). A storage-injection reload did not mount `executorIndividualAgeFlow` with Supabase session active.',
    };

    console.log(JSON.stringify(out, null, 2));
  } catch (e) {
    out.errors.push(String(e.message || e));
    console.log(JSON.stringify(out, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
