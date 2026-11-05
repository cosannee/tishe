const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');

execFileSync('python3', ['scripts/build.py']);
const worker = import('../dist/server/index.js').then(module => module.default);
const url = 'https://example.com/api/ai';

test('AI endpoint requires authenticated Sites visitor', async () => {
  const response = await (await worker).fetch(new Request(url, { method: 'POST', body: '{}' }), { OPENAI_API_KEY: 'test' });
  assert.equal(response.status, 401);
});

test('AI endpoint rejects cross-origin requests', async () => {
  const response = await (await worker).fetch(new Request(url, { method: 'POST', headers: { 'oai-authenticated-user-id': 'u1', origin: 'https://other.example' }, body: '{}' }), { OPENAI_API_KEY: 'test' });
  assert.equal(response.status, 403);
});

test('AI request passes limited context and returns model text', async () => {
  const original = global.fetch;
  let sent;
  global.fetch = async (target, options) => {
    assert.equal(target, 'https://api.openai.com/v1/responses');
    sent = JSON.parse(options.body);
    return new Response(JSON.stringify({ output: [{ content: [{ type: 'output_text', text: 'Давай начнём с малого.' }] }] }), { status: 200 });
  };
  try {
    const response = await (await worker).fetch(new Request(url, { method: 'POST', headers: { 'oai-authenticated-user-id': 'u2', origin: 'https://example.com', 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'talk', text: 'Мне сложно начать', profile: { style: 'cheeky', memory: '' } }) }), { OPENAI_API_KEY: 'test' });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).text, 'Давай начнём с малого.');
    assert.equal(sent.store, false);
    assert.equal(sent.model, 'gpt-6-luna');
    assert.ok(sent.input.includes('Мне сложно начать'));
    assert.ok(sent.instructions.includes('дерзко, смело и по-доброму'));
  } finally { global.fetch = original; }
});
