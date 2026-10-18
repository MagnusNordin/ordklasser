import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bestLine, choiceState, currentWord, elapsedMs, initialState, isChoiceDimmed, isChoiceDisabled,
  exampleLines, missLine, reduce, rulerTicks, showBadge, statusLine
} from '../../site/src/game.js';
import { realConfig } from './helpers.mjs';

const { classMap, texts } = realConfig();
const W = (word, ...classes) => ({ word, classes, examples: {} });
const ROUND = [W('hund', 'substantiv'), W('äter', 'verb'), W('röd', 'adjektiv')];

function started(round = ROUND, { mode = 'any', best = null, now = 1000 } = {}) {
  return reduce(initialState(best), { type: 'START', round, now, mode });
}

function play(state, picks) {
  for (const [key, now] of picks) state = reduce(state, { type: 'PICK', key, now });
  return state;
}

test('initial state and unknown actions', () => {
  const s = initialState();
  assert.deepEqual(s, { screen: 'start', best: null });
  assert.equal(initialState(5000).best, 5000);
  assert.equal(reduce(s, { type: 'NOPE' }), s);
  assert.equal(currentWord(s), null);
  assert.equal(elapsedMs(s, 99), 0);
});

test('START builds a fresh quiz state; ignored while a quiz runs', () => {
  const s = started(ROUND, { best: 9000 });
  assert.equal(s.screen, 'quiz');
  assert.equal(s.index, 0);
  assert.equal(s.mode, 'any');
  assert.equal(s.best, 9000);
  assert.equal(s.segStart, 1000);
  assert.deepEqual([s.wrong, s.found, s.history, s.misses, s.accMs], [[], [], [], 0, 0]);
  assert.equal(reduce(s, { type: 'START', round: ROUND, now: 5 }), s);
  assert.equal(currentWord(s).word, 'hund');
  // START keeps the best time already in state, mode defaults to "any".
  const again = reduce({ screen: 'result', best: 7000 }, { type: 'START', round: ROUND, now: 0 });
  assert.equal(again.best, 7000);
  assert.equal(again.mode, 'any');
  assert.equal(reduce({ screen: 'start' }, { type: 'START', round: ROUND, now: 0 }).best, null);
});

test('PICK wrong: marks the class, counts a miss, repeated wrong pick ignored', () => {
  let s = started();
  s = reduce(s, { type: 'PICK', key: 'verb', now: 1500 });
  assert.deepEqual(s.wrong, ['verb']);
  assert.equal(s.misses, 1);
  assert.equal(s.solved, false);
  assert.equal(reduce(s, { type: 'PICK', key: 'verb', now: 1600 }), s);
  s = reduce(s, { type: 'PICK', key: 'adjektiv', now: 1700 });
  assert.equal(s.misses, 2);
});

test('PICK right: solves, records time and history; pick after solve ignored', () => {
  let s = play(started(), [['verb', 1500], ['substantiv', 3700]]);
  assert.equal(s.solved, true);
  assert.equal(s.accMs, 2700);
  assert.deepEqual(s.found, ['substantiv']);
  assert.deepEqual(s.history, [{ word: 'hund', classes: ['substantiv'], first: 'substantiv', ms: 2700, miss: true }]);
  assert.equal(reduce(s, { type: 'PICK', key: 'adjektiv', now: 4000 }), s);
  assert.equal(elapsedMs(s, 99999), 2700);
});

test('PICK and ADVANCE outside the quiz are ignored', () => {
  const start = initialState();
  assert.equal(reduce(start, { type: 'PICK', key: 'verb', now: 1 }), start);
  assert.equal(reduce(start, { type: 'ADVANCE', now: 1 }), start);
  assert.equal(reduce(start, { type: 'PAUSE', now: 1 }), start);
  assert.equal(reduce(start, { type: 'RESUME', now: 1 }), start);
  assert.equal(reduce(start, { type: 'QUIT' }), start);
  const unsolved = started();
  assert.equal(reduce(unsolved, { type: 'ADVANCE', now: 1 }), unsolved);
});

