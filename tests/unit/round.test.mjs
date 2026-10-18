import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRound, playable, seededRng, shuffle } from '../../site/src/round.js';
import { realConfig } from './helpers.mjs';

const ACTIVE = ['substantiv', 'verb', 'adjektiv'];
const config = realConfig();
const isMulti = (w) => w.classes.length > 1;

test('seededRng is deterministic and in [0, 1)', () => {
  const a = seededRng(42);
  const b = seededRng(42);
  const xs = Array.from({ length: 100 }, () => a());
  assert.deepEqual(xs, Array.from({ length: 100 }, () => b()));
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(xs.slice(0, 5), Array.from({ length: 5 }, seededRng(43)));
});

test('shuffle keeps the items and does not mutate the input', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffle(input, seededRng(1));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual([...out].sort(), input);
  assert.deepEqual(shuffle([], seededRng(1)), []);
});

test('playable narrows classes to the active ones and drops the rest', () => {
  const words = [
    { word: 'hund', classes: ['substantiv'] },
    { word: 'bär', classes: ['substantiv', 'verb'] },
    { word: 'röd', classes: ['adjektiv'] }
  ];
  assert.deepEqual(playable(words, ['verb', 'substantiv']).map((w) => [w.word, w.classes]), [
    ['hund', ['substantiv']],
    ['bär', ['verb', 'substantiv']]
  ]);
});

test('correct length, no repeats and balanced for every size 3–30', () => {
  for (let n = 3; n <= 30; n++) {
    const round = buildRound(config.words, n, seededRng(n), { activeClasses: ACTIVE, maxMulti: 2 });
    assert.equal(round.length, n, `n=${n}`);
    assert.equal(new Set(round.map((w) => w.word)).size, n, `no repeats n=${n}`);
    const k = round.filter(isMulti).length;
    const per = Math.floor((n - k) / ACTIVE.length);
    for (const c of ACTIVE) {
      const count = round.filter((w) => !isMulti(w) && w.classes[0] === c).length;
      assert.ok(count >= per, `n=${n} ${c}: ${count} < ${per}`);
    }
  }
});

test('multi-class cap: min(maxMulti, floor(n/4)), and 0 disables them', () => {
  for (let seed = 1; seed <= 20; seed++) {
    assert.equal(buildRound(config.words, 10, seededRng(seed), { activeClasses: ACTIVE, maxMulti: 2 }).filter(isMulti).length, 2);
    assert.equal(buildRound(config.words, 10, seededRng(seed), { activeClasses: ACTIVE, maxMulti: 0 }).filter(isMulti).length, 0);
    assert.equal(buildRound(config.words, 7, seededRng(seed), { activeClasses: ACTIVE, maxMulti: 5 }).filter(isMulti).length, 1);
    assert.equal(buildRound(config.words, 3, seededRng(seed), { activeClasses: ACTIVE, maxMulti: 5 }).filter(isMulti).length, 0);
  }
  assert.equal(buildRound(config.words, 10, seededRng(1), { activeClasses: ACTIVE }).filter(isMulti).length, 0);
});

test('never two multi-class words in a row', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const round = buildRound(config.words, 30, seededRng(seed), { activeClasses: ACTIVE, maxMulti: 7 });
    assert.equal(round.filter(isMulti).length, 7);
    for (let i = 1; i < round.length; i++) {
      assert.ok(!(isMulti(round[i]) && isMulti(round[i - 1])), `seed ${seed} at ${i}`);
    }
  }
});

test('inactive classes are filtered; words with only inactive classes are excluded', () => {
  const active = ['substantiv', 'verb'];
  const round = buildRound(config.words, 30, seededRng(3), { activeClasses: active, maxMulti: 5 });
  for (const w of round) {
    assert.ok(w.classes.every((c) => active.includes(c)), w.word);
    assert.ok(w.classes.length >= 1);
  }
  // "kort" is adjektiv + substantiv: with only substantiv + verb it plays as a single-class word.
  const words = [
    { word: 'kort', classes: ['adjektiv', 'substantiv'] },
    { word: 'röd', classes: ['adjektiv'] },
    { word: 'hund', classes: ['substantiv'] },
    { word: 'äter', classes: ['verb'] }
  ];
  const r = buildRound(words, 3, seededRng(1), { activeClasses: active, maxMulti: 2 });
  assert.deepEqual(r.map((w) => w.word).sort(), ['hund', 'kort', 'äter']);
  assert.deepEqual(r.find((w) => w.word === 'kort').classes, ['substantiv']);
});

test('deterministic with a seeded rng; examples carried along', () => {
  const a = buildRound(config.words, 10, seededRng(9), { activeClasses: ACTIVE, maxMulti: 2 });
  const b = buildRound(config.words, 10, seededRng(9), { activeClasses: ACTIVE, maxMulti: 2 });
  assert.deepEqual(a, b);
  const multi = a.find(isMulti);
  assert.equal(Object.keys(multi.examples).length, 2);
  assert.deepEqual(a.find((w) => !isMulti(w)).examples, {});
});

test('throws a clear error when the pool is too small', () => {
  const words = [{ word: 'hund', classes: ['substantiv'] }, { word: 'äter', classes: ['verb'] }];
  assert.throws(() => buildRound(words, 3, seededRng(1), { activeClasses: ACTIVE }),
    /Ordbanken räcker inte: rundan behöver 3 ord men bara 2 går att spela\./);
});

test('lopsided pool: uses spare multi-class words and empty buckets', () => {
  const words = [
    { word: 'hund', classes: ['substantiv'] },
    { word: 'bär', classes: ['substantiv', 'verb'] },
    { word: 'får', classes: ['substantiv', 'verb'] },
    { word: 'fika', classes: ['substantiv', 'verb'] }
  ];
  const r = buildRound(words, 4, seededRng(2), { activeClasses: ['substantiv', 'verb'], maxMulti: 1 });
  assert.equal(r.length, 4);
  assert.equal(new Set(r.map((w) => w.word)).size, 4);
});
