import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,statSync,chmodSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {openDatabase} from '../database.mjs';

test('local account databases stay private under a permissive umask and on reopening', {skip:process.platform==='win32'},async()=>{
 const parent=mkdtempSync(path.join(tmpdir(),'stocklens-private-storage-')),file=path.join(parent,'new-data','account.sqlite');let db;
 try{
  chmodSync(parent,0o755);
  const old=process.umask(0);let opening;
  try{opening=openDatabase({databasePath:file});}finally{process.umask(old);}
  db=await opening;await db.exec(['CREATE TABLE private_data(value TEXT)']);await db.run('INSERT INTO private_data VALUES(?)',['fixture']);
  for(const suffix of ['','-wal','-shm'])assert.equal(statSync(file+suffix).mode&0o777,0o600,`SQLite ${suffix||'database'} must be owner-only`);
  assert.equal(statSync(path.dirname(file)).mode&0o777,0o700);
  await db.close();db=null;chmodSync(file,0o644);db=await openDatabase({databasePath:file});
  assert.equal(statSync(file).mode&0o777,0o600);assert.equal((await db.get('SELECT value FROM private_data')).value,'fixture');
  assert.equal(statSync(parent).mode&0o777,0o755,'a supplied shared parent retains its permissions');
  await db.close();db=null;
  const link=path.join(parent,'linked.sqlite');symlinkSync(file,link);
  await assert.rejects(()=>openDatabase({databasePath:link}),error=>error.code==='ELOOP');
 }finally{await db?.close();rmSync(parent,{recursive:true,force:true});}
});
