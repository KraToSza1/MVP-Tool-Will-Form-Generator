/**
 * Live executor age verification — real Add Individual Executor modal (Playwright).
 * Run: npm run dev → http://localhost:5173
 *     node scripts/executor-age-live-verify.mjs
 */
import { chromium } from 'playwright';

const BASE = (process.env.VITE_URL || 'http://localhost:5173').replace(/\/$/, '');

/**
 * Choosing "Individual" schedules a 100ms timeout that clears executorData (FieldRenderer).
 * Any save before that completes can be wiped — wait longer than 100ms before adding a person.
 */
async function selectIndividual(page) {
  await page.locator('[data-field-id="chooseAristoneExecutor"] input[value="Individual"]').click({ force: true });
  await page.waitForTimeout(450);
}

async function fillNewExecutor(page, { firstName, lastName, dob }) {
  const dlg = page.getByRole('dialog').filter({ hasText: 'Add person' });
  await page.locator('[data-field-id="addExecutorButton"] button[type="button"]').first().click();
  await dlg.waitFor({ state: 'visible', timeout: 15000 });
  await dlg.getByLabel('Title').fill('Mr');
  await dlg.getByLabel('First name').fill(firstName);
  await dlg.getByLabel('Last name').fill(lastName);
  await dlg.getByLabel('Address line 1').fill('1 Test Street');
  await dlg.getByLabel('Postcode').fill('SW1A 1AA');
  await dlg.getByLabel('Date of birth').fill(dob);
  await dlg.getByLabel('Gender').selectOption('Male');
  await dlg.getByRole('button', { name: 'Add person' }).click();
  await dlg.waitFor({ state: 'hidden', timeout: 15000 });
}

/** Remove only primary executors (not substitute), matching addExecutorButton scope. */
async function removeAllExecutors(page) {
  const removeButtons = page
    .locator('[data-field-id="addExecutorButton"]')
    .locator('button.add-item-list-remove[title="Remove"]');
  let n = await removeButtons.count();
  while (n > 0) {
    await removeButtons.first().click();
    await page.waitForTimeout(250);
    n = await removeButtons.count();
  }
}

