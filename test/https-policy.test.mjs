import test from 'node:test';
import assert from 'node:assert/strict';
import {request} from 'node:http';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

test('HTTPS policy and secure cookies use the configured origin, including API errors, without trusting forwarded headers',async t=>{
 const origin='https://secure.stocklens.example',server=await createApp({databasePath:':memory:',publicOrigin:origin});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.shutdown());
 const port=server.address().port;
 const call=(path,{host='secure.stocklens.example',data,headers={}}={})=>new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port,path,method:data?'POST':'GET',headers:{Host:host,Origin:origin,...(data?{'Content-Type':'application/json'}:{}),...headers}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));});req.on('error',reject);req.end(data?JSON.stringify(data):undefined);
 });
 for(const path of ['/','/api/health','/api/export','/not-public']){
  const r=await call(path);assert.equal(r.headers['strict-transport-security'],'max-age=31536000');
  assert.equal(r.headers['cache-control'],'no-store');assert.match(r.headers['content-security-policy'],/object-src 'none'/);
 }
 const account={name:'HTTPS policy',email:'https-policy@example.com',password:'https-policy-test-password'};
 assert.equal((await call('/api/register',{data:account})).status,201);
 const login=await call('/api/login',{data:account});assert.equal(login.status,200);assert.match(login.headers['set-cookie'][0],/; Secure(?:;|$)/);assert.match(login.headers['set-cookie'][0],/HttpOnly/);
 const local=await call('/',{host:`127.0.0.1:${port}`,headers:{'X-Forwarded-Proto':'https','X-Forwarded-Host':'secure.stocklens.example'}});
 assert.equal(local.status,200);assert.equal(local.headers['strict-transport-security'],undefined,'untrusted forwarded headers cannot change the local HTTP policy');
 assert.equal((await call('/',{host:'evil.example'})).status,403);
});
