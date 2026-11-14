import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

test('new passwords accept printable ASCII and reject other scripts without consuming a recovery code',async t=>{
  const server=await createApp({databasePath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.shutdown());
  const base=`http://127.0.0.1:${server.address().port}`;
  async function post(route,data){const response=await fetch(base+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(data)});return {status:response.status,body:await response.json()};}
  for(const [i,password] of ['Passwordไทย123!','Password中文123!','пароль-test-123','café-test-123!','Fullwidth１２３４５','Emoji-pass-😀','Linebreak-123\n'].entries()){
    const rejected=await post('/api/register',{name:'Character check',email:`characters-${i}@example.com`,password});
    assert.equal(rejected.status,400);assert.match(rejected.body.error,/อังกฤษ/);assert.equal(rejected.body.recoveryCode,undefined);
  }
  const account={name:'ASCII password',email:'ascii-password@example.com',password:Array.from({length:95},(_,i)=>String.fromCharCode(i+32)).join('')};
  const registered=await post('/api/register',account);assert.equal(registered.status,201);
  assert.equal((await post('/api/login',account)).status,200);
  assert.equal((await post('/api/recover',{email:account.email,code:registered.body.recoveryCode,password:'New-password-ไทย-123'})).status,400);
  assert.equal((await post('/api/login',account)).status,200,'a rejected reset does not change the current password');
  const password='New ASCII password 123!@#$%';
  assert.equal((await post('/api/recover',{email:account.email,code:registered.body.recoveryCode,password})).status,200,'the recovery code remains usable');
  assert.equal((await post('/api/login',{...account,password})).status,200);
});