async function ageFlowBox(page) {
  const loc = page.locator('[data-field-id="executorIndividualAgeFlow"]');
  const n = await loc.count();
  if (n === 0) return { present: false, text: '' };
  await loc.first().scrollIntoViewIfNeeded();
  return { present: true, text: (await loc.first().innerText()).trim() };
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  const r = { test1: {}, test2: {}, test3: {}, test4: {}, test5: {}, error: null };

  try {
    // Force bundled questionnaire: remote `form_definitions` may omit `executorIndividualAgeFlow`.
    await page.route('**/rest/v1/form_definitions**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: '[]',
      });
    });

    await page.addInitScript(() => {
      try {
        localStorage.removeItem('willForm');
        localStorage.removeItem('willFormStep');
        localStorage.removeItem('willFormRef');
      } catch {
        /* ignore */
      }
    });

    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 90000 });
    await page.getByRole('button', { name: /Auto-Fill Form/i }).click();
    await page.waitForTimeout(2000);
    await page.getByRole('button', { name: 'Trustees/Executors' }).click();
    await page.waitForTimeout(500);

    // --- Test 5
    await page.locator('[data-field-id="chooseAristoneExecutor"] input[value="Aristone"]').click({ force: true });
    await page.waitForTimeout(300);
    r.test5.aristoneOnly_noAgeBlock = (await page.locator('[data-field-id="executorIndividualAgeFlow"]').count()) === 0;

    await selectIndividual(page);
    r.test5.individualNoExecutor_noAgeBlock = (await page.locator('[data-field-id="executorIndividualAgeFlow"]').count()) === 0;

    // --- Test 1: 30+ (DOB 01/01/1990)
    await fillNewExecutor(page, { firstName: 'Thirty', lastName: 'Plus', dob: '01/01/1990' });
    await page.waitForTimeout(500);
    let flow = await ageFlowBox(page);
    r.test1.observed = flow.text || '(empty)';
    r.test1.pass = flow.present && flow.text.length === 0;

    // --- Test 2: age 19 (DOB 15/01/2007)
    await removeAllExecutors(page);
    await selectIndividual(page);
    await fillNewExecutor(page, { firstName: 'Nineteen', lastName: 'Years', dob: '15/01/2007' });
    await page.waitForTimeout(600);
    flow = await ageFlowBox(page);
    const t2 = flow.text;
    r.test2.intro = t2.includes('By default, they can act as executor from age 18');
    r.test2.options =
      t2.includes('They can act from age 18') && t2.includes('They should act only once they reach a later age');
    await page.locator('[data-field-id="executorIndividualAgeFlow"]').getByText('They should act only once they reach a later age').click();
    await page.waitForTimeout(400);
    flow = await ageFlowBox(page);
    const t2b = flow.text;
    r.test2.presets1824 = ['21', '23', '25'].every((x) => t2b.includes(x)) && t2b.includes('Other');
    await page.locator('[data-field-id="executorIndividualAgeFlow"]').getByText('21', { exact: true }).click();
    await page.waitForTimeout(400);
    flow = await ageFlowBox(page);
    r.test2.explanationWhenLater =
      flow.text.includes('Until they reach that age, they will not be able to act as executor') &&
      flow.text.includes('Any other executor who is able to act may deal with your estate in the meantime.');
    r.test2.observed = flow.text;

    // --- Test 3: age 16 (DOB 01/01/2010)
    await removeAllExecutors(page);
    await selectIndividual(page);
    await fillNewExecutor(page, { firstName: 'Sixteen', lastName: 'Years', dob: '01/01/2010' });
    await page.waitForTimeout(600);
    flow = await ageFlowBox(page);
    const t3 = flow.text;
    r.test3.introU18 = t3.includes('By default, an executor can act from age 18');
    await page.locator('[data-field-id="executorIndividualAgeFlow"]').getByText('They should act only once they reach a later age').click();
    await page.waitForTimeout(400);
    flow = await ageFlowBox(page);
    const t3b = flow.text;
    r.test3.presetsU18 = ['18', '21', '23', '25'].every((x) => t3b.includes(x)) && t3b.includes('Other');
    await page.locator('[data-field-id="executorIndividualAgeFlow"]').getByText('25', { exact: true }).click();
    await page.waitForTimeout(400);
    flow = await ageFlowBox(page);
    r.test3.explanation = flow.text.includes('Until they reach that age, they will not be able to act as executor');
    r.test3.observed = flow.text;

    // --- Test 4: warning, then add adult
    await removeAllExecutors(page);
    await selectIndividual(page);
    await fillNewExecutor(page, { firstName: 'Minor', lastName: 'Only', dob: '01/01/2010' });
    await page.waitForTimeout(500);
    await page.locator('[data-field-id="executorIndividualAgeFlow"]').getByText('They should act only once they reach a later age').click();
    await page.waitForTimeout(300);
    await page.locator('[data-field-id="executorIndividualAgeFlow"]').getByText('25', { exact: true }).click();
    await page.waitForTimeout(500);
    flow = await ageFlowBox(page);
    const warnExact =
      'None of the executors you have chosen would be able to act immediately. You should appoint at least one executor who will be able to act if needed before that time.';
    r.test4.warningText = flow.text.includes(warnExact);

    const dlg2 = page.getByRole('dialog').filter({ hasText: 'Add person' });
    await page.locator('[data-field-id="addExecutorButton"] button[type="button"]').first().click();
    await dlg2.waitFor({ state: 'visible' });
    await dlg2.getByLabel('First name').fill('Adult');
    await dlg2.getByLabel('Last name').fill('Helper');
    await dlg2.getByLabel('Address line 1').fill('2 Test Street');
    await dlg2.getByLabel('Postcode').fill('SW1A 1AB');
    await dlg2.getByLabel('Date of birth').fill('01/01/1985');
    await dlg2.getByLabel('Gender').selectOption('Female');
    await dlg2.getByRole('button', { name: 'Add person' }).click();
    await page.waitForTimeout(1000);
    flow = await ageFlowBox(page);
    r.test4.warningGone = !flow.text.includes('None of the executors you have chosen would be able to act immediately');
    r.test4.observedTail = flow.text.slice(-400);

    r.test1.pass = !!r.test1.pass;
    r.test2.pass = r.test2.intro && r.test2.options && r.test2.presets1824 && r.test2.explanationWhenLater;
    r.test3.pass = r.test3.introU18 && r.test3.presetsU18 && r.test3.explanation;
    r.test4.pass = r.test4.warningText && r.test4.warningGone;
    r.test5.pass = r.test5.aristoneOnly_noAgeBlock && r.test5.individualNoExecutor_noAgeBlock;

    console.log(JSON.stringify(r, null, 2));
  } catch (e) {
    r.error = String(e.message || e);
    console.log(JSON.stringify(r, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
