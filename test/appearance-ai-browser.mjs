import {chromium} from 'playwright';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {feeds} from '../feeds.mjs';
import {navigateUI, skipFirstUse} from './navigation.mjs';

const artifacts = process.env.APPEARANCE_ARTIFACT_DIR || 'test-artifacts/appearance';mkdirSync(artifacts, {recursive: true});
const newsFetcher = async url => {
  const feed = feeds.find(item => item.feedUrl === url) || feeds[0];
  return new Response(`<rss><channel>${Array.from({length: 10}, (_, index) => `<item><title>${feed.name} introduces a new product ${index + 1}</title><link>${feed.url}test-${index + 1}</link><pubDate>${new Date(Date.now() - index * 60000).toUTCString()}</pubDate></item>`).join('')}</channel></rss>`);
};
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
    assert.equal(await page.locator('[data-ai-summary]').innerText(), 'ค้นหาข่าวที่เกี่ยวข้อง');
    assert.equal(await page.locator('[data-headline-brief]').count(), 0);
    assert.equal(await page.locator('.ai-card,.ai-free-search,.agent-notice').count(), 0);assert.equal(await page.locator('#article-card').evaluate(card => !!(card.compareDocumentPosition(document.querySelector('#related-news')) & Node.DOCUMENT_POSITION_FOLLOWING)), true);
    await page.locator('[data-ai-summary]').click();await page.waitForSelector('.ai-references summary');
    assert.equal(await page.locator('#ai-question-form').count(), 0);
    assert.match(await page.locator('.related-news-card').innerText(), /ค้นหาข่าวที่เกี่ยวข้อง/);
    assert.equal(await page.locator('.ai-sources a').count(), 10);
    assert.equal(await page.locator('.ai-sources a').first().getAttribute('href'), 'https://www.apple.com/newsroom/test-1');
    for (const mode of ['light', 'dark']) {
      if (mode === 'dark') await page.locator('.topbar [data-theme-toggle]').click();
      assert.equal(await page.locator('html').getAttribute('data-theme'), mode);
      assert.ok(await contrast(page, '.subtitle', 'body') >= 4.5);
      assert.ok(await contrast(page, '.related-news-card>p', '.related-news-card') >= 4.5);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator('.ai-references').getAttribute('open'), null);
      assert.equal(await page.locator('.ai-references a').first().isVisible(), false);
      assert.match(await page.locator('.ai-references summary').innerText(), /แหล่งอ้างอิง.*10 ข่าว/s);
      await page.screenshot({path: `${artifacts}/insights-${mode}-${width}.png`, fullPage: true, animations: 'disabled'});
      await page.locator('.ai-references summary').focus();await page.keyboard.press('Enter');
      assert.equal(await page.locator('.ai-references a').first().isVisible(), true);
      assert.match(await page.locator('.ai-references').innerText(), /เผยแพร่.*น\. \(ไทย\)/s);
      assert.equal(await page.locator('.ai-references a').first().getAttribute('rel'), 'noopener noreferrer');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.screenshot({path: `${artifacts}/references-${mode}-${width}.png`, fullPage: true, animations: 'disabled'});
      await page.locator('.ai-references summary').focus();await page.keyboard.press('Space');
      assert.equal(await page.locator('.ai-references a').first().isVisible(), false);
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
    articleFetcher: async () => new Response('<article><h1>Product announcement</h1>'+('<p>The article states that a research laboratory will open in Cambridge in 2028. Researchers will publish their findings on energy efficiency.</p>'.repeat(6))+'</article>', {headers:{'Content-Type':'text/html'}}),
    aiFetcher: async (url, options) => {
      if (!options.method) return Response.json({supportedGenerationMethods: ['generateContent']});
      const body = JSON.parse(options.body), input = JSON.parse(body.contents[0].parts[0].text);assert.match(input.content,/Cambridge/);
      const value = body.generationConfig.responseJsonSchema.properties.answer ? {answer: 'บทความระบุห้องวิจัยใน Cambridge ปี 2028', supported: true, sourceIds: [input.article.id]} : {title: 'ภาพรวม Apple จาก Gemini ทดสอบ', summary: 'มีหัวข้อประกาศผลิตภัณฑ์ใหม่', facts: [], risks: [], positiveFactors: [], unknowns: [], confidence: 'low'};
      return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(value)}]}}]});
    }});
  try {
    connected.listen(0, '127.0.0.1');await once(connected, 'listening');const origin = `http://127.0.0.1:${connected.address().port}`;
    const page = await browser.newPage(), errors = [];page.on('pageerror', error => errors.push(error.message));
    const account = {name: 'Connected AI', email: 'connected@example.com', password: 'connected-test-password'};
    await page.request.post(origin + '/api/register', {headers: {Origin: origin}, data: account});await page.request.post(origin + '/api/login', {headers: {Origin: origin}, data: account});
    await page.goto(origin);await skipFirstUse(page);await navigateUI(page, 'insights');await page.waitForFunction(() => aiStatus.available);
    assert.match(await page.locator('.ai-badge').first().innerText(), /Gemini พร้อมใช้/);
    assert.equal(await page.locator('[data-ai-summary]').innerText(), 'ค้นหาข่าวที่เกี่ยวข้อง');
    assert.equal(await page.locator('[data-headline-brief]').count(), 0);
    await page.locator('[data-article-summary]').click();await page.waitForSelector('.article-summary');
    assert.match(await page.locator('.article-summary').innerText(), /Gemini/);
    assert.equal(await page.locator('.ai-references').count(), 0);
    await page.locator('#article-question').fill('ประกาศเกี่ยวกับอะไร?');await page.locator('#article-question-form button').click();await page.waitForSelector('.ai-answer');assert.equal(await page.locator('.ai-answer-sources a').count(), 1);
    await page.locator('#article-question').fill('ประกาศอีกครั้งได้ไหม?');await page.locator('#article-question-form button').click();await page.waitForSelector('.article-qa .form-error');assert.match(await page.locator('.article-qa .form-error').innerText(), /โควตา/);
    await page.locator('[data-ai-summary]').click();await page.waitForFunction(() => aiSummaries.AAPL?.generated === false);assert.equal(await page.locator('.ai-sources a').count(), 10);assert.equal(await page.locator('.ai-references a').first().isVisible(), false);assert.deepEqual(errors, []);await page.close();
  } finally {await connected.shutdown();}
  console.log('PASS: light/dark only, reload and cross-tab persistence, denied storage, accessible contrast, no-key live-source brief and responsive routes at 390/768/1440.');
} finally {await browser.close();await server.shutdown();}
