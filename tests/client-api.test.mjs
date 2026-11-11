import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { transform } from 'esbuild';

test('API helper sends a content type only when the request has a body', async () => {
  const source = readFileSync(resolve('src/client/api.ts'), 'utf8');
  const { code } = await transform(source, { loader: 'ts', format: 'esm' });
  const { api } = await import(`data:text/javascript,${encodeURIComponent(code)}`);
  const previousFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (_url, options) => {
    requests.push(options);
    return { ok: true, json: async () => ({ ok: true }) };
  };
  try {
    await api('/entries/test', { method: 'DELETE' });
    assert.equal(requests[0].headers.has('Content-Type'), false);
    await api('/entries', { method: 'POST', body: JSON.stringify({ label: 'Test' }) });
    assert.equal(requests[1].headers.get('Content-Type'), 'application/json');
    await api('/hevy/import', { method: 'POST', headers: { 'Content-Type': 'text/csv' }, body: 'title\n' });
    assert.equal(requests[2].headers.get('Content-Type'), 'text/csv');
  } finally {
    globalThis.fetch = previousFetch;
  }
});
