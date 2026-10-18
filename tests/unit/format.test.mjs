import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, formatTime, joinList, negation, placeholders, withArticle } from '../../site/src/format.js';

test('formatTime: tenths of a second with a comma', () => {
  assert.equal(formatTime(0), '0,0');
  assert.equal(formatTime(undefined), '0,0');
  assert.equal(formatTime(49), '0,0');
  assert.equal(formatTime(50), '0,1');
  assert.equal(formatTime(2649), '2,6');
  assert.equal(formatTime(2650), '2,7');
  assert.equal(formatTime(8600), '8,6');
  assert.equal(formatTime(23400), '23,4');
  assert.equal(formatTime(3599999), '3600,0');
});

test('negation and articles', () => {
  assert.equal(negation('ett'), 'inget');
  assert.equal(negation('en'), 'ingen');
  assert.equal(withArticle({ article: 'ett', name: 'verb' }), 'ett verb');
  assert.equal(withArticle({ article: 'en', name: 'preposition' }), 'en preposition');
});

test('joinList: Swedish list joining', () => {
  assert.equal(joinList([]), '');
  assert.equal(joinList(['ett substantiv']), 'ett substantiv');
  assert.equal(joinList(['ett substantiv', 'ett verb']), 'ett substantiv och ett verb');
  assert.equal(joinList(['ett substantiv', 'ett verb', 'ett adjektiv']), 'ett substantiv, ett verb och ett adjektiv');
});

test('placeholders lists {names} in order', () => {
  assert.deepEqual(placeholders('Ord {i} av {n}'), ['i', 'n']);
  assert.deepEqual(placeholders('Inga'), []);
});

test('fill replaces placeholders and throws on a missing value', () => {
  assert.equal(fill('{n} ord per runda.', { n: 10 }), '10 ord per runda.');
  assert.equal(fill('Ord {i} av {n}', { i: 4, n: 10 }), 'Ord 4 av 10');
  assert.equal(fill('{a}{a}', { a: 0 }), '00');
  assert.throws(() => fill('Ord {i} av {n}', { i: 1 }), /Saknar värde för \{n\}/);
});
