import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';
const paragraph='The full article explains that a laboratory will open in Cambridge in 2028. This body detail is absent from the headline. Researchers will publish information about energy efficiency and new engineering projects. ';
const html=`<html><head><title>Research announcement</title></head><body><article><h1>Research announcement</h1>${`<p>${paragraph}</p>`.repeat(5)}</article></body></html>`;
const news=async()=>new Response(`<rss><channel><item><title>Company announcement</title><link>https://www.apple.com/newsroom/article-body-test</link><pubDate>${new Date().toUTCString()}</pubDate></item></channel></rss>`);
const result={title:'สรุปเนื้อหาบทความ',summary:'มีแผนเปิดห้องวิจัยใน Cambridge ปี 2028',facts:['ห้องวิจัยอยู่ที่ Cambridge'],positiveFactors:[],risks:[],unknowns:[],confidence:'low'};
async function setup(t,options={}){
  const server=await createApp({databasePath:':memory:',aiEnabled:true,newsFetcher:news,articleFetcher:async()=>new Response(html,{headers:{'Content-Type':'text/html'}}),aiFetcher:async(url,options)=>Response.json({message:{content:JSON.stringify(result)}}),...options});
  server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.shutdown());
  const origin=`http://127.0.0.1:${server.address().port}`;
  const call=async(path,{cookie,data,method=data?'POST':'GET'}={})=>{const response=await fetch(origin+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:data?JSON.stringify(data):undefined});return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};};
  const account=async email=>{const data={name:'Article tester',email,password:'article-test-password'};await call('/api/register',{data});return call('/api/login',{data});};
  return {call,account};
}

test('article summary authenticates, uses enabled-source IDs and sends body text to AI without returning the article',async t=>{
  let reads=0,models=0;
  const {call,account}=await setup(t,{articleFetcher:async()=>{reads++;return new Response(html,{headers:{'Content-Type':'text/html'}});},aiFetcher:async(url,options)=>{models++;const input=JSON.parse(JSON.parse(options.body).messages[1].content);assert.match(input.content,/Cambridge in 2028/);assert.equal(input.article.title,'Company announcement');return Response.json({message:{content:JSON.stringify(result)}});}});
  assert.equal((await call('/api/ai/article',{data:{articleId:'a'.repeat(24)}})).status,401);
  const first=await account('article-first@example.com'),second=await account('article-second@example.com');
  const snapshot=await call('/api/news',{cookie:first.cookie}),item=snapshot.body.items[0];assert.equal(item.bodySupported,true);
  const state=structuredClone(second.body.state);state.sources.forEach(source=>source.enabled=false);
  assert.equal((await call('/api/state',{method:'PUT',cookie:second.cookie,data:{state,userId:second.body.user.id,revision:second.body.revision}})).status,200);
  assert.equal((await call('/api/ai/article',{cookie:second.cookie,data:{articleId:item.id}})).status,409);assert.equal(reads,0);
  assert.equal((await call('/api/ai/article',{cookie:first.cookie,data:{url:'http://localhost/private'}})).status,400);assert.equal(reads,0);
  const summary=await call('/api/ai/article',{cookie:first.cookie,data:{articleId:item.id}});assert.equal(summary.status,200);assert.equal(summary.body.input,'article');assert.match(summary.body.summary,/Cambridge/);assert.equal(summary.body.article.coverage,'complete');assert.doesNotMatch(JSON.stringify(summary.body),/This body detail|<article>/);
  assert.equal((await call('/api/ai/article',{cookie:first.cookie,data:{articleId:item.id}})).body.cached,true);assert.equal(reads,1);assert.equal(models,1);
});

test('article reader rechecks logout and source changes before invoking a model',async t=>{
  for(const change of ['logout','source','delete']){
    let release,entered,modelCalls=0;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
    const {call,account}=await setup(t,{articleFetcher:async()=>{entered();await gate;return new Response(html,{headers:{'Content-Type':'text/html'}});},aiFetcher:async()=>{modelCalls++;return Response.json({message:{content:JSON.stringify(result)}});}});
    const user=await account(`article-race-${change}@example.com`),cookie=user.cookie,feed=await call('/api/news',{cookie});
    const pending=call('/api/ai/article',{cookie,data:{articleId:feed.body.items[0].id}});await ready;
    try{
      if(change==='logout')await call('/api/logout',{cookie,data:{}});
      else if(change==='delete')await call('/api/account/delete',{cookie,data:{password:'article-test-password',confirm:user.body.user.email}});
      else{const state=structuredClone(user.body.state);state.sources.forEach(source=>source.enabled=false);await call('/api/state',{cookie,method:'PUT',data:{state,userId:user.body.user.id,revision:user.body.revision}});}
    }finally{release();}
    assert.equal((await pending).status,change==='source'?409:401);assert.equal(modelCalls,0);
  }
});

test('unreadable content fails explicitly instead of silently summarizing the headline',async t=>{
  const {call,account}=await setup(t,{articleFetcher:async()=>new Response('blocked',{status:403})});
  const user=await account('article-blocked@example.com'),feed=await call('/api/news',{cookie:user.cookie});
  const summary=await call('/api/ai/article',{cookie:user.cookie,data:{articleId:feed.body.items[0].id}});assert.equal(summary.status,422);assert.match(summary.body.error,/ไม่เปิดให้อ่าน/);assert.equal(summary.body.provider,undefined);
});
