import {createHash} from 'node:crypto';

const MAX_HTML_BYTES=1024*1024,MAX_TEXT_BYTES=12000,CACHE_MS=6*60*60*1000;
const publishers=new Map([
  ['www.apple.com',/^\/newsroom\/.+/],
  ['news.microsoft.com',/^\/source\/.+/],
  ['blogs.microsoft.com',/^\/blog\/.+/],
  ['nvidianews.nvidia.com',/^\/(news|releases)\/.+/],
  ['ir.netflix.net',/\/press-release-details\/.+/]
]);
function failure(code){const error=new Error(code);error.code=code;return error;}
function approvedUrl(value){
  let url;try{url=new URL(value);}catch{throw failure('unsupported_article');}
  if(url.protocol!=='https:'||url.username||url.password||url.port||!publishers.get(url.hostname)?.test(url.pathname))throw failure('unsupported_article');
  url.hash='';return url;
}
export function canReadArticle(value){try{approvedUrl(value);return true;}catch{return false;}}
function limitedText(value){
  const bytes=Buffer.from(value);return {text:bytes.length>MAX_TEXT_BYTES?new TextDecoder().decode(bytes.subarray(0,MAX_TEXT_BYTES),{stream:true}):value,totalBytes:bytes.length};
}
let parserModules;
export async function extractArticle(html,url){
  approvedUrl(url);
  if(Buffer.byteLength(html)>MAX_HTML_BYTES)throw failure('article_too_large');
  if((String(html).match(/<[a-z][\w:-]*(?=[\s/>])/gi)||[]).length>20000)throw failure('article_too_large');
  if(/"isAccessibleForFree"\s*:\s*(false|"false")/i.test(String(html)))throw failure('article_blocked');
  parserModules??=Promise.all([import('jsdom'),import('@mozilla/readability')]);
  const [{JSDOM,VirtualConsole},{Readability}]=await parserModules;
  // Scripts and external resources stay disabled; the extracted HTML is never rendered.
  const dom=new JSDOM(html,{url,virtualConsole:new VirtualConsole()});
  try{
    const document=dom.window.document;
    if(/^\s*(access denied|just a moment|verify you are human|sign in|log in)/i.test(document.title))throw failure('article_blocked');
    document.querySelectorAll('script,style,noscript,form,nav,aside,footer').forEach(node=>node.remove());
    const parsed=new Readability(document,{maxElemsToParse:20000,charThreshold:300}).parse();
    const plain=parsed?.textContent?.replace(/\s+/g,' ').trim()||'';
    if(plain.length<300)throw failure('article_unreadable');
    const {text,totalBytes}=limitedText(plain);
    return {text,totalBytes,usedBytes:Buffer.byteLength(text),coverage:Buffer.byteLength(text)<totalBytes?'partial':'complete',hash:createHash('sha256').update(text).digest('hex')};
  }finally{dom.window.close();}
}

export async function createArticleService(db,{fetcher=fetch,now=Date.now}={}){
  await db.exec(['CREATE TABLE IF NOT EXISTS article_contents(url TEXT PRIMARY KEY,data TEXT NOT NULL,fetched_at INTEGER NOT NULL)']);
  const pending=new Map(),queue=[],controller=new AbortController();let active=0,closed=false;
  async function acquire(){if(active<2){active++;return;}await new Promise(resolve=>queue.push(resolve));}
  function release(){const next=queue.shift();if(next)next();else active--;}
  async function read(value){
    if(closed)throw failure('article_unavailable');
    const initial=approvedUrl(value).href;
    if(pending.has(initial))return pending.get(initial);
    if(pending.size>=12)throw failure('article_busy');
    let stage='cache';
    const task=(async()=>{
      // Text caching is optional: a cache outage must not prevent reading the source.
      let cached;try{cached=await db.get('SELECT data,fetched_at FROM article_contents WHERE url=?',[initial]);}catch{}
      if(closed)throw failure('article_unavailable');
      if(cached&&now()-Number(cached.fetched_at)<CACHE_MS){try{return {...JSON.parse(cached.data),cached:true};}catch{}}
      await acquire();
      try{
        if(closed)throw failure('article_unavailable');
        let url=approvedUrl(initial);
        stage='fetch';
        const signal=AbortSignal.any([controller.signal,AbortSignal.timeout(12000)]);
        for(let hops=0;hops<=3;hops++){
          const response=await fetcher(url.href,{redirect:'manual',credentials:'omit',signal,headers:{Accept:'text/html,application/xhtml+xml','User-Agent':'StockLens/0.9 (+https://github.com/lew280352-sudo/StockLens)'}});
          if([301,302,303,307,308].includes(response.status)){
            const location=response.headers.get('location');await response.body?.cancel();
            if(!location||hops===3)throw failure('article_unavailable');
            url=approvedUrl(new URL(location,url).href);continue;
          }
          if(!response.ok){await response.body?.cancel();const error=failure([401,403].includes(response.status)?'article_blocked':'article_unavailable');error.upstreamStatus=response.status;throw error;}
          if(!/^(text\/html|application\/xhtml\+xml)\b/i.test(response.headers.get('content-type')||'')){await response.body?.cancel();throw failure('article_unreadable');}
          if(Number(response.headers.get('content-length'))>MAX_HTML_BYTES){await response.body?.cancel();throw failure('article_too_large');}
          const reader=response.body.getReader(),chunks=[];let size=0;
          try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_HTML_BYTES)throw failure('article_too_large');chunks.push(value);}}catch(error){await reader.cancel();throw error;}finally{reader.releaseLock();}
          stage='extract';
          const content=await extractArticle(Buffer.concat(chunks),url.href),result={...content,url:url.href,readAt:new Date(now()).toISOString()};
          if(closed)throw failure('article_unavailable');
          stage='cache';
          try{await db.run('INSERT OR REPLACE INTO article_contents(url,data,fetched_at) VALUES(?,?,?)',[initial,JSON.stringify(result),now()]);}catch{}
          return {...result,cached:false};
        }
      }finally{release();}
    })().catch(error=>{const safe=['unsupported_article','article_too_large','article_unreadable','article_blocked','article_unavailable','article_busy'].includes(error.code)?error:failure('article_unavailable');safe.stage=stage;throw safe;}).finally(()=>pending.delete(initial));
    pending.set(initial,task);return task;
  }
  return {read,async close(){closed=true;controller.abort();await Promise.allSettled([...pending.values()]);}};
}
