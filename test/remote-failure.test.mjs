import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server.mjs';

test('configured remote storage without a token cannot start with a local empty database', async () => {
  await assert.rejects(async () => {
    const server = await createApp({ databasePath: ':memory:', databaseUrl: 'libsql://missing-token.example.turso.io' });
    if (server.shutdown) await server.shutdown();else server.close();
  }, /token/i);
});