test('time excludes the pause after a correct answer', () => {
  let s = play(started(), [['substantiv', 3000]]); // 2000 ms
  s = reduce(s, { type: 'ADVANCE', now: 3700 });
  assert.equal(s.index, 1);
  assert.equal(s.segStart, 3700);
  assert.deepEqual([s.wrong, s.found, s.solved, s.wordMs], [[], [], false, 0]);
  assert.equal(elapsedMs(s, 4700), 3000);
  s = play(s, [['verb', 4700]]);
  assert.equal(s.accMs, 3000);
});

test('PAUSE/RESUME exclude hidden time, also across the advance pause', () => {
  let s = started();
  s = reduce(s, { type: 'PAUSE', now: 1500 });
  assert.equal(s.paused, true);
  assert.equal(s.wordMs, 500);
  assert.equal(elapsedMs(s, 99999), 500);
  assert.equal(reduce(s, { type: 'PAUSE', now: 1600 }), s);
  assert.equal(reduce(s, { type: 'PICK', key: 'substantiv', now: 1600 }), s, 'no picks while paused');
  s = reduce(s, { type: 'RESUME', now: 10000 });
  assert.equal(s.paused, false);
  assert.equal(reduce(s, { type: 'RESUME', now: 10001 }), s);
  assert.equal(elapsedMs(s, 10200), 700);
  s = play(s, [['substantiv', 10500]]);
  assert.equal(s.accMs, 1000);
  // Hidden during the advance pause: the next word starts paused.
  s = reduce(s, { type: 'PAUSE', now: 10600 });
  assert.equal(s.wordMs, 500, 'solved word time untouched');
  s = reduce(s, { type: 'ADVANCE', now: 11000 });
  assert.equal(s.paused, true);
  assert.equal(elapsedMs(s, 50000), 1000);
  s = reduce(s, { type: 'RESUME', now: 60000 });
  assert.equal(elapsedMs(s, 60400), 1400);
});

test('last word → result; first round sets best without a record', () => {
  let s = started();
  s = play(s, [['substantiv', 2000]]);
  s = reduce(s, { type: 'ADVANCE', now: 2700 });
  s = play(s, [['verb', 3700]]);
  s = reduce(s, { type: 'ADVANCE', now: 4400 });
  s = play(s, [['adjektiv', 5400]]);
  s = reduce(s, { type: 'ADVANCE', now: 6100 });
  assert.equal(s.screen, 'result');
  assert.equal(s.totalMs, 3000);
  assert.equal(s.best, 3000);
  assert.equal(s.prevBest, null);
  assert.equal(s.record, false);
  assert.equal(elapsedMs(s, 0), 3000);
  assert.equal(currentWord(s).word, 'röd');
  assert.equal(bestLine(s, texts), null);
  assert.equal(missLine(s, texts), 'Rätt på första försöket varje gång!');
});

function finish(best, ms) {
  let s = started([W('hund', 'substantiv')], { best, now: 0 });
  s = play(s, [['verb', 10], ['substantiv', ms]]);
  return reduce(s, { type: 'ADVANCE', now: ms + 700 });
}

test('record vs. non-record vs. tie', () => {
  const rec = finish(5000, 4000);
  assert.deepEqual([rec.record, rec.best, rec.prevBest], [true, 4000, 5000]);
  assert.deepEqual(bestLine(rec, texts), { kind: 'record', text: 'Nytt rekord! Förra bästa var 5,0 s.' });
  const slow = finish(3000, 4000);
  assert.deepEqual([slow.record, slow.best], [false, 3000]);
  assert.deepEqual(bestLine(slow, texts), { kind: 'best', text: 'Bästa tid: 3,0 s' });
  const tie = finish(4000, 4000);
  assert.equal(tie.record, false);
  assert.equal(bestLine(tie, texts), null);
  assert.equal(missLine(slow, texts), 'Felklick på vägen: 1');
});

test('QUIT from quiz or result returns to start keeping the best time', () => {
  const q = reduce(started(ROUND, { best: 1234 }), { type: 'QUIT' });
  assert.deepEqual(q, { screen: 'start', best: 1234 });
  const r = reduce(finish(5000, 4000), { type: 'QUIT' });
  assert.deepEqual(r, { screen: 'start', best: 4000 });
  assert.deepEqual(reduce({ screen: 'quiz' }, { type: 'QUIT' }), { screen: 'start', best: null });
});

