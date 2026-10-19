// The design fixture config (and the real classes/texts) carry exactly the
// strings and values in design/source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fill } from '../../site/src/format.js';
import { ROOT, designConfig, loadPrototype, rawConfig, readJson } from './helpers.mjs';

const MAIN = readFileSync(ROOT + 'design/source/Main.dc.html', 'utf8');
const MOBILE = readFileSync(ROOT + 'design/source/MobileMain.dc.html', 'utf8');
const config = designConfig();
const Proto = loadPrototype();
const proto = new Proto({ screen: 'start', words: 10, showHints: true });
const plain = (v) => JSON.parse(JSON.stringify(v));

test('classes: names, symbols, hints, descriptions, examples and colors', () => {
  const theirs = plain(proto.classes());
  assert.deepEqual(config.classes.map((c) => c.key), theirs.map((c) => c.key));
  for (const c of theirs) {
    const ours = config.classMap[c.key];
    assert.equal(ours.name, c.name);
    assert.equal(ours.symbol, c.sym);
    assert.equal(ours.hint, c.hint);
    assert.equal(ours.description, c.long);
    assert.equal(ours.example, c.ex);
    assert.deepEqual(ours.moreExamples, c.more);
    assert.deepEqual(ours.colors, { tint: c.tint, deep: c.deep });
    assert.equal(ours.article, 'ett');
  }
  // The real config equals the design, except that the verb card shows base forms
  // (äta, läsa, sova, bygga) where the design shows present tense (äter, läser, …).
  const BASE_FORM_VERBS = { example: 'äta', moreExamples: ['läsa', 'sova', 'bygga'] };
  const design = rawConfig('tests/fixtures/design-config').classes;
  const expected = design.map((c) => (c.key === 'verb' ? { ...c, ...BASE_FORM_VERBS } : c));
  assert.deepEqual(rawConfig().classes, expected, 'real classes equal the design apart from the base-form verbs');
  assert.deepEqual(design.find((c) => c.key === 'verb').moreExamples, ['läser', 'sover', 'bygger'], 'the design itself is unchanged');
});

test('word bank of the design fixture equals the prototype bank', () => {
  const bank = plain(proto.bank());
  const ours = {};
  for (const w of config.words) (ours[w.classes[0]] ||= []).push(w.word);
  assert.deepEqual(ours, bank);
});

test('settings equal the prototype defaults', () => {
  const props = JSON.parse(MAIN.match(/data-props='([^']+)'/)[1]);
  const s = config.settings;
  assert.equal(s.wordsPerRound, props.words.default);
  assert.equal(s.minWordsPerRound, props.words.min);
  assert.equal(s.maxWordsPerRound, props.words.max);
  assert.equal(s.showHints, props.showHints.default);
  assert.match(MAIN, new RegExp(`self\\.advance\\(\\); \\}, ${s.advanceDelayMs}\\)`));
  assert.deepEqual(s.activeClasses, ['substantiv', 'verb', 'adjektiv']);
  assert.equal(s.multiClass.maxPerRound, 0, 'the design has no multi-class words');
});

test('static texts appear verbatim in the design markup', () => {
  const t = config.texts;
  for (const key of ['kicker', 'title', 'subtitle', 'start', 'quit', 'question', 'resultKicker', 'legendDirect', 'legendMissed', 'playAgain', 'toStart']) {
    assert.ok(MAIN.includes(`>${t[key]}<`) || MAIN.includes(`>${t[key]}<svg`), `${key}: "${t[key]}"`);
  }
  assert.ok(MAIN.includes(`aria-label="${t.timerLabel}"`));
  assert.ok(MOBILE.includes(`aria-label="${t.quit}"`));
  assert.ok(MAIN.includes(`>${t.seconds}</span>`));
});

test('dynamic texts equal what the prototype renders for the design states', () => {
  const t = config.texts;
  const at = (screen, file = 'design/source/Main.dc.html') => {
    const P = loadPrototype(file);
    return new P({ screen, words: 10, showHints: true }).renderVals();
  };
  const start = at('start');
  assert.equal(start.roundText, fill(t.roundInfo, { n: 10 }));
  assert.equal(fill(t.bestSoFar, { time: '21,3' }), start.bestText.replace(/[\d,]+(?= s$)/, '21,3'));
  const quiz = at('quiz');
  assert.equal(quiz.progressText, fill(t.progress, { i: 4, n: 10 }));
  assert.equal(quiz.statusText, t.promptIdle);
  assert.equal(at('quiz', 'design/source/MobileMain.dc.html').progressText, fill(t.progressShort, { i: 4, n: 10 }));
  assert.equal(at('wrong').statusText, fill(t.promptWrong, { word: 'springer', neg: 'inget', class: 'substantiv' }));
  assert.equal(at('correct').statusText, fill(t.promptRight, { word: 'springer', art: 'ett', class: 'verb' }));
  const result = at('result');
  assert.equal(result.resultLine, fill(t.resultLine, { n: 10, time: '23,4' }));
  assert.equal(result.missLine, fill(t.misses, { n: 3 }));
  assert.equal(result.bestLine, fill(t.bestTime, { time: '21,3' }));
  assert.ok(MAIN.includes(`'${t.noMisses}'`));
  assert.ok(MAIN.includes(`'${fill(t.newRecord, { time: "' + this.fmt(s.prevBest) + '" })}'`));
  assert.ok(MAIN.includes(`', ${t.ariaWrong}'`) && MAIN.includes(`', ${t.ariaRight}'`));
});

test('the real texts file equals the design fixture texts', () => {
  assert.deepEqual(readJson('site/config/texts.sv.json'), readJson('tests/fixtures/design-config/texts.sv.json'));
});

test('multi-class texts and class data equal the approved artboards', () => {
  const MULTI = readFileSync(ROOT + 'design/source/Multi.dc.html', 'utf8');
  const t = config.texts;
  assert.ok(MULTI.includes(`>${fill(t.badge, { n: 2 })}</span>`));
  assert.ok(MULTI.includes(`', ${t.ariaAlso}'`));
  assert.ok(MULTI.includes(`</span>${t.legendMulti}</span>`));
  const P = loadPrototype('design/source/Multi.dc.html');
  const theirs = plain(new P({ screen: 'any' }).classes());
  for (const c of theirs) {
    const ours = config.classMap[c.key];
    assert.deepEqual([ours.name, ours.symbol, ours.hint, ours.colors.tint, ours.colors.deep], [c.name, c.sym, c.hint, c.tint, c.deep]);
  }
  const at = (screen) => new P({ screen, showHints: true }).renderVals();
  assert.equal(at('any').statusText, fill(t.promptRightAlso, { word: 'kort', art: 'ett', class: 'adjektiv', others: 'ett substantiv' }));
  assert.equal(at('all-partial').statusText, fill(t.promptFoundOneMore, { word: 'bär', art: 'ett', class: 'verb' }));
  assert.equal(at('all-done').statusText, fill(t.promptFoundAll, { word: 'bär', all: 'ett substantiv och ett verb' }));
  const real = readJson('site/config/words.json').words.find((w) => w.word === 'kort');
  assert.deepEqual(plain(at('any').examples).map((e) => e.before + e.word + e.after), [real.examples.adjektiv, real.examples.substantiv]);
});
