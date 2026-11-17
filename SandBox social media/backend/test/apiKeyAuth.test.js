const assert = require('node:assert/strict');
const { createServer } = require('node:http');
const express = require('express');
const test = require('node:test');
const apiKeyAuth = require('../middleware/apiKeyAuth');

async function startAuthServer(t) {
  const app = express();
  app.post('/api/posts', apiKeyAuth, (req, res) => {
    res.status(201).json({ success: true });
  });

  const server = createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return `http://127.0.0.1:${server.address().port}/api/posts`;
}

function configureExpectedKey(t, value) {
  const previous = process.env.FAKE_SOCIAL_API_KEY;
  if (value === undefined) delete process.env.FAKE_SOCIAL_API_KEY;
  else process.env.FAKE_SOCIAL_API_KEY = value;

  t.after(() => {
    if (previous === undefined) delete process.env.FAKE_SOCIAL_API_KEY;
    else process.env.FAKE_SOCIAL_API_KEY = previous;
  });
}

test('accepts a matching API key', async (t) => {
  configureExpectedKey(t, 'test-only-key');
  const url = await startAuthServer(t);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': 'test-only-key' },
  });

  assert.equal(response.status, 201);
});

test('rejects incorrect and missing API keys with HTTP 401', async (t) => {
  configureExpectedKey(t, 'test-only-key');
  const url = await startAuthServer(t);
  const incorrect = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': 'wrong-key' },
  });
  const missing = await fetch(url, { method: 'POST' });

  assert.equal(incorrect.status, 401);
  assert.equal(missing.status, 401);
});

test('reports missing server API key configuration without comparing undefined values', async (t) => {
  configureExpectedKey(t, undefined);
  const url = await startAuthServer(t);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'x-api-key': 'test-only-key' },
  });
  const body = await response.json();

  assert.equal(response.status, 500);
  assert.match(body.message, /not configured/i);
});
