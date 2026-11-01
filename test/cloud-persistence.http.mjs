import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../server.mjs';
import {randomBytes} from 'node:crypto';
import {totpCode} from '../security.mjs';

test('concurrent remote MFA activation never clears an activated secret',async()=>{
  const databaseUrl=process.env.TEST_DATABASE_URL||'http://127.0.0.1:18080';
  assert.ok(['localhost','127.0.0.1'].includes(new URL(databaseUrl).hostname));
  const server=await createApp({databasePath:':memory:',databaseUrl,authToken:'local-test-only',mfaKeyHex:randomBytes(32).toString('hex')});
  server.listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}`;
  async function post(route,body,cookie){return fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:JSON.stringify(body)});}
  try{
    const account={name:'Concurrent MFA',email:`${randomUUID()}@example.com`,password:'mfa-race-test-password'};
    await post('/api/register',account);const login=await post('/api/login',account),cookie=login.headers.get('set-cookie').split(';')[0];
    const setup=await (await post('/api/mfa/setup',{password:account.password},cookie)).json();
    const code=totpCode(setup.secret,Math.floor(Date.now()/30000));
    const result=await Promise.all([post('/api/mfa/enable',{code},cookie),post('/api/mfa/enable',{code},cookie)]);
    assert.equal(result.filter(r=>r.status===200).length,1);
    assert.equal((await (await fetch(base+'/api/security',{headers:{Cookie:cookie}})).json()).mfaEnabled,true);
  }finally{await server.shutdown();}
});

test('cloud account, session and watchlist survive application replacement', async () => {
  const databaseUrl = process.env.TEST_DATABASE_URL || 'http://127.0.0.1:18080';
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname));
  const config = { databasePath: ':memory:', databaseUrl, authToken: 'local-test-only' };
  let server, base;
  async function start() {server = await createApp(config);server.listen(0, '127.0.0.1');await once(server, 'listening');base = `http://127.0.0.1:${server.address().port}`;}
  async function stop() {if (!server) return;if (server.shutdown) await server.shutdown();else await new Promise((resolve) => server.close(resolve));server = null;}
  const credentials = { name: 'Cloud persistence', email: `${randomUUID()}@example.com`, password: 'persist-remotely-test-password' };
  const post = (route, data, cookie) => fetch(base + route, { method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(data) });
  let cookie;
  try {
    await start();assert.equal((await post('/api/register', credentials)).status, 201);
    const login = await post('/api/login', credentials);assert.equal(login.status, 200);
    cookie = login.headers.get('set-cookie').split(';')[0];const account = await login.json();account.state.watchlist = ['AAPL'];
    const save = () => fetch(base + '/api/state', { method: 'PUT', headers: { Origin: base, 'Content-Type': 'application/json', Cookie: cookie }, body: JSON.stringify({ userId: account.user.id, revision: account.revision, state: account.state }) });
    const simultaneous = await Promise.all([save(), save()]);
    assert.deepEqual(simultaneous.map((r) => r.status).sort(), [200, 409]);
    await stop();await start();
    const session = await (await fetch(base + '/api/session', { headers: { Cookie: cookie } })).json();
    assert.deepEqual(session.state?.watchlist, ['AAPL']);assert.equal(session.revision, 1);
  } finally {
    if (server && cookie) await post('/api/account/delete', { ...credentials, confirm: credentials.email }, cookie);
    await stop();
  }
});
