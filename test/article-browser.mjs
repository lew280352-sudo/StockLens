import {chromium} from 'playwright';
import {once} from 'node:events';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {createApp} from '../server.mjs';
import {feeds} from '../feeds.mjs';
import {navigateUI,skipFirstUse,logoutUI} from './navigation.mjs';
const directory=process.env.ARTICLE_ARTIFACT_DIR||'test-artifacts/article-ui';mkdirSync(directory,{recursive:true});
const paragraph='The article describes a research laboratory in Cambridge opening in 2028. Researchers will study energy efficiency and publish their findings. These details appear only in the article body. ';
let blocked=true;
const server=await createApp({databasePath:':memory:',aiEnabled:true,
  newsFetcher:async url=>{const feed=feeds.find(feed=>feed.feedUrl===url);return new Response(`<rss><channel><item><title>Company announcement</title><link>${feed.url}news/article</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);},
  articleFetcher:async url=>url.includes('nvidia')&&blocked?new Response('blocked',{status:403}):new Response(`<html><head><title>Article</title></head><body><article><h1>Research news</h1>${`<p>${paragraph}</p>`.repeat(url.includes('nvidia')?150:5)}</article></body></html>`,{headers:{'Content-Type':'text/html'}}),
  aiFetcher:async(url,options)=>{if(url.endsWith('/api/tags'))return Response.json({models:[{name:'qwen3:8b'}]});const body=JSON.parse(options.body),input=JSON.parse(body.messages[1].content);assert.match(input.content,/Cambridge/);return Response.json({message:{content:JSON.stringify(body.format.properties.answer?{answer:'ห้องวิจัยใน Cambridge จะเปิดปี 2028',supported:true,sourceIds:[input.article.id]}:{title:'สรุปเนื้อหาจากบทความ',summary:'มีแผนเปิดห้องวิจัย Cambridge ในปี 2028',facts:['ข้อมูลห้องวิจัยมาจากเนื้อหาบทความ'],positiveFactors:[],risks:[],unknowns:[],confidence:'low'})}});}
});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`,browser=await chromium.launch();
async function signedIn(context,suffix){const account={name:'Article UI test',email:`article-ui-${suffix}@example.com`,password:'article-ui-test-password'};await context.request.post(origin+'/api/register',{headers:{Origin:origin},data:account});await context.request.post(origin+'/api/login',{headers:{Origin:origin},data:account});const page=await context.newPage();await page.goto(origin);await skipFirstUse(page);await navigateUI(page,'insights');await page.waitForFunction(()=>aiStatus.available&&newsData.items.some(item=>item.bodySupported));return page;}
try{
  for(const width of [390,768,1440]){
    const context=await browser.newContext({viewport:{width,height:950}}),page=await signedIn(context,String(width)),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.locator('[data-article-summary]').click();await page.waitForSelector('.article-summary');assert.match(await page.locator('.article-summary').innerText(),/Cambridge/);assert.match(await page.locator('.article-summary .counter').innerText(),/อ่านเนื้อหาแล้ว/);assert.equal(await page.locator('.article-citation a').count(),1);
    assert.equal(await page.locator('.ai-card,.ai-free-search').count(),0);await page.locator('#article-question').fill('ห้องวิจัยจะเปิดที่ไหนและเมื่อไร?');await page.locator('#article-question-form button').click();await page.waitForSelector('.article-qa .ai-answer');assert.match(await page.locator('.article-qa .ai-answer').innerText(),/Cambridge/);assert.equal(await page.locator('.article-qa .ai-answer-sources a').count(),1);
    for(const theme of ['light','dark']){if(await page.locator('html').getAttribute('data-theme')!==theme)await page.locator('.topbar [data-theme-toggle]').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.locator('#article-card').evaluate(element=>element.scrollIntoView({block:'start'}));await page.screenshot({path:`${directory}/article-${theme}-${width}.png`,fullPage:true,animations:'disabled'});}
    await navigateUI(page,'news');await page.locator('.news-card').filter({hasText:'AAPL'}).locator('[data-read-article]').click();await page.waitForSelector('.article-summary');assert.equal(await page.locator('#ai-symbol').inputValue(),'AAPL');assert.deepEqual(errors,[]);await context.close();
  }
  const context=await browser.newContext(),page=await signedIn(context,'errors');
  await page.locator('#ai-symbol').selectOption('NVDA');await page.locator('[data-article-summary]').click();await page.waitForSelector('.article-card .form-error');assert.match(await page.locator('.article-card .form-error').innerText(),/ไม่เปิดให้อ่าน/);assert.equal(await page.locator('.article-summary').count(),0);
  blocked=false;await page.locator('[data-article-summary]').click();await page.waitForSelector('.article-summary');assert.match(await page.locator('.article-summary .counter').innerText(),/อ่านบางส่วน/);assert.match(await page.locator('.article-summary .info-box').innerText(),/บางส่วน/);
  let release,entered;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
  await page.route('**/api/ai/article',async route=>{entered();await gate;await route.fulfill({json:{input:'article',title:'PRIVATE OLD ARTICLE',summary:'PRIVATE OLD ARTICLE',article:{coverage:'complete',url:'https://www.apple.com/newsroom/test'},facts:[],positiveFactors:[],risks:[],unknowns:[]}});});
  await page.locator('[data-article-summary]').click();await ready;assert.equal(await page.locator('[data-ai-summary]').isDisabled(),true);await logoutUI(page);await page.waitForSelector('#login-form');release();await page.unrouteAll({behavior:'wait'});assert.equal(await page.locator('#main').innerHTML(),'');assert.equal(await page.getByText('PRIVATE OLD ARTICLE').count(),0);await context.close();
  const questionContext=await browser.newContext(),questionPage=await signedIn(questionContext,'question-race');
  let releaseQuestion,enteredQuestion;const questionGate=new Promise(resolve=>releaseQuestion=resolve),questionReady=new Promise(resolve=>enteredQuestion=resolve);
  await questionPage.route('**/api/ai/article/ask',async route=>{enteredQuestion();await questionGate;await route.fulfill({json:{question:'PRIVATE DRAFT',answer:'PRIVATE LATE ANSWER',sources:[],answeredAt:new Date().toISOString()}});});
  await questionPage.locator('#article-question').fill('PRIVATE DRAFT');await questionPage.locator('#article-question-form button').click();await questionReady;await logoutUI(questionPage);await questionPage.waitForSelector('#login-form');releaseQuestion();await questionPage.unrouteAll({behavior:'wait'});assert.equal(await questionPage.locator('#main').innerHTML(),'');assert.equal(await questionPage.getByText('PRIVATE LATE ANSWER').count(),0);await questionContext.close();
  console.log('PASS: article body summary/source, news entry action, partial/blocked states, both themes at 390/768/1440 and delayed results after logout.');
}finally{await browser.close();await server.shutdown();}
