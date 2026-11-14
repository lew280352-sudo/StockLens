import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {navigateUI,logoutUI} from './navigation.mjs';

const artifacts=process.env.COMPARISON_ARTIFACT_DIR||'test-artifacts/quote-comparison';mkdirSync(artifacts,{recursive:true});
const server=await createApp({databasePath:':memory:',quoteApiKey:'fixture',quoteFetcher:async url=>Response.json({c:url.endsWith('NVDA')?100:200,pc:url.endsWith('NVDA')?125:160,t:Math.floor(Date.now()/1000)}),newsFetcher:async url=>url.includes('finnhub')?Response.json([]):new Response('<rss><channel></channel></rss>')});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const ranges={'1d':'1d|1','1w':'1w|15','1m':'1m|30','3m':'3m|60','6m':'6m|120','1y':'12m|1D'};
const fixture=`<!doctype html><html><head><style>body{font:15px Arial;padding:16px;margin:0}h2{font-size:20px}#change{font-size:25px}.chart{height:200px;margin-top:20px;border-bottom:2px solid #91b949;display:flex;align-items:center}</style></head><body><h2>TradingView comparison test fixture</h2><p id="symbol"></p><p id="period"></p><p id="change"></p><div class="chart">Fixture chart with provider date labels</div><script>const settings=JSON.parse(decodeURIComponent(location.hash.slice(1)));document.body.style.background=settings.backgroundColor;document.body.style.color=settings.colorTheme==='dark'?'#f1edf7':'#292234';document.querySelector('#symbol').textContent=settings.symbols?.[0][1]||'market quotes';document.querySelector('#period').textContent=settings.dateRanges?.[0]||'';document.querySelector('#change').textContent='+12.50 USD (+8.33%) · '+(settings.dateRanges?.[0]||'');</script></body></html>`;
const chartSettings=async page=>JSON.parse(decodeURIComponent(new URL(await page.locator('.quote-comparison-widget').getAttribute('src')).hash.slice(1)));
async function seed(context,email,symbols){const data={name:'Comparison user',email,password:'comparison-browser-password'};await context.request.post(base+'/api/register',{headers:{Origin:base},data});const login=await(await context.request.post(base+'/api/login',{headers:{Origin:base},data})).json();login.state.watchlist=symbols;assert.equal((await context.request.put(base+'/api/state',{headers:{Origin:base},data:{userId:login.user.id,revision:login.revision,state:login.state}})).status(),200);return data;}

try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  let widgetLoads=0;await context.route('https://www.tradingview-widget.com/**',async route=>{widgetLoads++;await route.fulfill({contentType:'text/html',body:fixture});});
  const account=await seed(context,`comparison-${width}@example.com`,['AAPL','NVDA']);
  await page.goto(base+'/#following');await page.waitForFunction(()=>!quoteBusy&&quoteData.items.length===2);
  assert.match(await page.locator('.quote-day-change.positive').innerText(),/\+\$40\.00\s+\+25\.00%/);
  assert.match(await page.locator('.quote-day-change.negative').innerText(),/−\$25\.00\s+−20\.00%/);
  assert.equal(await page.locator('.quote-comparison-widget').count(),0);assert.equal(widgetLoads,0,'historical charts load only when requested');
  await page.locator('[data-toggle-quote-comparison]').click();await page.waitForSelector('#quote-comparison:visible');
  assert.equal(await page.locator('#quote-comparison-symbol option').count(),2);
  for(const [period,range] of Object.entries(ranges)){
   await page.locator(`[data-quote-period="${period}"]`).click();
   const settings=await chartSettings(page);assert.deepEqual(settings.dateRanges,[range]);assert.equal(settings.changeMode,'price-and-percent');assert.equal(settings.hideDateRanges,true);assert.equal(settings.symbols[0][1],'AAPL|1D');assert.ok(!JSON.stringify(settings).includes(account.email));
   await page.frameLocator('.quote-comparison-widget').getByText(range,{exact:true}).waitFor();
   assert.equal(await page.locator('.quote-periods [aria-pressed=true]').count(),1);
   assert.equal(await page.locator(`[data-quote-period="${period}"]`).evaluate(element=>element===document.activeElement),true,'period changes retain keyboard focus');
  }
  await page.locator('#quote-comparison-symbol').selectOption('NVDA');assert.equal((await chartSettings(page)).symbols[0][1],'NVDA|1D');
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('.topbar [data-theme-toggle]').click();
   await page.waitForFunction(theme=>JSON.parse(decodeURIComponent(new URL(document.querySelector('.quote-comparison-widget').src).hash.slice(1))).colorTheme===theme,theme);
   await page.frameLocator('.quote-comparison-widget').getByText('12m|1D',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#quotes-panel .table-wrap').evaluate(element=>element.scrollWidth<=element.clientWidth),true);
   await page.screenshot({path:`${artifacts}/comparison-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await page.locator('[data-toggle-quote-comparison]').click();assert.equal(await page.locator('.quote-comparison-widget').count(),0);assert.equal(await page.locator('[data-toggle-quote-comparison]').getAttribute('aria-expanded'),'false');
  await page.locator('[data-toggle-quote-comparison]').click();assert.deepEqual((await chartSettings(page)).dateRanges,['12m|1D']);
  await page.locator('[data-unfollow=NVDA]').click();await page.locator('[data-confirm-unfollow=NVDA]').click();await page.waitForFunction(()=>!document.querySelector('#modal').open);assert.equal((await chartSettings(page)).symbols[0][1],'AAPL|1D','removing the selected company switches to a followed company');
  let release,entered;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
  await page.route('**/api/quotes',async route=>{entered();await gate;await route.fulfill({json:{configured:true,items:[]}});});
  await page.locator('[data-refresh-quotes]').click();await ready;await logoutUI(page);await page.waitForSelector('#login-form');release();await page.unrouteAll({behavior:'wait'});assert.equal(await page.locator('#main iframe').count(),0);assert.equal(await page.locator('#main').innerHTML(),'');
  const next=await seed(context,`comparison-next-${width}@example.com`,['MSFT']);await page.locator('#login-form [name=email]').fill(next.email);await page.locator('#login-form [name=password]').fill(next.password);await page.locator('#login-form [type=submit]').click();await page.waitForSelector('body:not(.signed-out)');await navigateUI(page,'following');await page.waitForFunction(()=>!quoteBusy&&quoteData.items.length===1);assert.equal(await page.locator('.quote-comparison-widget').count(),0);await page.locator('[data-toggle-quote-comparison]').click();assert.equal((await chartSettings(page)).symbols[0][1],'MSFT|1D');assert.deepEqual((await chartSettings(page)).dateRanges,['1d|1'],'comparison preferences reset between accounts');
  assert.deepEqual(errors,[]);await context.close();
 }
 const context=await browser.newContext(),page=await context.newPage();await seed(context,'comparison-free@example.com',['NVDA']);await context.route('https://www.tradingview-widget.com/**',route=>route.fulfill({contentType:'text/html',body:fixture}));await page.route('**/api/quotes',route=>route.fulfill({json:{configured:false,items:[]}}));await page.goto(base+'/#following');await page.waitForFunction(()=>!quoteBusy&&quoteData.configured===false);await page.locator('[data-toggle-quote-comparison]').click();await page.locator('[data-quote-period="6m"]').click();assert.deepEqual((await chartSettings(page)).dateRanges,['6m|120']);await context.close();
 console.log('PASS: provider previous-close delta, six historical ranges, followed symbols, theme/responsive layout, keyboard focus, close/reopen, no-key charts and cross-account/logout privacy.');
}finally{await browser.close();await server.shutdown();}