test('multi-class word, "any" mode: either class solves it', () => {
  const round = [W('bär', 'substantiv', 'verb')];
  for (const key of ['substantiv', 'verb']) {
    const s = play(started(round), [[key, 2000]]);
    assert.equal(s.solved, true);
    assert.deepEqual(s.history[0].classes, ['substantiv', 'verb']);
    assert.equal(s.history[0].first, key);
  }
});

test('multi-class word, "all" mode: every class must be found', () => {
  const round = [W('bär', 'substantiv', 'verb')];
  let s = started(round, { mode: 'all' });
  s = play(s, [['verb', 1500]]);
  assert.equal(s.solved, false);
  assert.deepEqual(s.found, ['verb']);
  assert.equal(elapsedMs(s, 2000), 1000, 'timer keeps running');
  assert.equal(reduce(s, { type: 'PICK', key: 'verb', now: 1600 }), s, 'found class cannot be picked again');
  s = play(s, [['adjektiv', 1700], ['substantiv', 2500]]);
  assert.equal(s.solved, true);
  assert.equal(s.accMs, 1500);
  assert.deepEqual(s.history[0], { word: 'bär', classes: ['substantiv', 'verb'], first: 'verb', ms: 1500, miss: true });
});

test('"all" mode with an inactive class plays as a single-class word', () => {
  // Round items carry only active classes (round.js narrows them).
  const s = play(started([W('kort', 'substantiv')], { mode: 'all' }), [['substantiv', 2000]]);
  assert.equal(s.solved, true);
});

test('rulerTicks: labels every word up to 12, else every 5th and the last', () => {
  const t10 = rulerTicks(10, 3, false);
  assert.equal(t10.length, 11);
  assert.ok(t10.every((t) => t.major));
  assert.deepEqual(t10.filter((t) => t.current).map((t) => t.label), ['4']);
  assert.equal(t10[4].showLabel, false);
  assert.deepEqual(t10.filter((t) => t.done).map((t) => t.label), ['0', '1', '2', '3']);
  const solved = rulerTicks(10, 3, true);
  assert.ok(solved.every((t) => !t.current));
  assert.equal(solved.filter((t) => t.done).length, 5);
  const t12 = rulerTicks(12, 0, false);
  assert.ok(t12.every((t) => t.major));
  const t13 = rulerTicks(13, 0, false);
  assert.deepEqual(t13.filter((t) => t.major).map((t) => t.label), ['0', '5', '10', '13']);
  const last = rulerTicks(3, 2, true);
  assert.ok(last.every((t) => t.done));
});

test('choiceState and isChoiceDisabled for every state', () => {
  let s = started([W('bär', 'substantiv', 'verb'), W('hund', 'substantiv')]);
  assert.equal(choiceState(s, 'verb'), 'neutral');
  assert.equal(isChoiceDisabled(s, 'verb'), false);
  s = play(s, [['adjektiv', 1100]]);
  assert.equal(choiceState(s, 'adjektiv'), 'wrong');
  assert.equal(isChoiceDimmed(s, 'adjektiv'), false, 'not before the solve');
  assert.equal(isChoiceDisabled(s, 'adjektiv'), true);
  s = play(s, [['verb', 1200]]);
  assert.equal(choiceState(s, 'verb'), 'right');
  assert.equal(choiceState(s, 'substantiv'), 'also');
  assert.equal(choiceState(s, 'adjektiv'), 'wrong');
  assert.equal(isChoiceDimmed(s, 'adjektiv'), true, 'wrong picks fade after the solve');
  assert.equal(isChoiceDimmed(s, 'substantiv'), false, '"also" stays visible');
  assert.equal(isChoiceDimmed(s, 'verb'), false);
  assert.equal(isChoiceDisabled(s, 'substantiv'), true);
  s = reduce(s, { type: 'ADVANCE', now: 2000 });
  s = play(s, [['substantiv', 2500]]);
  assert.equal(choiceState(s, 'verb'), 'dimmed');
  assert.equal(isChoiceDimmed(s, 'verb'), true);
  assert.equal(isChoiceDimmed(s, 'substantiv'), false);
  let all = started([W('bär', 'substantiv', 'verb')], { mode: 'all' });
  all = play(all, [['verb', 1100]]);
  assert.equal(choiceState(all, 'verb'), 'right');
  assert.equal(isChoiceDisabled(all, 'verb'), true);
  assert.equal(choiceState(all, 'substantiv'), 'neutral');
  assert.equal(isChoiceDisabled(all, 'substantiv'), false);
});

