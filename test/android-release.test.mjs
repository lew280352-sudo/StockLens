import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {X509Certificate} from 'node:crypto';
import {once} from 'node:events';
import {createApp} from '../server.mjs';

test('Android origin verification is public, matches the release certificate, and exposes no private signing files',async t=>{
  const cert=new X509Certificate(readFileSync(new URL('../android/signing-certificate.pem',import.meta.url)));
  const server=await createApp({databasePath:':memory:'});server.listen(0,'127.0.0.1');await once(server,'listening');t.after(()=>server.shutdown());
  const base=`http://127.0.0.1:${server.address().port}`;
  const response=await fetch(base+'/.well-known/assetlinks.json');assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/^application\/json/);
  const statements=await response.json();assert.equal(statements.length,1);assert.deepEqual(statements[0].relation,['delegate_permission/common.handle_all_urls']);
  assert.equal(statements[0].target.package_name,'io.github.lew280352.stocklens');assert.deepEqual(statements[0].target.sha256_cert_fingerprints,[cert.fingerprint256]);
  for(const path of ['/.data/android/stocklens-release.p12','/.data/android/signing-password.txt','/.well-known/not-public.json'])assert.equal((await fetch(base+path)).status,404);
});
