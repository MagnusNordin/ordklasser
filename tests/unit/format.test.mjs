import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fill, formatTime, joinList, negation, placeholders, splitExample, withArticle } from '../../site/src/format.js';

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

test('splitExample finds the whole word, ignoring case', () => {
  assert.deepEqual(splitExample('Hon har kort hår.', 'kort'), { before: 'Hon har ', word: 'kort', after: ' hår.' });
  assert.deepEqual(splitExample('Vi spelar kort.', 'kort'), { before: 'Vi spelar ', word: 'kort', after: '.' });
  assert.deepEqual(splitExample('Kort är bra.', 'kort'), { before: '', word: 'Kort', after: ' är bra.' });
  assert.deepEqual(splitExample('Ska vi fika?', 'fika'), { before: 'Ska vi ', word: 'fika', after: '?' });
  assert.deepEqual(splitExample('Bär, bär och bär.', 'bär'), { before: '', word: 'Bär', after: ', bär och bär.' });
  assert.deepEqual(splitExample('Vi spelar kortspel.', 'kort'), { before: 'Vi spelar kortspel.', word: '', after: '' });
  assert.deepEqual(splitExample('Han är (x) här.', '(x)'), { before: 'Han är ', word: '(x)', after: ' här.' });
  assert.deepEqual(splitExample('Jag får en present.', 'får'), { before: 'Jag ', word: 'får', after: ' en present.' });
});
