import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import {
  CONFIG_FILES, REQUIRED_TEXTS, applyOverrides, contrast, loadConfig, normalizeWord,
  parseConfigFiles, validateConfig
} from '../../site/src/config.js';
import { ROOT, rawConfig, realConfig } from './helpers.mjs';

// A deep copy of the real config, changed by `edit`.
function variant(edit) {
  const raw = structuredClone(rawConfig());
  edit(raw);
  return validateConfig(raw);
}

function errorsOf(edit) {
  return variant(edit).errors;
}

test('the real config passes with zero errors and zero warnings', () => {
  const { errors, warnings, config } = validateConfig(rawConfig());
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(config.words.length, 70);
  assert.deepEqual(Object.keys(config.classMap), ['substantiv', 'verb', 'adjektiv']);
  assert.equal(config.words.filter((w) => w.classes.length > 1).length, 10);
});

test('short and long word forms normalize to the same result', () => {
  assert.deepEqual(normalizeWord({ word: ' hund ', class: 'substantiv' }), normalizeWord({ word: 'hund', classes: ['substantiv'] }));
  assert.deepEqual(normalizeWord({ word: 'hund', classes: ['substantiv'] }), { word: 'hund', classes: ['substantiv'], examples: {} });
  assert.deepEqual(normalizeWord({}), { word: '', classes: [], examples: {} });
  const short = variant((r) => { r.words.words[0] = { word: 'hund', class: 'substantiv' }; });
  assert.deepEqual(short.errors, []);
  assert.deepEqual(short.config.words[0], { word: 'hund', classes: ['substantiv'], examples: {} });
});

test('error: missing top-level structure', () => {
  assert.deepEqual(validateConfig({ settings: {}, classes: {}, words: {}, texts: null }).errors, [
    ...['wordsPerRound', 'minWordsPerRound', 'maxWordsPerRound', 'showHints', 'activeClasses', 'advanceDelayMs', 'multiClass', 'allowUrlOverrides']
      .map((k) => `settings.json: saknar "${k}"`),
    'classes.json: måste vara en lista med ordklasser',
    'words.json: måste ha en lista "words"',
    'texts.sv.json: måste vara ett objekt med texter'
  ]);
  assert.equal(validateConfig({ settings: {}, classes: [], words: { words: [] }, texts: {} }).config, null);
});

test('error: duplicate word, also case-insensitive and trimmed', () => {
  assert.deepEqual(errorsOf((r) => r.words.words.push({ word: 'hund', classes: ['substantiv'] })),
    ['words.json: ordet "hund" finns två gånger']);
  assert.deepEqual(errorsOf((r) => r.words.words.push({ word: ' Hund', classes: ['substantiv'] })),
    ['words.json: ordet "Hund" finns två gånger']);
});

test('error: unknown class, empty classes, word missing', () => {
  assert.deepEqual(errorsOf((r) => { r.words.words[1].classes = ['substantv']; }),
    ['words.json: ordet "katt" har okänd ordklass "substantv"']);
  assert.deepEqual(errorsOf((r) => { r.words.words[1].classes = []; }),
    ['words.json: ordet "katt" saknar ordklasser']);
  assert.deepEqual(errorsOf((r) => { r.words.words.push({ classes: ['verb'] }); }),
    ['words.json: ett ord saknar "word" ({"classes":["verb"]})']);
  assert.deepEqual(errorsOf((r) => { r.words.words.push(null); }),
    ['words.json: ett ord saknar "word" (null)']);
});

test('error: activeClasses unknown or fewer than 2', () => {
  assert.deepEqual(errorsOf((r) => { r.settings.activeClasses = ['substantiv', 'pronomen']; }),
    ['settings.json: activeClasses innehåller okänd ordklass "pronomen"']);
  assert.deepEqual(errorsOf((r) => { r.settings.activeClasses = ['substantiv']; }),
    ['settings.json: activeClasses måste ha minst 2 ordklasser']);
  assert.deepEqual(errorsOf((r) => { r.settings.activeClasses = 'substantiv'; }),
    ['settings.json: "activeClasses" måste vara en lista']);
});

test('error: wordsPerRound out of range, bad min/max', () => {
  assert.deepEqual(errorsOf((r) => { r.settings.wordsPerRound = 31; }),
    ['settings.json: wordsPerRound (31) måste ligga mellan 3 och 30']);
  assert.deepEqual(errorsOf((r) => { r.settings.wordsPerRound = 2; }),
    ['settings.json: wordsPerRound (2) måste ligga mellan 3 och 30']);
  assert.deepEqual(errorsOf((r) => { r.settings.wordsPerRound = 3.5; }),
    ['settings.json: wordsPerRound (3.5) måste ligga mellan 3 och 30']);
  assert.deepEqual(errorsOf((r) => { r.settings.minWordsPerRound = 40; }),
    ['settings.json: minWordsPerRound (40) och maxWordsPerRound (30) måste vara heltal med min ≤ max']);
  assert.deepEqual(errorsOf((r) => { r.settings.minWordsPerRound = 0; }),
    ['settings.json: minWordsPerRound (0) och maxWordsPerRound (30) måste vara heltal med min ≤ max']);
});

