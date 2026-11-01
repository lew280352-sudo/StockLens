import {chromium} from 'playwright';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
const artifacts=process.env.REFERENCE_ARTIFACT_DIR||'test-artifacts/reference-ui';mkdirSync(artifacts,{recursive:true});
const server=await createApp({databasePath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
async function settled(page){
 await page.waitForFunction(()=>{
  const screen=document.querySelector('#auth-screen'),form=screen.querySelector('.auth-panel').getBoundingClientRect(),panel=screen.querySelector('.auth-story').getBoundingClientRect();
  if(innerWidth<=700)return true;
  return screen.dataset.mode==='login'?form.right<=panel.left+1:panel.right<=form.left+1;
 });
}

async function readable(page,textSelector,surfaceSelector){
 return page.evaluate(({textSelector,surfaceSelector})=>{
  const channels=color=>(color.match(/[\d.]+/g)||[]).slice(0,3).map(Number);
  const luminance=color=>channels(color).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4).reduce((sum,n,i)=>sum+n*[.2126,.7152,.0722][i],0);
  const foreground=luminance(getComputedStyle(document.querySelector(textSelector)).color),background=luminance(getComputedStyle(document.querySelector(surfaceSelector)).backgroundColor);
  return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05)>=4.5;
 },{textSelector,surfaceSelector});
}

try{
 for(const width of [390,768,1440]){
  const page=await browser.newPage({viewport:{width,height:950}}),errors=[];page.setDefaultTimeout(6000);page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/news',r=>r.fulfill({json:{items:[{id:'ui-reference-news',symbol:'AAPL',title:'ข่าวทดสอบสำหรับตรวจหน้าจอ: เปิดอ่านหัวข้อพร้อมแหล่งข่าวและเวลาเผยแพร่',url:'https://www.apple.com/newsroom/',source:'แหล่งข่าวทดสอบ',sourceType:'company',publishedAt:new Date().toISOString()}],sources:[{name:'แหล่งข่าวทดสอบ',status:'ok',enabled:true,succeededAt:new Date().toISOString()}]}}));
  let releaseSession;const sessionGate=new Promise(resolve=>releaseSession=resolve);await page.route('**/api/session',async r=>{await sessionGate;await r.continue();});
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForSelector('.auth-content .muted');assert.equal(await readable(page,'.auth-content .muted','.auth-panel'),true,'loading message remains readable on the white form');releaseSession();await page.waitForSelector('.auth-shell');await page.waitForSelector('#register-form');await page.unroute('**/api/session');
  const email=`reference-${width}@example.com`,password='reference-ui-test-password';
  await page.locator('#register-form [name=email]').fill(email);await page.locator('[data-auth-mode=login]').first().click();await page.waitForSelector('#login-form');await settled(page);
  assert.equal(await page.locator('#login-form [name=email]').inputValue(),email,'switching mode retains the email');
  if(width>=768){const form=await page.locator('.auth-panel').boundingBox(),panel=await page.locator('.auth-story').boundingBox();assert.ok(form.x<panel.x,'login form leads and purple panel sits to its right');}
  await page.screenshot({path:`${artifacts}/login-${width}.png`,fullPage:true,animations:'disabled'});
  await page.locator('[data-auth-mode=register]').first().click();await settled(page);
  if(width>=768){const form=await page.locator('.auth-panel').boundingBox(),panel=await page.locator('.auth-story').boundingBox();assert.ok(panel.x<form.x,'registration moves the purple panel to the left');}
  assert.equal(await page.locator('#register-form [name=email]').inputValue(),email);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.screenshot({path:`${artifacts}/register-${width}.png`,fullPage:true,animations:'disabled'});
  await page.request.post(base+'/api/register',{headers:{Origin:base},data:{name:'บัญชีทดสอบ UI',email,password}});await page.locator('[data-auth-mode=login]').first().click();await page.locator('#login-form [name=password]').fill(password);await page.locator('#login-form [type=submit]').click();await page.waitForSelector('body:not(.signed-out)');
  assert.equal(await readable(page,'.breadcrumb b','body'),true,'current page breadcrumb remains readable on the dark frame');
  const dock=page.locator('.app-dock');assert.equal(await dock.isVisible(),true,'floating dock is available at every width');assert.equal(await dock.locator('button').count(),5);await dock.locator('[data-page=overview]').focus();await page.keyboard.press('ArrowRight');assert.equal(await dock.locator('[data-page=news]').evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');await page.waitForFunction(()=>location.hash==='#news');
  for(const destination of ['overview','news','following','insights']){
   await dock.locator(`[data-page=${destination}]`).click();await page.waitForFunction(route=>location.hash==='#'+route,destination);
   await page.waitForFunction(route=>{const d=document.querySelector('.app-dock'),button=d.querySelector(`[data-page="${route}"]`).getBoundingClientRect(),bead=d.querySelector('.dock-bead').getBoundingClientRect();return Math.abs(button.x+button.width/2-bead.x-bead.width/2)<2;},destination);
   const bounds=await dock.locator(`[data-page=${destination}]`).boundingBox(),bead=await dock.locator('.dock-bead').boundingBox();assert.ok(Math.abs((bounds.x+bounds.width/2)-(bead.x+bead.width/2))<2,'active bead tracks selected destination');assert.equal(await dock.locator(`[data-page=${destination}]`).getAttribute('aria-current'),'page');
  }
  await page.locator('[data-mobile-more]').click();await page.waitForSelector('#mobile-menu[open]');await page.keyboard.press('Escape');await page.waitForFunction(()=>document.activeElement?.hasAttribute('data-mobile-more'));
  for(const destination of ['search','alerts','sources']){await page.locator('[data-mobile-more]').click();await page.locator(`#mobile-menu [data-page=${destination}]`).click();await page.waitForFunction(()=>document.activeElement===document.querySelector('#main h1'));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  await dock.locator('[data-page=overview]').click();await page.waitForFunction(()=>{const d=document.querySelector('.app-dock'),button=d.querySelector('[data-page=overview]').getBoundingClientRect(),bead=d.querySelector('.dock-bead').getBoundingClientRect();return Math.abs(button.x+button.width/2-bead.x-bead.width/2)<1;});await page.screenshot({path:`${artifacts}/overview-${width}.png`,fullPage:true,animations:'disabled'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('[data-mobile-more]').click();await page.keyboard.press('Escape');assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: reference auth panel switching/email retention, floating five-button dock/bead, every route, keyboard and responsive layouts at 390/768/1440.');
}finally{await browser.close();await server.shutdown();}
