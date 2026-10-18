import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestKey, createBestStore } from '../../site/src/storage.js';

const ROUND = { wordsPerRound: 10, activeClasses: ['substantiv', 'verb', 'adjektiv'], mode: 'any' };

function memory() {
  const data = new Map();
  return { data, getItem: (k) => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v) };
}

test('key depends on round size, classes (order-independent) and mode', () => {
  assert.equal(bestKey(ROUND), 'ordklasser:best:10:adjektiv,substantiv,verb:any');
  assert.equal(bestKey({ ...ROUND, activeClasses: ['verb', 'adjektiv', 'substantiv'] }), bestKey(ROUND));
  assert.notEqual(bestKey({ ...ROUND, wordsPerRound: 20 }), bestKey(ROUND));
  assert.notEqual(bestKey({ ...ROUND, mode: 'all' }), bestKey(ROUND));
  assert.notEqual(bestKey({ ...ROUND, activeClasses: ['substantiv', 'verb'] }), bestKey(ROUND));
  assert.deepEqual(ROUND.activeClasses, ['substantiv', 'verb', 'adjektiv'], 'input not mutated');
});

test('read/write round trip; separate configurations do not compete', () => {
  const mem = memory();
  const store = createBestStore(() => mem);
  assert.equal(store.read(ROUND), null);
  assert.equal(store.write(ROUND, 21300.4), true);
  assert.equal(store.read(ROUND), 21300);
  assert.equal(store.read({ ...ROUND, wordsPerRound: 20 }), null);
});

test('garbage values read as null', () => {
  const mem = memory();
  const store = createBestStore(() => mem);
  for (const bad of ['abc', '0', '-5', '']) {
    mem.data.set(bestKey(ROUND), bad);
    assert.equal(store.read(ROUND), null, bad);
  }
});

test('storage missing or throwing → no crash, null / false', () => {
  const missing = createBestStore(() => null);
  assert.equal(missing.read(ROUND), null);
  assert.equal(missing.write(ROUND, 1), false);
  const blocked = createBestStore(() => { throw new Error('SecurityError'); });
  assert.equal(blocked.read(ROUND), null);
  assert.equal(blocked.write(ROUND, 1), false);
  const failing = createBestStore(() => ({
    getItem() { throw new Error('nope'); },
    setItem() { throw new Error('QuotaExceeded'); }
  }));
  assert.equal(failing.read(ROUND), null);
  assert.equal(failing.write(ROUND, 1), false);
});