test('error: multiClass mode and cap', () => {
  assert.deepEqual(errorsOf((r) => { r.settings.multiClass.mode = 'some'; }),
    ['settings.json: multiClass.mode ("some") måste vara "any" eller "all"']);
  assert.deepEqual(errorsOf((r) => { r.settings.multiClass.maxPerRound = -1; }),
    ['settings.json: multiClass.maxPerRound måste vara ett heltal ≥ 0']);
  assert.deepEqual(errorsOf((r) => { r.settings.multiClass = {}; }), [
    'settings.json: multiClass.mode ("undefined") måste vara "any" eller "all"',
    'settings.json: multiClass.maxPerRound måste vara ett heltal ≥ 0'
  ]);
});

test('error: too few words to fill maxWordsPerRound', () => {
  assert.deepEqual(errorsOf((r) => { r.words.words = r.words.words.slice(0, 29); }),
    ['words.json: för få ord – maxWordsPerRound är 30 men bara 29 ord går att spela']);
});

test('error: missing text or placeholder', () => {
  assert.deepEqual(errorsOf((r) => { delete r.texts.progress; }), ['texts.sv.json: texten "progress" saknas']);
  assert.deepEqual(errorsOf((r) => { r.texts.promptWrong = '”{word}” är fel.'; }), [
    'texts.sv.json: "promptWrong" saknar {neg}',
    'texts.sv.json: "promptWrong" saknar {class}'
  ]);
  assert.deepEqual(errorsOf((r) => { r.texts.title = 5; }), ['texts.sv.json: texten "title" saknas']);
});

test('error: class definitions (missing keys, duplicates, article, colors)', () => {
  assert.deepEqual(errorsOf((r) => { r.classes[1].colors.tint = '#12'; }),
    ['classes.json: "verb" har ogiltig färg tint "#12" (ska vara #RRGGBB)']);
  assert.deepEqual(errorsOf((r) => { r.classes[1].colors = {}; }), [
    'classes.json: "verb" har ogiltig färg tint "undefined" (ska vara #RRGGBB)',
    'classes.json: "verb" har ogiltig färg deep "undefined" (ska vara #RRGGBB)'
  ]);
  assert.deepEqual(errorsOf((r) => { r.classes[1].article = 'det'; }),
    ['classes.json: "verb" har article "det", ska vara "en" eller "ett"']);
  assert.deepEqual(errorsOf((r) => { r.classes.push(structuredClone(r.classes[0])); }),
    ['classes.json: ordklassen "substantiv" finns två gånger']);
  const missing = errorsOf((r) => { delete r.classes[2].hint; delete r.classes[2].symbol; });
  assert.equal(missing[0], 'classes.json: ordklass "adjektiv" saknar "symbol", "hint"');
  assert.equal(errorsOf((r) => { r.classes.push({}); })[0], 'classes.json: ordklass nummer 4 saknar "key", "name", "article", "symbol", "hint", "description", "example", "moreExamples", "colors"');
});

test('error: invalid JSON names the file', () => {
  const sources = Object.fromEntries(Object.keys(CONFIG_FILES).map((k) => [k, '{}']));
  sources.words = '{ "words": [ { "word": "hund", } ] }';
  const { errors } = parseConfigFiles(sources);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /^words\.json: ogiltig JSON \(/);
});

test('warnings: missing example sentence, unbalanced class, low contrast', () => {
  const ex = variant((r) => { delete r.words.words.find((w) => w.word === 'bär').examples.verb; });
  assert.deepEqual(ex.errors, []);
  assert.deepEqual(ex.warnings, ['words.json: "bär" saknar exempelmening för verb']);
  assert.ok(ex.config);

  const unbalanced = variant((r) => { r.words.words = r.words.words.filter((w) => !['hund', 'katt', 'bil', 'hus', 'stol', 'boll', 'äpple', 'fönster', 'träd', 'cykel', 'lampa'].includes(w.word)); });
  assert.deepEqual(unbalanced.errors, []);
  assert.deepEqual(unbalanced.warnings, ['words.json: substantiv har 9 ord med bara den ordklassen – minst 10 behövs för jämna rundor']);

  const low = variant((r) => { r.classes[0].colors.deep = '#E0A070'; });
  assert.deepEqual(low.errors, []);
  assert.match(low.warnings[0], /^classes\.json: "substantiv" har för låg kontrast mellan deep och tint \(\d\.\d:1, minst 4\.5:1\)$/);
});

test('contrast ratio', () => {
  assert.equal(Math.round(contrast('#FFFFFF', '#000000')), 21);
  assert.equal(contrast('#777777', '#777777'), 1);
  assert.ok(contrast('#FCE6D4', '#8A420E') >= 4.5);
});

