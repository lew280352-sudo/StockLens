import { openDatabase } from '../database.mjs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { once } from 'node:events';
import { createQuoteService } from '../quotes.mjs';
import { createApp } from '../server.mjs';

test('quotes require configuration; coalesce requests, persist cooldown/cache and retain good data after failure', async () => {
  const db = await openDatabase({ databasePath: ':memory:' });let time = Date.now(),calls = 0,mode = 'good';
  const fetcher = async (url, options) => {calls++;assert.match(url, /^https:\/\/api.finnhub.io\/api\/v1\/quote\?symbol=AAPL$/);assert.equal(options.headers['X-Finnhub-Token'], 'fixture-secret');assert.equal(options.redirect, 'error');await new Promise((r) => setTimeout(r, 5));if (mode === 'error') return new Response('', { status: 429 });return Response.json(mode === 'invalid' ? { c: 0, t: 0 } : { c: 200.25, t: Math.floor(time / 1000) });};
  const off = await createQuoteService(db, { fetcher });assert.equal((await off.get(['AAPL'])).configured, false);assert.equal(calls, 0);off.close();
  const service = await createQuoteService(db, { apiKey: 'fixture-secret', fetcher, now: () => time });
  try {
    const results = await Promise.all(Array.from({ length: 20 }, () => service.get(['AAPL', 'AAPL', 'PTT', 'BAD'])));assert.equal(calls, 1);assert.equal(results[0].items.length, 1);assert.equal(results[0].items[0].quote.price, 200.25);
    await service.get(['AAPL']);assert.equal(calls, 1);
    const restarted = await createQuoteService(db, { apiKey: 'fixture-secret', fetcher, now: () => time });await restarted.get(['AAPL']);assert.equal(calls, 1);restarted.close();
    time += 61000;mode = 'error';let result = await service.get(['AAPL']);assert.equal(result.items[0].quote.price, 200.25);assert.equal(result.items[0].stale, true);assert.match(result.items[0].error, /โควตา/);
    time += 61000;mode = 'invalid';result = await service.get(['AAPL']);assert.equal(result.items[0].quote.price, 200.25);assert.match(result.items[0].error, /ตรวจสอบ/);
    assert.ok(!JSON.stringify(result).includes('fixture-secret'));
  } finally {service.close();await db.close();}
});

test('quote API authenticates, uses only followed companies, and rechecks logout after upstream request', async (t) => {
  let release, started;const ready = new Promise((r) => started = r),gate = new Promise((r) => release = r);let calls = 0;
  const server = await createApp({ databasePath: ':memory:', quoteApiKey: 'fixture-secret', quoteFetcher: async (url) => {calls++;assert.ok(url.endsWith('symbol=AAPL'));started();await gate;return Response.json({ c: 123, t: Math.floor(Date.now() / 1000) });} });
  server.listen(0, '127.0.0.1');await once(server, 'listening');t.after(() => {release();return server.shutdown();});const base = `http://127.0.0.1:${server.address().port}`;
  async function call(route, payload, cookie, method = payload ? 'POST' : 'GET') {
    return fetch(base + route, { method, headers: { Origin: base, ...(cookie ? { Cookie: cookie } : {}), ...(payload ? { 'Content-Type': 'application/json' } : {}) }, body: payload ? JSON.stringify(payload) : undefined });
  }
  assert.equal((await call('/api/quotes')).status, 401);assert.equal(calls, 0);
  const account = { name: 'Quotes Test', email: 'quotes@example.com', password: 'quotes-test-password' };await call('/api/register', account);const login = await call('/api/login', account),cookie = login.headers.get('set-cookie').split(';')[0],user = await login.json();
  user.state.watchlist = ['AAPL'];
  assert.equal((await call('/api/state', { userId: user.user.id, revision: 0, state: user.state }, cookie, 'PUT')).status, 200);
  const pending = call('/api/quotes?symbols=MSFT', null, cookie);await ready;await call('/api/logout', {}, cookie);release();assert.equal((await pending).status, 401);assert.equal(calls, 1);
  const next = await call('/api/login', account),newCookie = next.headers.get('set-cookie').split(';')[0];const result = await (await call('/api/quotes', null, newCookie)).json();assert.deepEqual(result.items.map((i) => i.symbol), ['AAPL']);assert.equal(result.items[0].quote.price, 123);assert.ok(!JSON.stringify(result).includes('fixture-secret'));
});

test('daily quote comparisons use the provider previous close and omit missing or invalid baselines',async()=>{
  const db=await openDatabase({databasePath:':memory:'});let time=Date.now(),previousClose=80,calls=0;
  const service=await createQuoteService(db,{apiKey:'fixture-secret',now:()=>time,fetcher:async(url)=>{assert.match(url,/\/api\/v1\/quote\?symbol=AAPL$/);calls++;return Response.json({c:100,pc:previousClose,t:Math.floor(time/1000)});}});
  try{
    for(const [baseline,change,percent] of [[80,20,25],[125,-25,-20],[100,0,0]]){
      previousClose=baseline;time+=61000;const quote=(await service.get(['AAPL'])).items[0].quote;
      assert.equal(quote.previousClose,baseline);assert.equal(quote.change,change);assert.ok(Math.abs(quote.changePercent-percent)<1e-9);
      assert.equal((await service.get(['AAPL'])).items[0].quote.previousClose,baseline,'the cached quote keeps the same baseline');
    }
    for(const baseline of [undefined,null,0,-1,'80',Number.MIN_VALUE]){
      previousClose=baseline;time+=61000;const quote=(await service.get(['AAPL'])).items[0].quote;
      assert.equal(quote.price,100);assert.equal(quote.previousClose,undefined);assert.equal(quote.change,undefined);assert.equal(quote.changePercent,undefined);
    }
    assert.equal(calls,9);
  }finally{service.close();await db.close();}
});
