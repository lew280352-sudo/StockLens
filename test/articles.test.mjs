import test from 'node:test';
import assert from 'node:assert/strict';
import {openDatabase} from '../database.mjs';
import {canReadArticle,extractArticle,createArticleService} from '../articles.mjs';

const url='https://nvidianews.nvidia.com/news/article-test';
const paragraph='The company will open a new research laboratory in Cambridge in 2028. Researchers will study energy efficiency and publish their findings. This detail is present in the article body and absent from the headline. ';
const html=`<!doctype html><html><head><title>Company announcement</title></head><body><nav>UNRELATED NAVIGATION</nav><article><h1>Company announcement</h1>${Array.from({length:5},()=>`<p>${paragraph}</p>`).join('')}</article><script>globalThis.articleScriptExecuted=true</script><img src="https://unexpected.example/track"><footer>UNRELATED FOOTER</footer></body></html>`;
const response=body=>new Response(body,{headers:{'Content-Type':'text/html; charset=utf-8'}});

test('article extraction reads body text without executing scripts or retaining page chrome',async()=>{
  assert.equal(canReadArticle(url),true);
  for(const value of ['http://nvidianews.nvidia.com/news/x','https://nvidianews.nvidia.com.evil.example/news/x','https://127.0.0.1/news/x','https://user:password@nvidianews.nvidia.com/news/x','https://nvidianews.nvidia.com:444/news/x','https://nvidianews.nvidia.com/','https://www.apple.com/newsroom/'])assert.equal(canReadArticle(value),false);
  const content=await extractArticle(html,url);assert.match(content.text,/Cambridge in 2028/);assert.doesNotMatch(content.text,/UNRELATED|articleScriptExecuted/);assert.equal(globalThis.articleScriptExecuted,undefined);assert.equal(content.coverage,'complete');assert.equal(content.usedBytes,content.totalBytes);
  const long=await extractArticle(`<article><h1>Long article</h1><p>${paragraph.repeat(150)}</p></article>`,url);assert.equal(long.coverage,'partial');assert.ok(long.usedBytes<=12000);assert.ok(long.totalBytes>long.usedBytes);
  await assert.rejects(()=>extractArticle('<html><title>Access denied</title><body>'+paragraph.repeat(5)+'</body></html>',url),error=>error.code==='article_blocked');
  await assert.rejects(()=>extractArticle(html.replace('<head>','<head><script type="application/ld+json">{"isAccessibleForFree":false}</script>'),url),error=>error.code==='article_blocked');
  await assert.rejects(()=>extractArticle('<article>Only a heading</article>',url),error=>error.code==='article_unreadable');
});

test('article reads coalesce, use bounded HTML and persist the text cache across service recreation',async()=>{
  const db=await openDatabase({databasePath:':memory:'});let calls=0;
  const reader=await createArticleService(db,{fetcher:async(request,options)=>{calls++;assert.equal(request,url);assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');assert.equal(options.headers.Cookie,undefined);await new Promise(resolve=>setTimeout(resolve,5));return response(html);}});
  try{
    const [first,second]=await Promise.all([reader.read(url),reader.read(url)]);assert.equal(calls,1);assert.equal(first.hash,second.hash);assert.match(first.text,/Cambridge/);
    const restarted=await createArticleService(db,{fetcher:async()=>{throw Error('must use persisted cache');}});assert.equal((await restarted.read(url)).cached,true);await restarted.close();
    assert.equal((await db.get('SELECT data FROM article_contents WHERE url=?',[url])).data.includes('<script>'),false);
  }finally{await reader.close();await db.close();}
});

test('article redirects never reach an unapproved host and oversized/non-HTML/challenge pages fail closed',async()=>{
  for(const variant of ['redirect','large','type','blocked','stream']){
    const db=await openDatabase({databasePath:':memory:'});let calls=0;
    const reader=await createArticleService(db,{fetcher:async()=>{calls++;
      if(variant==='redirect')return new Response('',{status:302,headers:{Location:'http://169.254.169.254/latest/meta-data/'}});
      if(variant==='large')return new Response('',{headers:{'Content-Type':'text/html','Content-Length':'1048577'}});
      if(variant==='type')return Response.json({data:'not an article'});
      if(variant==='blocked')return new Response('Blocked',{status:403});
      return response('x'.repeat(1048577));
    }});
    try{await assert.rejects(()=>reader.read(url),error=>['unsupported_article','article_too_large','article_unreadable','article_blocked'].includes(error.code));assert.equal(calls,1);}finally{await reader.close();await db.close();}
  }
});

test('article reader caps concurrent page fetches at two',async()=>{
  const db=await openDatabase({databasePath:':memory:'});let active=0,max=0;
  const reader=await createArticleService(db,{fetcher:async()=>{active++;max=Math.max(max,active);await new Promise(resolve=>setTimeout(resolve,10));active--;return response(html);}});
  try{await Promise.all([1,2,3,4].map(id=>reader.read(url+'-'+id)));assert.equal(max,2);}finally{await reader.close();await db.close();}
});
