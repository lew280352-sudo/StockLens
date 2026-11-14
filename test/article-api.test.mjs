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

test('article summary and questions recheck logout and source changes before invoking a model',async t=>{
  for(const route of ['/api/ai/article','/api/ai/article/ask'])for(const change of ['logout','source','delete']){
    let release,entered,modelCalls=0;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);
    const {call,account}=await setup(t,{articleFetcher:async()=>{entered();await gate;return new Response(html,{headers:{'Content-Type':'text/html'}});},aiFetcher:async()=>{modelCalls++;return Response.json({message:{content:JSON.stringify(result)}});}});
    const user=await account(`article-race-${change}@example.com`),cookie=user.cookie,feed=await call('/api/news',{cookie});
    const pending=call(route,{cookie,data:{articleId:feed.body.items[0].id,question:'บทความนี้ระบุข้อมูลอะไรบ้าง?'}});await ready;
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
  for(const route of ['/api/ai/article','/api/ai/article/ask']){const summary=await call(route,{cookie:user.cookie,data:{articleId:feed.body.items[0].id,question:'บทความระบุเรื่องอะไรบ้าง?'}});assert.equal(summary.status,422);assert.match(summary.body.error,/ไม่เปิดให้อ่าน/);assert.equal(summary.body.provider,undefined);}
});

test('article fetch failures expose a safe stage without upstream exception details',async t=>{
  const {call,account}=await setup(t,{articleFetcher:async()=>{throw Error('private upstream exception');}});
  const user=await account('article-unavailable@example.com'),feed=await call('/api/news',{cookie:user.cookie});
  const summary=await call('/api/ai/article',{cookie:user.cookie,data:{articleId:feed.body.items[0].id}});
  assert.equal(summary.status,503);assert.equal(summary.body.code,'article_unavailable');assert.equal(summary.body.stage,'fetch');assert.doesNotMatch(JSON.stringify(summary.body),/private upstream/);
});

test('article questions use the selected body, validate input and cite only the authorized article',async t=>{
  let reads=0,models=0;
  const {call,account}=await setup(t,{articleFetcher:async()=>{reads++;return new Response(html,{headers:{'Content-Type':'text/html'}});},aiFetcher:async(url,options)=>{
    models++;const input=JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.match(input.content,/Cambridge in 2028/);assert.equal(input.question,'ห้องวิจัยจะเปิดที่ไหนและเมื่อไร?');assert.equal(input.article.title,'Company announcement');
    return Response.json({message:{content:JSON.stringify({answer:'ห้องวิจัยจะเปิดใน Cambridge ปี 2028',supported:true,sourceIds:[input.article.id,'forged-source']})}});
  }});
  const route='/api/ai/article/ask',question='ห้องวิจัยจะเปิดที่ไหนและเมื่อไร?';
  assert.equal((await call(route,{data:{articleId:'a'.repeat(24),question}})).status,401);
  const user=await account('article-question@example.com'),other=await account('article-question-other@example.com');
  const feed=await call('/api/news',{cookie:user.cookie}),item=feed.body.items[0];
  for(const data of [{articleId:item.id,question:'x'},{articleId:item.id,question:'x'.repeat(301)},{url:item.url,question}])assert.equal((await call(route,{cookie:user.cookie,data})).status,400);
  const state=structuredClone(other.body.state);state.sources.forEach(source=>source.enabled=false);
  await call('/api/state',{cookie:other.cookie,method:'PUT',data:{state,userId:other.body.user.id,revision:other.body.revision}});
  assert.equal((await call(route,{cookie:other.cookie,data:{articleId:item.id,question}})).status,409);assert.equal(reads,0);
  const answer=await call(route,{cookie:user.cookie,data:{articleId:item.id,question}});
  assert.equal(answer.status,200);assert.equal(answer.body.input,'article');assert.equal(answer.body.supported,true);assert.match(answer.body.answer,/Cambridge/);
  assert.equal(answer.body.sources.length,1);assert.equal(answer.body.sources[0].id,item.id);assert.equal(answer.body.article.coverage,'complete');assert.equal(reads,1);assert.equal(models,1);
  assert.doesNotMatch(JSON.stringify(answer.body),/This body detail|<article>|forged-source/);
});

test('article answers with forged citations are unsupported and late source changes do not return an answer',async t=>{
  let release,entered;const gate=new Promise(resolve=>release=resolve),ready=new Promise(resolve=>entered=resolve);let calls=0;
  const {call,account}=await setup(t,{aiFetcher:async(url,options)=>{
    const input=JSON.parse(JSON.parse(options.body).messages[1].content);calls++;
    if(calls===2){entered();await gate;}
    return Response.json({message:{content:JSON.stringify({answer:'UNVERIFIED ANSWER',supported:true,sourceIds:calls===1?['forged-source']:[input.article.id]})}});
  }});
  const user=await account('article-question-late@example.com'),cookie=user.cookie,feed=await call('/api/news',{cookie}),data={articleId:feed.body.items[0].id,question:'ขอข้อมูลที่บทความระบุได้ไหม?'};
  const unsupported=await call('/api/ai/article/ask',{cookie,data});assert.equal(unsupported.status,200);assert.equal(unsupported.body.supported,false);assert.deepEqual(unsupported.body.sources,[]);assert.doesNotMatch(unsupported.body.answer,/UNVERIFIED/);
  const pending=call('/api/ai/article/ask',{cookie,data});await ready;
  const state=structuredClone(user.body.state);state.sources.forEach(source=>source.enabled=false);
  try{await call('/api/state',{cookie,method:'PUT',data:{state,userId:user.body.user.id,revision:user.body.revision}});}finally{release();}
  const late=await pending;assert.equal(late.status,409);assert.doesNotMatch(JSON.stringify(late.body),/UNVERIFIED/);
});
