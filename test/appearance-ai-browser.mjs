import {chromium} from 'playwright';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {navigateUI, skipFirstUse} from './navigation.mjs';

const artifacts = process.env.APPEARANCE_ARTIFACT_DIR || 'test-artifacts/appearance';mkdirSync(artifacts, {recursive: true});
const newsFetcher = async () => new Response(`<rss><channel><item><title>Apple introduces a new product</title><link>https://www.apple.com/newsroom/test</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
const server = await createApp({databasePath: ':memory:', newsFetcher, aiEnabled: true, aiProvider: 'gemini'});
server.listen(0, '127.0.0.1');await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`, browser = await chromium.launch();
async function contrast(page, selector, surface) {
  return page.evaluate(({selector, surface}) => {
    const lum = color => color.match(/[\d.]+/g).slice(0, 3).map(Number).map(x => x / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4).reduce((sum, x, i) => sum + x * [.2126, .7152, .0722][i], 0);
    const a = lum(getComputedStyle(document.querySelector(selector)).color), b = lum(getComputedStyle(document.querySelector(surface)).backgroundColor);
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
  }, {selector, surface});
}
try {
  for (const width of [390, 768, 1440]) {
    const context = await browser.newContext({viewport: {width, height: 950}, colorScheme: 'light'}), page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);await page.waitForSelector('#register-form');
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    for (const mode of ['light', 'dark']) {
      await page.locator('.auth-theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-appearance'), mode);
      assert.ok(await contrast(page, '.auth-content h1', '.auth-panel') >= 4.5);
      await page.screenshot({path: `${artifacts}/auth-${mode}-${width}.png`, fullPage: true, animations: 'disabled'});
    }
    await page.emulateMedia({colorScheme: 'light'});assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark', 'OS changes do not switch the selected theme');
    await page.locator('.auth-theme-toggle').click();await page.emulateMedia({colorScheme: 'dark'});assert.equal(await page.locator('html').getAttribute('data-theme'), 'light', 'explicit choice overrides OS');
    await page.reload();await page.waitForSelector('#register-form');assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    const account = {name: 'Theme test', email: `theme-${width}@example.com`, password: 'appearance-test-password'};
    await page.request.post(base + '/api/register', {headers: {Origin: base}, data: account});
    await page.request.post(base + '/api/login', {headers: {Origin: base}, data: account});
    await page.reload();await skipFirstUse(page);await navigateUI(page, 'insights');
    await page.waitForFunction(() => !aiStatus.available && aiStatus.digestAvailable);
    assert.equal(await page.locator('[data-ai-summary]').isEnabled(), true);
    await page.locator('[data-ai-summary]').click();await page.waitForSelector('.ai-sources a');
    assert.equal(await page.locator('#ai-question-form').count(), 0);
    assert.match(await page.locator('.ai-card').innerText(), /ไม่ใช่ผลสรุปจาก AI/);
    assert.equal(await page.locator('.ai-sources a').getAttribute('href'), 'https://www.apple.com/newsroom/test');
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.locator('.topbar [data-theme-toggle]').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), mode);
      assert.ok(await contrast(page, '.subtitle', 'body') >= 4.5);
      assert.ok(await contrast(page, '.ai-card>p', '.ai-card') >= 4.5);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({path: `${artifacts}/insights-${mode}-${width}.png`, fullPage: true, animations: 'disabled'});
      for (const route of ['overview', 'following', 'welcome', 'devices', 'sources', 'alerts', 'search', 'account']) {
        await navigateUI(page, route);assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${mode}/${route}/${width}`);
      }
      await navigateUI(page, 'insights');
    }
    const other = await context.newPage();await other.goto(base);await other.waitForSelector('body:not(.signed-out)');
    await page.locator('.topbar [data-theme-toggle]').click();await other.waitForFunction(() => document.documentElement.dataset.appearance === 'light');
    assert.deepEqual(errors, []);await context.close();
  }
  const blockedStorage = await browser.newContext();await blockedStorage.addInitScript(() => {Storage.prototype.getItem = () => {throw new Error('blocked');};Storage.prototype.setItem = () => {throw new Error('blocked');};});
  const page = await blockedStorage.newPage();await page.goto(base);await page.waitForSelector('#register-form');await page.locator('.auth-theme-toggle').click();assert.equal(await page.locator('html').getAttribute('data-appearance'), 'light');await blockedStorage.close();
  const connected = await createApp({databasePath: ':memory:', newsFetcher, aiEnabled: true, aiProvider: 'gemini', aiApiKey: 'test-only-key', aiDailyLimit: 2,
    aiFetcher: async (url, options) => {
      if (!options.method) return Response.json({supportedGenerationMethods: ['generateContent']});
      const body = JSON.parse(options.body), articles = JSON.parse(body.contents[0].parts[0].text).articles;
      const value = body.generationConfig.responseJsonSchema.properties.answer ? {answer: 'หัวข้อระบุผลิตภัณฑ์ใหม่', supported: true, sourceIds: [articles[0].id]} : {title: 'ภาพรวม Apple จาก Gemini ทดสอบ', summary: 'มีหัวข้อประกาศผลิตภัณฑ์ใหม่', facts: [], risks: [], positiveFactors: [], unknowns: [], confidence: 'low'};
      return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(value)}]}}]});
    }});
  try {
    connected.listen(0, '127.0.0.1');await once(connected, 'listening');const origin = `http://127.0.0.1:${connected.address().port}`;
    const page = await browser.newPage(), errors = [];page.on('pageerror', error => errors.push(error.message));
    const account = {name: 'Connected AI', email: 'connected@example.com', password: 'connected-test-password'};
    await page.request.post(origin + '/api/register', {headers: {Origin: origin}, data: account});await page.request.post(origin + '/api/login', {headers: {Origin: origin}, data: account});
    await page.goto(origin);await skipFirstUse(page);await navigateUI(page, 'insights');await page.waitForFunction(() => aiStatus.available);
    assert.match(await page.locator('.ai-badge').first().innerText(), /Gemini พร้อมใช้/);
    await page.locator('[data-ai-summary]').click();await page.waitForSelector('#ai-question-form');
    assert.match(await page.locator('.ai-confidence').innerText(), /Gemini/);
    await page.locator('#ai-question').fill('ประกาศเกี่ยวกับอะไร?');await page.locator('#ai-question-form button').click();await page.waitForSelector('.ai-answer');assert.equal(await page.locator('.ai-answer-sources a').count(), 1);
    await page.locator('#ai-question').fill('ประกาศอีกครั้งได้ไหม?');await page.locator('#ai-question-form button').click();await page.waitForSelector('.ai-qa .form-error');assert.match(await page.locator('.ai-qa .form-error').innerText(), /โควตา/);
    await page.locator('[data-headline-brief]').click();await page.waitForFunction(() => aiSummaries.AAPL?.generated === false);assert.equal(await page.locator('#ai-question-form').count(), 0);assert.equal(await page.locator('.ai-sources a').count(), 1);assert.deepEqual(errors, []);await page.close();
  } finally {await connected.shutdown();}
  console.log('PASS: light/dark only, reload and cross-tab persistence, denied storage, accessible contrast, no-key live-source brief and responsive routes at 390/768/1440.');
} finally {await browser.close();await server.shutdown();}