test('statusLine texts: idle, wrong, right and the multi-class variants', () => {
  let s = started();
  assert.deepEqual(statusLine(s, classMap, texts), { kind: 'idle', text: 'Tryck på rätt ordklass.' });
  s = play(s, [['verb', 1100]]);
  assert.deepEqual(statusLine(s, classMap, texts), { kind: 'wrong', text: '”hund” är inget verb. Försök igen.' });
  s = play(s, [['substantiv', 1200]]);
  assert.deepEqual(statusLine(s, classMap, texts), { kind: 'right', text: 'Rätt! ”hund” är ett substantiv.' });

  const any = play(started([W('bär', 'substantiv', 'verb')]), [['verb', 1100]]);
  assert.equal(statusLine(any, classMap, texts).text, 'Rätt! ”bär” är ett verb – men kan också vara ett substantiv.');

  let all = play(started([W('bär', 'substantiv', 'verb')], { mode: 'all' }), [['verb', 1100]]);
  assert.deepEqual(statusLine(all, classMap, texts), { kind: 'right', text: 'Rätt! ”bär” är ett verb. Det finns en ordklass till – hitta den!' });
  all = play(all, [['substantiv', 1200]]);
  assert.equal(statusLine(all, classMap, texts).text, 'Rätt! ”bär” kan vara både ett substantiv och ett verb.');

  const three = play(started([W('x', 'substantiv', 'verb', 'adjektiv')], { mode: 'all' }), [['verb', 1100]]);
  assert.equal(statusLine(three, classMap, texts).text, 'Rätt! ”x” är ett verb. Det finns 2 ordklasser till – hitta dem!');

  const en = { ...classMap, verb: { ...classMap.verb, article: 'en', name: 'räkneord' } };
  const wrongEn = play(started(), [['verb', 1100]]);
  assert.equal(statusLine(wrongEn, en, texts).text, '”hund” är ingen räkneord. Försök igen.');
});

test('showBadge: only "all" mode and only multi-class words', () => {
  const multi = [{ word: 'bär', classes: ['substantiv', 'verb'], examples: {} }];
  assert.equal(showBadge(started(multi, { mode: 'all' })), true);
  assert.equal(showBadge(started(multi, { mode: 'any' })), false);
  assert.equal(showBadge(started(ROUND, { mode: 'all' })), false);
});

test('exampleLines: after a solve, found classes first, missing sentences skipped', () => {
  const ex = { substantiv: 'Vi plockar bär i skogen.', verb: 'Hon bär en tung väska.' };
  const round = [{ word: 'bär', classes: ['substantiv', 'verb'], examples: ex }];
  let s = started(round);
  assert.deepEqual(exampleLines(s), [], 'nothing before the solve');
  s = play(s, [['verb', 1500]]);
  assert.deepEqual(exampleLines(s), [{ key: 'verb', sentence: ex.verb }, { key: 'substantiv', sentence: ex.substantiv }]);
  const partial = [{ word: 'bär', classes: ['substantiv', 'verb'], examples: { verb: ex.verb } }];
  assert.deepEqual(exampleLines(play(started(partial), [['substantiv', 1200]])), [{ key: 'verb', sentence: ex.verb }]);
  const noExamples = [{ word: 'bär', classes: ['substantiv', 'verb'] }];
  assert.deepEqual(exampleLines(play(started(noExamples), [['verb', 1200]])), []);
  const single = [{ word: 'hund', classes: ['substantiv'], examples: { substantiv: 'En hund.' } }];
  assert.deepEqual(exampleLines(play(started(single), [['substantiv', 1200]])), [], 'single-class words keep the design');
  let all = play(started(round, { mode: 'all' }), [['substantiv', 1100]]);
  assert.deepEqual(exampleLines(all), [], 'not while a class is still missing');
  all = play(all, [['verb', 1300]]);
  assert.deepEqual(exampleLines(all).map((e) => e.key), ['substantiv', 'verb']);
});
