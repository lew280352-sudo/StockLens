import assert from 'node:assert/strict';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createApp} from '../server.mjs';
import {navigateUI} from './navigation.mjs';

const artifacts=process.env.PASSWORD_ARTIFACT_DIR||'test-artifacts/password-input';mkdirSync(artifacts,{recursive:true});
const server=await createApp({databasePath:':memory:',newsFetcher:async()=>new Response('<rss><channel></channel></rss>')});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
const warningFor=input=>input.locator('xpath=ancestor::label').locator('.password-character-error');
async function paste(input,text){return input.evaluate((element,text)=>{const data=new DataTransfer();data.setData('text/plain',text);return element.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));},text);}

try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:950}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.goto(base);await page.waitForSelector('#register-form');
  let input=page.locator('#auth-password'),warning=warningFor(input);
  await input.fill('Safe-Pass-123!');await page.keyboard.insertText('ภาษาไทย');
  assert.equal(await input.inputValue(),'Safe-Pass-123!');assert.equal(await warning.isVisible(),true);
  assert.equal(await input.getAttribute('aria-invalid'),'true');assert.ok((await input.getAttribute('aria-describedby')).includes(await warning.getAttribute('id')));
  for(const theme of ['light','dark']){
   if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('[data-theme-toggle]').first().click();
   const color=await warning.evaluate(element=>getComputedStyle(element).color);assert.ok(color==='rgb(172, 35, 64)'||color==='rgb(255, 180, 197)',color);
   const field=await input.boundingBox(),message=await warning.boundingBox();assert.ok(message.y>=field.y+field.height,'the red warning sits below the password');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.screenshot({path:`${artifacts}/password-${theme}-${width}.png`,fullPage:true,animations:'disabled'});
  }
  await input.fill('Good-Password-1!');assert.equal(await warning.isVisible(),false);assert.equal(await input.getAttribute('aria-invalid'),null);
  for(const text of ['abc中文123!','пароль123!','café-password','１２３４５','😀']){
   assert.equal(await paste(input,text),false,'an unsupported paste is canceled');assert.equal(await input.inputValue(),'Good-Password-1!');assert.equal(await warning.isVisible(),true);
   await input.fill('Good-Password-1!');assert.equal(await warning.isVisible(),false);
  }
  await page.locator('[data-password-toggle=auth-password]').click();assert.equal(await input.getAttribute('type'),'text');
  await input.focus();await page.keyboard.insertText('ญ');assert.equal(await input.inputValue(),'Good-Password-1!');assert.equal(await warning.isVisible(),true);
  const symbols=Array.from({length:95},(_,i)=>String.fromCharCode(i+32)).join('');
  await input.fill(symbols);assert.equal(await input.inputValue(),symbols);assert.equal(await warning.isVisible(),false,'ASCII symbols and digits remain usable');
  await input.fill('IME-Test-123!');await input.evaluate(element=>{
   element.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true}));element.value+='ไทย';
   element.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertCompositionText',data:'ไทย',isComposing:true}));
   element.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'ไทย'}));
  });assert.equal(await input.inputValue(),'IME-Test-123!');assert.equal(await warning.isVisible(),true,'an IME rejection keeps the inline warning');
  await input.fill('Autofill-Test-1!');await input.evaluate(element=>{element.value='Autofill-ไทย-123';element.dispatchEvent(new Event('input',{bubbles:true}));});
  assert.equal(await input.inputValue(),'Autofill-Test-1!');assert.equal(await warning.isVisible(),true);
  const confirm=page.locator('#auth-confirm');await confirm.fill('Confirm-Test-123!');await page.keyboard.insertText('中文');assert.equal(await confirm.inputValue(),'Confirm-Test-123!');assert.equal(await warningFor(confirm).isVisible(),true);
  await page.locator('[data-auth-mode=login]').first().click();input=page.locator('#auth-password');warning=warningFor(input);
  const account={name:'Password browser',email:`password-ui-${width}@example.com`,password:'Valid-Password-123!'};
  assert.equal((await context.request.post(base+'/api/register',{headers:{Origin:base},data:account})).status(),201);
  await page.locator('#login-form [name=email]').fill(account.email);await input.fill(account.password);
  let logins=0;page.on('request',request=>{if(new URL(request.url()).pathname==='/api/login')logins++;});
  await input.evaluate(element=>{element.value='Bypass-ไทย-123!';element.form.requestSubmit();});
  assert.equal(await input.inputValue(),account.password);assert.equal(logins,0,'submission also catches a password changed without an input event');
  await input.fill(account.password);await page.keyboard.insertText('ไทย');
  await page.locator('#login-form [type=submit]').click();assert.equal(logins,0,'rejected input needs correction before submission');
  await input.fill(account.password);await page.locator('#login-form [type=submit]').click();await page.waitForFunction(()=>location.hash==='#overview'&&!document.body.classList.contains('signed-out'));
  await navigateUI(page,'alerts');await page.waitForSelector('[data-security-delete]');await page.locator('[data-security-delete]').click();
  const securityPassword=page.locator('#account-delete-form [name=password]');await securityPassword.fill('Confirm-Password-123!');await page.keyboard.insertText('ไทย');assert.equal(await warningFor(securityPassword).isVisible(),true);assert.equal(await securityPassword.inputValue(),'Confirm-Password-123!');
  await page.locator('#close-modal').click();await navigateUI(page,'account');await page.locator('#profile-logout').click();await page.waitForSelector('#login-form');
  await page.locator('[data-recover]').click();
  for(const name of ['password','confirm']){const field=page.locator(`#recover-form [name=${name}]`);await field.fill('Recovery-Password-123!');await page.keyboard.insertText('ไทย');assert.equal(await field.inputValue(),'Recovery-Password-123!');assert.equal(await warningFor(field).isVisible(),true);}
  assert.deepEqual(errors,[]);await context.close();
 }
 console.log('PASS: English/digits/ASCII symbols, rejected typing/paste/IME/autofill, visible-password and confirmation fields, red inline warnings in both themes, blocked submission until correction, recovery/security forms and direct first sign-in.');
}finally{await browser.close();await server.shutdown();}
