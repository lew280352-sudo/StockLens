import { openDatabase } from '../database.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { aiConfiguration, headlineBrief, createAiRouter, createAiService } from '../ai.mjs';

test('auto chooses configured Gemini, then Groq; Render never needs a local model', () => {
  assert.equal(aiConfiguration({GEMINI_API_KEY: 'gemini', GROQ_API_KEY: 'groq'}).aiProvider, 'gemini');
  assert.equal(aiConfiguration({GROQ_API_KEY: 'groq'}).aiProvider, 'hybrid');
  assert.equal(aiConfiguration({RENDER: 'true'}).aiProvider, 'gemini');
  assert.equal(aiConfiguration({}).aiProvider, 'ollama');
  assert.equal(aiConfiguration({GEMINI_API_KEY: 'gemini', GROQ_API_KEY: 'groq', AI_PROVIDER: 'groq'}).aiApiKey, 'groq');
});

test('Gemini keeps keys in headers, uses grounded JSON, caches and enforces a persistent shared call cap', async () => {
  const db = await openDatabase({databasePath: ':memory:'});let calls = 0;
  const sample = {id: 'one', symbol: 'AAPL', source: 'Apple', title: 'Apple announces a new product', url: 'https://www.apple.com/newsroom/', publishedAt: '2026-11-13T00:00:00Z'};
  const fetcher = async (url, options) => {
    assert.match(url, /^https:\/\/generativelanguage.googleapis.com\/v1beta\/models\//);
    assert.doesNotMatch(url, /private-key/);assert.equal(options.headers['x-goog-api-key'], 'private-key');assert.equal(options.redirect, 'error');
    if (!options.method) return Response.json({supportedGenerationMethods: ['generateContent']});
    calls++;const body = JSON.parse(options.body);
    assert.equal(body.generationConfig.responseMimeType, 'application/json');assert.equal(body.tools, undefined, 'no paid search tools');
    assert.doesNotMatch(options.body, /private-key|email|password/);assert.match(body.systemInstruction.parts[0].text, /ทำนายราคา/);
    const value = body.generationConfig.responseJsonSchema.properties.answer ? {answer: 'หัวข้อประกาศผลิตภัณฑ์ใหม่', supported: true, sourceIds: ['one', 'invented']} : {title: 'ข่าว Apple', summary: 'หัวข้อข่าวประกาศผลิตภัณฑ์ใหม่', facts: [], risks: [], positiveFactors: [], unknowns: [], confidence: 'low'};
    return Response.json({candidates: [{finishReason: 'STOP', content: {parts: [{text: JSON.stringify(value)}]}}]});
  };
  const options = {provider: 'gemini', apiKey: 'private-key', dailyLimit: 2, fetcher};
  const ai = await createAiService(db, options);
  try {
    assert.equal((await ai.status()).available, true);
    const result = await ai.summarize('AAPL', [sample]);assert.equal(result.provider, 'gemini');
    assert.equal((await ai.summarize('AAPL', [sample])).cached, true);assert.equal(calls, 1);
    const answer = await ai.ask('AAPL', 'มีข่าวอะไร?', [sample]);assert.deepEqual(answer.sources.map(item => item.id), ['one']);assert.equal(calls, 2);
    ai.close();const restarted = await createAiService(db, options);
    assert.equal((await restarted.summarize('AAPL', [sample])).cached, true);
    await assert.rejects(() => restarted.ask('AAPL', 'ถามซ้ำได้ไหม?', [sample]), error => error.code === 'quota');assert.equal(calls, 2);restarted.close();
  } finally {ai.close();await db.close();}
});

test('Gemini exposes no secrets on quota, credential, incomplete or malformed responses', async () => {
  const db = await openDatabase({databasePath: ':memory:'});
  const articles = [{id: 'one', symbol: 'AAPL', source: 'Apple', title: 'A product', url: 'https://www.apple.com/'}];
  try {
    const missing = await createAiService(db, {provider: 'gemini'});assert.equal((await missing.status()).configured, false);
    await assert.rejects(() => missing.summarize('AAPL', articles), error => error.code === 'not_configured');
    for (const [code, expected] of [[429, 'quota'], [403, 'credentials'], [404, 'model_missing']]) {
      const ai = await createAiService(db, {provider: 'gemini', apiKey: 'secret', fetcher: async () => new Response('secret', {status: code})});
      assert.equal((await ai.status()).reason, expected);
      await assert.rejects(() => ai.summarize('AAPL', articles), error => error.code === expected && !error.message.includes('secret'));ai.close();
    }
    for (const candidate of [{finishReason: 'MAX_TOKENS'}, {finishReason: 'STOP', content: {parts: [{text: 'invalid JSON'}]}}]) {
      const ai = await createAiService(db, {provider: 'gemini', apiKey: 'secret', fetcher: async () => Response.json({candidates: [candidate]})});
      await assert.rejects(() => ai.summarize('AAPL', articles), /complete|malformed/);ai.close();
    }
    const brief = headlineBrief('AAPL', articles, 'quota');assert.equal(brief.generated, false);assert.equal(brief.provider, 'headlines');assert.equal(brief.articles[0].title, articles[0].title);assert.deepEqual(brief.positiveFactors, []);
  } finally {await db.close();}
});

test('local AI checks the selected model, uses structured output, and caches identical news', async () => {
  const db = await openDatabase({ databasePath: ':memory:' });let chats = 0,request;
  const fetcher = async (url, options = {}) => {
    if (url.endsWith('/api/tags')) return Response.json({ models: [{ name: 'qwen3:8b' }] });
    chats++;request = JSON.parse(options.body);
    return Response.json({ message: { content: JSON.stringify({ title: 'ภาพรวม Apple', summary: 'หัวข้อข่าวกล่าวถึงผลิตภัณฑ์ใหม่ แต่ยังไม่มีข้อมูลผลกระทบทางการเงิน', facts: ['บริษัทเผยแพร่หัวข้อเกี่ยวกับผลิตภัณฑ์ใหม่'], positiveFactors: ['อาจเพิ่มความสนใจต่อผลิตภัณฑ์'], risks: ['ยังไม่ทราบผลตอบรับของตลาด'], unknowns: ['ไม่มีตัวเลขรายได้หรือกำไรในหัวข้อ'], confidence: 'low' }) } });
  };
  const ai = await createAiService(db, { enabled: true, model: 'qwen3:8b', fetcher });
  assert.deepEqual(await ai.status(), { enabled: true, available: true, provider: 'ollama', model: 'qwen3:8b', online: false, configured: true });
  const items = [{ id: 'one', feedId: 'apple', symbol: 'AAPL', source: 'Apple Newsroom', title: 'Apple introduces a new product', url: 'https://www.apple.com/newsroom/example', publishedAt: '2026-10-19T00:00:00.000Z', stale: false }];
  const first = await ai.summarize('AAPL', items),second = await ai.summarize('AAPL', items);
  assert.equal(chats, 1);assert.equal(first.cached, false);assert.equal(second.cached, true);assert.equal(first.confidence, 'low');
  assert.equal(request.stream, false);assert.equal(request.think, false);assert.equal(request.format.additionalProperties, false);assert.match(request.messages[0].content, /ห้ามทำนายราคาหุ้น/);
  await assert.rejects(() => ai.summarize('MSFT', items), (error) => error.code === 'no_news');
  ai.close();await db.close();
});

test('local AI only accepts loopback URLs and degrades when disabled', async () => {
  const db = await openDatabase({ databasePath: ':memory:' });
  await assert.rejects(async () => await createAiService(db, { baseUrl: 'http://example.com' }), /localhost/);
  const ai = await createAiService(db, { enabled: false });
  assert.deepEqual(await ai.status(), { enabled: false, available: false, provider: 'ollama', model: 'qwen3:8b', online: false });
  await assert.rejects(() => ai.summarize('AAPL', [{ symbol: 'AAPL' }]), (error) => error.code === 'disabled');
  await db.close();
});

test('Groq online AI keeps the key in server headers and requests strict structured output', async () => {
  const db = await openDatabase({ databasePath: ':memory:' });let request;
  const fetcher = async (url, options = {}) => {
    assert.match(url, /^https:\/\/api\.groq\.com\/openai\/v1\//);
    assert.equal(options.headers.Authorization, 'Bearer test-secret-key');
    if (url.endsWith('/models')) return Response.json({ data: [{ id: 'qwen/qwen3.8-27b' }] });
    request = JSON.parse(options.body);
    return Response.json({ choices: [{ message: { content: JSON.stringify({ title: 'ภาพรวม Microsoft', summary: 'หัวข้อกล่าวถึงบริการใหม่ แต่ข้อมูลผลกระทบยังไม่เพียงพอ', facts: ['มีหัวข้อข่าวเกี่ยวกับบริการใหม่'], positiveFactors: ['อาจเพิ่มการใช้งาน'], risks: ['ยังไม่มีข้อมูลผลตอบรับ'], unknowns: ['ไม่มีตัวเลขรายได้'], confidence: 'low' }) } }] });
  };
  const ai = await createAiService(db, { provider: 'groq', apiKey: 'test-secret-key', model: 'qwen/qwen3.8-27b', fetcher });
  assert.deepEqual(await ai.status(), { enabled: true, available: true, provider: 'groq', model: 'qwen/qwen3.8-27b', online: true, configured: true });
  const item = { id: 'ms-one', symbol: 'MSFT', source: 'Microsoft News', title: 'Microsoft announces a new service', url: 'https://news.microsoft.com/example', publishedAt: '2026-10-20T00:00:00.000Z', stale: false };
  const result = await ai.summarize('MSFT', [item]);
  assert.equal(result.provider, 'groq');assert.equal(request.response_format.type, 'json_schema');assert.equal(request.response_format.json_schema.strict, true);assert.equal(request.reasoning_effort, 'none');
  assert.equal(request.max_completion_tokens, 2400, 'Thai structured summaries need enough output space');
  assert.doesNotMatch(JSON.stringify(result), /test-secret-key/);
  const missingDb = await openDatabase({ databasePath: ':memory:' }),missing = await createAiService(missingDb, { provider: 'groq' });
  assert.equal((await missing.status()).configured, false);
  await assert.rejects(() => missing.summarize('MSFT', [item]), (error) => error.code === 'not_configured');
  missing.close();missingDb.close();ai.close();await db.close();
});

test('Groq rejects truncated JSON and classifies provider errors without exposing their contents', async () => {
  const db = await openDatabase({databasePath: ':memory:'});
  const articles = [{id: 'one', symbol: 'AAPL', source: 'Apple', title: 'Product news', url: 'https://www.apple.com/'}];
  try {
    const cases = [
      [Response.json({choices: [{finish_reason: 'length', message: {content: '{"title":"truncated"'}}]}), 'invalid_output'],
      [Response.json({error: {code: 'json_validate_failed', message: 'secret-provider-details'}}, {status: 400}), 'invalid_output'],
      [Response.json({error: {message: 'reasoning_effort secret-provider-details'}}, {status: 400}), 'reasoning_unsupported'],
      [Response.json({error: {message: 'response_format json_schema secret-provider-details'}}, {status: 400}), 'schema_unsupported'],
      [Response.json({error: {message: 'secret-provider-details'}}, {status: 400}), 'request_rejected']
    ];
    for (const [response, code] of cases) {
      const ai = await createAiService(db, {provider: 'groq', apiKey: 'secret-key', fetcher: async () => response});
      await assert.rejects(() => ai.summarize('AAPL', articles), error => error.code === code && !/secret/.test(error.message));ai.close();
    }
  } finally {await db.close();}
});

test('auto AI falls back from an unavailable online provider to local AI', async () => {
  let primaryCalls = 0,localCalls = 0;
  const primary = { status: async () => ({ provider: 'groq', available: true, online: true }), summarize: async () => {primaryCalls++;throw new Error('rate limited');}, close() {} };
  const fallback = { status: async () => ({ provider: 'ollama', available: true, online: false, model: 'qwen3:8b' }), summarize: async () => {localCalls++;return { provider: 'ollama', model: 'qwen3:8b', summary: 'local result' };}, close() {} };
  const ai = createAiRouter(primary, fallback),status = await ai.status(),result = await ai.summarize('AAPL', []);
  assert.equal(status.provider, 'groq');assert.equal(status.fallbackAvailable, true);
  assert.equal(primaryCalls, 1);assert.equal(localCalls, 1);assert.equal(result.provider, 'ollama');assert.equal(result.fallbackFrom, 'groq');
});

test('AI Q&A cites only available headlines and admits insufficient evidence', async () => {
  const db = await openDatabase({ databasePath: ':memory:' });let answer = { answer: 'หัวข้อระบุผลิตภัณฑ์ใหม่', supported: true, sourceIds: ['one', 'invented'] };
  const fetcher = async () => Response.json({ message: { content: JSON.stringify(answer) } });
  const ai = await createAiService(db, { fetcher });
  const item = { id: 'one', symbol: 'AAPL', source: 'Apple Newsroom', title: 'Apple introduces a new product', url: 'https://www.apple.com/newsroom/example', publishedAt: '2026-10-19T00:00:00Z' };
  const result = await ai.ask('AAPL', 'มีข่าวอะไรบ้าง?', [item]);
  assert.equal(result.supported, true);assert.equal(result.sources.length, 1);assert.equal(result.sources[0].id, 'one');assert.ok(result.answeredAt);
  answer = { answer: 'ขึ้นแน่นอน', supported: true, sourceIds: ['invented'] };
  const unsupported = await ai.ask('AAPL', 'หุ้นจะขึ้นไหม?', [item]);
  assert.equal(unsupported.supported, false);assert.deepEqual(unsupported.sources, []);assert.doesNotMatch(unsupported.answer, /ขึ้นแน่นอน/);
  await assert.rejects(() => ai.ask('MSFT', 'อะไร?', [item]), (error) => error.code === 'no_news');
  ai.close();await db.close();
});
