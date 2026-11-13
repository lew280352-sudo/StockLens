import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {openDatabase} from '../database.mjs';
import {createArticleService} from '../articles.mjs';

test('real libSQL HTTP driver commits, rolls back and persists after reconnect',async()=>{
  const databaseUrl=process.env.TEST_DATABASE_URL||'http://127.0.0.1:18080';
  assert.ok(['127.0.0.1','localhost'].includes(new URL(databaseUrl).hostname),'integration test requires a local isolated server');
  const config={databaseUrl,authToken:'local-test-only'};
  const table='test_'+randomUUID().replaceAll('-','');
  let db=await openDatabase(config);
  try{
    await db.exec([`CREATE TABLE ${table}(id TEXT PRIMARY KEY,value TEXT)`]);
    const result=await db.transaction(tx=>tx.run(`INSERT INTO ${table} VALUES(?,?)`,['saved','ไทย']));
    assert.equal(result.changes,1);
    await assert.rejects(db.transaction(async tx=>{await tx.run(`INSERT INTO ${table} VALUES(?,?)`,['rollback','no']);throw new Error('cancel');}),/cancel/);
    await db.close();db=await openDatabase(config);
    assert.deepEqual(await db.all(`SELECT id,value FROM ${table}`),[{id:'saved',value:'ไทย'}]);
  }finally{await db.exec([`DROP TABLE ${table}`]);await db.close();}
});

test('article text cache persists through the real libSQL HTTP driver',async()=>{
  const databaseUrl=process.env.TEST_DATABASE_URL||'http://127.0.0.1:18080';
  assert.ok(['127.0.0.1','localhost'].includes(new URL(databaseUrl).hostname));
  const config={databaseUrl,authToken:'local-test-only'},url='https://www.apple.com/newsroom/cache-'+randomUUID();
  let db=await openDatabase(config),reader;
  const paragraph='The article body describes a new Cambridge laboratory opening in 2028, with research into energy efficiency and public engineering projects. ';
  try{
    reader=await createArticleService(db,{fetcher:async()=>new Response('<article><h1>Research</h1>'+`<p>${paragraph}</p>`.repeat(5)+'</article>',{headers:{'Content-Type':'text/html'}})});
    const result=await reader.read(url);assert.match(result.text,/Cambridge/);assert.equal(result.cached,false);
    await reader.close();await db.close();db=await openDatabase(config);
    reader=await createArticleService(db,{fetcher:async()=>{throw Error('must read persisted cache');}});
    const cached=await reader.read(url);assert.equal(cached.cached,true);assert.equal(cached.hash,result.hash);
  }finally{await reader?.close();await db.run('DELETE FROM article_contents WHERE url=?',[url]);await db.close();}
});
