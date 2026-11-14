import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {navigateUI,logoutUI} from './navigation.mjs';

const artifacts=process.env.QUOTE_ARTIFACT_DIR||'test-artifacts/quotes';mkdirSync(artifacts,{recursive:true});
const server=await createApp({databasePath:':memory:',newsFetcher:async()=>new Response('<rss><channel></channel></rss>')});
server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const widgetOrigin='https://www.tradingview-widget.com';
const fixture=`<!doctype html><html><head><style>body{font:14px Arial;margin:12px}article{display:flex;justify-content:space-between;padding:16px 0;border-bottom:1px solid #888}small{display:block;margin-top:8px}</style></head><body><b>TradingView test fixture · delayed data</b><div id="symbols"></div><script>const settings=JSON.parse(decodeURIComponent(location.hash.slice(1)));document.body.style.color=settings.colorTheme==='dark'?'#f1edf7':'#292234';document.body.style.backgroundColor=settings.backgroundColor;for(const item of settings.symbolsGroups[0].symbols){const row=document.createElement('article'),name=document.createElement('span'),price=document.createElement('span');name.textContent=item.displayName;price.textContent='162.85 USD · D';row.append(name,price);document.querySelector('#symbols').append(row);}</script></body></html>`;
const settingsFor=async page=>JSON.parse(decodeURIComponent(new URL(await page.locator('.quote-widget').getAttribute('src')).hash.slice(1)));
try{
 for(const width of [390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  let widgetLoads=0;await context.route(widgetOrigin+'/**',async route=>{widgetLoads++;await route.fulfill({contentType:'text/html',body:fixture});});
  const account={name:'Price widget test',email:`prices-${width}@example.com`,password:'quotes-browser-password'};
  assert.equal((await context.request.post(base+'/api/register',{headers:{Origin:base},data:account})).status(),201);
  const login=await(await context.request.post(base+'/api/login',{headers:{Origin:base},data:account})).json();
  await page.goto(base);await page.waitForSelector('body:not(.signed-out)');await page.waitForFunction(()=>!quoteBusy);
  assert.equal(await page.locator('.quote-widget').count(),0,'an empty watchlist never contacts the provider');assert.equal(widgetLoads,0);
  const state=structuredClone(login.state);state.watchlist=['NVDA','BRK.B'];
  assert.equal((await context.request.put(base+'/api/state',{headers:{Origin:base},data:{userId:login.user.id,revision:login.revision,state}})).status(),200);
  await page.reload();await page.waitForFunction(()=>!quoteBusy&&quoteData.configured===false);await navigateUI(page,'following');
  await page.locator('#quotes-panel').scrollIntoViewIfNeeded();
  assert.equal((await context.request.get(base+'/api/quotes')).status(),200);
  const policy=(await context.request.get(base+'/')).headers()['content-security-policy'];assert.match(policy,/script-src 'self';/);assert.match(policy,/frame-src https:\/\/www\.tradingview-widget\.com;/);
  const iframe=page.locator('.quote-widget');assert.equal(await iframe.getAttribute('referrerpolicy'),'origin');assert.match(await iframe.getAttribute('sandbox'),/allow-scripts/);
  let settings=await settingsFor(page);assert.deepEqual(settings.symbolsGroups[0].symbols.map(s=>s.name),['NVDA','BRK.B']);assert.ok(!JSON.stringify(settings).includes(account.email));
  assert.doesNotMatch(await page.locator('#quotes-panel').innerText(),/ยังไม่เชื่อมต่อบริการราคา/);
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('.topbar [data-theme-toggle]').click();
   await page.waitForFunction(theme=>JSON.parse(decodeURIComponent(new URL(document.querySelector('.quote-widget').src).hash.slice(1))).colorTheme===theme,theme);
   await page.frameLocator('.quote-widget').getByText('NVDA · NVIDIA',{exact:true}).waitFor();assert.equal((await settingsFor(page)).backgroundColor,theme==='light'?'#ffffff':'#211b2c');
   assert.match(await page.locator('#quotes-panel').innerText(),/ข้อมูลล่าช้า/);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`${artifacts}/free-prices-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  const before=await iframe.getAttribute('src');await page.locator('[data-refresh-quotes]').click();await page.waitForFunction(()=>!quoteBusy);assert.equal(await iframe.getAttribute('src'),before,'refresh retains the selected provider settings');
  const session=await(await context.request.get(base+'/api/session')).json();session.state.watchlist=['MSFT'];await context.request.put(base+'/api/state',{headers:{Origin:base},data:{userId:session.user.id,revision:session.revision,state:session.state}});await page.reload();await page.waitForFunction(()=>!quoteBusy&&quoteData.configured===false);await page.locator('#quotes-panel').scrollIntoViewIfNeeded();settings=await settingsFor(page);assert.deepEqual(settings.symbolsGroups[0].symbols.map(s=>s.name),['MSFT']);
  let release,entered;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
  await page.route('**/api/quotes',async route=>{entered();await gate;await route.fulfill({json:{configured:false,items:[]}});});
  await page.locator('[data-refresh-quotes]').click();await ready;await logoutUI(page);await page.waitForSelector('#login-form');release();await page.unrouteAll({behavior:'wait'});
  assert.equal(await page.locator('.quote-widget').count(),0);assert.equal(await page.locator('#main').innerHTML(),'');assert.deepEqual(errors,[]);await context.close();
 }
 // Explicit provider failure retains the direct source links; partial native quotes remain available.
 const context=await browser.newContext(),page=await context.newPage(),account={name:'Quote fallbacks',email:'quote-fallbacks@example.com',password:'quotes-browser-password'};
 await context.request.post(base+'/api/register',{headers:{Origin:base},data:account});const login=await(await context.request.post(base+'/api/login',{headers:{Origin:base},data:account})).json();login.state.watchlist=['NVDA','MSFT'];await context.request.put(base+'/api/state',{headers:{Origin:base},data:{userId:login.user.id,revision:login.revision,state:login.state}});
 await context.route(widgetOrigin+'/**',route=>route.abort());
 await page.route('**/api/quotes',route=>route.fulfill({json:{configured:true,items:[{symbol:'NVDA',quote:{price:100.25,currency:'USD',quoteAt:new Date().toISOString(),fetchedAt:new Date().toISOString(),provider:'Finnhub'}},{symbol:'MSFT',quote:null,error:'ยังไม่มีราคาที่ตรวจสอบได้',stale:true}]}}));
 await page.goto(base);await page.waitForFunction(()=>!quoteBusy&&quoteData.configured===true);assert.match(await page.locator('#quotes-panel').innerText(),/\$100.25/);assert.equal(await page.locator('.quote-widget').count(),0);
 await page.locator('[data-free-quotes]').click();assert.equal(await page.locator('.quote-widget').count(),1);await page.locator('.quote-links summary').click();assert.equal(await page.locator('.quote-links a').count(),2);assert.equal(await page.locator('.quote-links a').first().getAttribute('href'),'https://www.tradingview.com/symbols/NVDA/');
 await context.close();
 console.log('PASS: free embedded prices without a key, delayed/source disclosure, curated watchlist only, responsive themes, refresh, source links, native partial data and late-response logout privacy.');
}finally{await browser.close();await server.shutdown();}
