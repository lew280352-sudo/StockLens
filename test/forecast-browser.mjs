import {chromium} from 'playwright';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {navigateUI,logoutUI} from './navigation.mjs';
const directory=process.env.FORECAST_ARTIFACT_DIR||'test-artifacts/forecast';mkdirSync(directory,{recursive:true});
const server=await createApp({databasePath:':memory:',newsFetcher:async()=>new Response('<rss><channel></channel></rss>')});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const config=async locator=>JSON.parse(decodeURIComponent(new URL(await locator.getAttribute('src')).hash.slice(1)));
try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  await context.route('https://www.tradingview-widget.com/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><html><body>Isolated TradingView widget fixture</body></html>'}));
  page.on('pageerror',error=>errors.push(error.message));
  const account={name:'Trend fixture',email:`trend-${width}@example.com`,password:'trend-fixture-password'};
  await context.request.post(origin+'/api/register',{headers:{Origin:origin},data:account});await context.request.post(origin+'/api/login',{headers:{Origin:origin},data:account});
  await page.goto(origin);await page.waitForSelector('body:not(.signed-out)');await navigateUI(page,'insights');await page.waitForSelector('#forecast-panel[data-mode=widget]');
  await page.locator('#ai-symbol').selectOption('NVDA');await page.waitForFunction(()=>!forecastLoading&&forecasts.NVDA?.status==='no_history');
  assert.equal(await page.locator('.forecast-widget').count(),1);assert.equal(await page.locator('.forecast-history-widget').count(),1);
  assert.equal((await config(page.locator('.forecast-widget'))).symbol,'NVDA');assert.equal((await config(page.locator('.forecast-widget'))).interval,'1W');
  assert.doesNotMatch(await page.locator('#forecast-panel').innerText(),/ยังไม่เชื่อมต่อแหล่ง|ความแม่นยำย้อนหลัง|ผ่านเกณฑ์ย้อนหลัง/);
  assert.match(await page.locator('#forecast-panel').innerText(),/TradingView.*ล่าช้า/s);
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('.topbar [data-theme-toggle]').click();
   await page.waitForFunction(theme=>JSON.parse(decodeURIComponent(new URL(document.querySelector('.forecast-widget').src).hash.slice(1))).colorTheme===theme,theme);
   assert.equal((await config(page.locator('.forecast-history-widget'))).colorTheme,theme);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#forecast-panel').scrollIntoViewIfNeeded();await page.screenshot({path:`${directory}/trend-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  for(const interval of ['1D','1W','1M']){
   await page.locator(`[data-forecast-interval="${interval}"]`).click();assert.equal((await config(page.locator('.forecast-widget'))).interval,interval);
   assert.equal(await page.locator(`[data-forecast-interval="${interval}"]`).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('.forecast-periods [aria-pressed=true]').count(),1);
   assert.equal(await page.locator(`[data-forecast-interval="${interval}"]`).evaluate(element=>document.activeElement===element),true);
  }
  await page.locator('#ai-symbol').selectOption('BRK.B');await page.waitForFunction(()=>!forecastLoading&&forecasts['BRK.B']);
  const settings=await config(page.locator('.forecast-widget'));assert.equal(settings.symbol,'BRK.B');assert.equal(settings.isTransparent,false);assert.ok(!JSON.stringify(settings).includes(account.email));
  assert.equal(await page.locator('.forecast-widget').getAttribute('referrerpolicy'),'origin');assert.match(await page.locator('.forecast-widget').getAttribute('sandbox'),/allow-scripts/);
  for(const status of ['error','stale','insufficient']){
   await page.route('**/api/forecast?**',route=>route.fulfill({json:{symbol:'BRK.B',status,configured:true,history:[]}}));
   await page.locator('[data-refresh-forecast]').click();await page.waitForFunction(status=>!forecastLoading&&forecasts['BRK.B']?.status===status,status);
   assert.equal(await page.locator('#forecast-panel[data-mode=widget]').count(),1);await page.unroute('**/api/forecast?**');
  }
  await page.locator('.forecast-widget').evaluate(element=>window.previousTrendFrame=element);
  await page.locator('[data-refresh-forecast]').click();await page.waitForFunction(()=>!forecastLoading&&forecasts['BRK.B']?.configured===false);
  assert.equal(await page.evaluate(()=>previousTrendFrame!==document.querySelector('.forecast-widget')&&!previousTrendFrame.isConnected),true);
  let entered,release;const ready=new Promise(resolve=>entered=resolve),gate=new Promise(resolve=>release=resolve);
  await page.route('**/api/forecast?**',async route=>{entered();await gate;await route.fulfill({json:{symbol:'BRK.B',status:'no_history',configured:false}});});
  await page.locator('[data-refresh-forecast]').click();await ready;await logoutUI(page);await page.waitForSelector('#login-form');release();await page.unrouteAll({behavior:'wait'});
  assert.equal(await page.locator('#main').innerHTML(),'');assert.equal(await page.locator('.forecast-widget,.forecast-history-widget').count(),0);assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: free trend/chart without a key, day/week/month controls, symbols, themes at 390/768/1440, fallback states, refresh and logout races.');
}finally{await browser.close();await server.shutdown();}