test('REQUIRED_TEXTS covers every key in texts.sv.json and vice versa', () => {
  const texts = JSON.parse(readFileSync(ROOT + 'site/config/texts.sv.json', 'utf8'));
  assert.deepEqual(Object.keys(texts).sort(), Object.keys(REQUIRED_TEXTS).sort());
});

function fakeFetch(files) {
  const calls = [];
  const fn = async (url) => {
    calls.push(url);
    const name = url.split('?')[0].split('/').pop();
    if (files[name] instanceof Error) throw files[name];
    if (files[name] == null) return { ok: false, status: 404, text: async () => '' };
    return { ok: true, status: 200, text: async () => files[name] };
  };
  fn.calls = calls;
  return fn;
}

function realFiles() {
  return Object.fromEntries(Object.values(CONFIG_FILES).map((f) => [f, readFileSync(`${ROOT}site/config/${f}`, 'utf8')]));
}

test('loadConfig fetches all four files with a cache-busting version', async () => {
  const fetch = fakeFetch(realFiles());
  const { errors, config } = await loadConfig(fetch, './config/', 'abc 123');
  assert.deepEqual(errors, []);
  assert.equal(config.words.length, 70);
  assert.deepEqual(fetch.calls.sort(), [
    './config/classes.json?v=abc%20123', './config/settings.json?v=abc%20123',
    './config/texts.sv.json?v=abc%20123', './config/words.json?v=abc%20123'
  ]);
});

test('loadConfig reports fetch failures, bad JSON and validation errors', async () => {
  const missing = await loadConfig(fakeFetch({ ...realFiles(), 'words.json': null }), './', 'v');
  assert.deepEqual(missing.errors, ['words.json: kunde inte hämtas (HTTP 404)']);
  assert.equal(missing.config, null);
  const offline = await loadConfig(fakeFetch({ ...realFiles(), 'texts.sv.json': new Error('offline') }), './', 'v');
  assert.deepEqual(offline.errors, ['texts.sv.json: kunde inte hämtas (offline)']);
  const bad = await loadConfig(fakeFetch({ ...realFiles(), 'settings.json': '{' }), './', 'v');
  assert.match(bad.errors[0], /^settings\.json: ogiltig JSON/);
  const invalid = await loadConfig(fakeFetch({ ...realFiles(), 'classes.json': '[]' }), './', 'v');
  assert.ok(invalid.errors.includes('settings.json: activeClasses innehåller okänd ordklass "substantiv"'));
});

test('URL overrides: applied, clamped, unknown classes ignored', () => {
  const config = realConfig();
  const o = applyOverrides(config, new URLSearchParams('ord=20&klasser=substantiv,verb,pronomen,verb&tips=0&lage=all'));
  assert.equal(o.settings.wordsPerRound, 20);
  assert.deepEqual(o.settings.activeClasses, ['substantiv', 'verb']);
  assert.equal(o.settings.showHints, false);
  assert.equal(o.settings.multiClass.mode, 'all');
  assert.equal(config.settings.wordsPerRound, 10, 'original untouched');
  assert.equal(config.settings.multiClass.mode, 'any', 'original untouched');

  assert.equal(applyOverrides(config, new URLSearchParams('ord=99')).settings.wordsPerRound, 30);
  assert.equal(applyOverrides(config, new URLSearchParams('ord=1')).settings.wordsPerRound, 3);
  assert.equal(applyOverrides(config, new URLSearchParams('ord=tio')).settings.wordsPerRound, 10);
  assert.deepEqual(applyOverrides(config, new URLSearchParams('klasser=verb,pronomen')).settings.activeClasses,
    ['substantiv', 'verb', 'adjektiv'], 'fewer than 2 valid classes → ignored');
  const odd = applyOverrides(config, new URLSearchParams('tips=ja&lage=x'));
  assert.equal(odd.settings.showHints, true);
  assert.equal(odd.settings.multiClass.mode, 'any');
  assert.equal(applyOverrides(config, new URLSearchParams('tips=1')).settings.showHints, true);
});

test('URL overrides are off when allowUrlOverrides is false', () => {
  const config = realConfig();
  const locked = { ...config, settings: { ...config.settings, allowUrlOverrides: false } };
  assert.equal(applyOverrides(locked, new URLSearchParams('ord=20&tips=0')), locked);
});

test('validate-config CLI: a typo in words.json fails with a clear message', () => {
  const ok = execFileSync('node', ['scripts/validate-config.mjs'], { cwd: ROOT, encoding: 'utf8' });
  assert.match(ok, /är giltig \(0 varningar\)/);
  let failed;
  try {
    execFileSync('node', ['scripts/validate-config.mjs', 'tests/fixtures/typo-in-words'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) { failed = e; }
  assert.ok(failed, 'exits non-zero');
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /fel: words\.json: ordet "katt" har okänd ordklass "substantv"/);
  let missingDir;
  try {
    execFileSync('node', ['scripts/validate-config.mjs', 'tests/fixtures/nope'], { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
  } catch (e) { missingDir = e; }
  assert.match(missingDir.stderr, /settings\.json: kunde inte läsas \(ENOENT\)/);
});
