import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../site/src/ui/start.js';
import { click, makeDom, realConfig, rawConfig } from './helpers.mjs';
import { validateConfig } from '../../site/src/config.js';

const config = realConfig();
const T = (root, id) => root.querySelector(`[data-testid="${id}"]`);

function setup({ mobile = false, best = null, cfg = config } = {}) {
  const { root } = makeDom({ mobile });
  const calls = [];
  render({ screen: 'start', best }, { config: cfg, mobile, best, onStart: () => calls.push('START') }, root);
  return { root, calls };
}

test('texts and one card per active class with name, example, description, chips', () => {
  const { root } = setup();
  assert.equal(root.dataset.screen, 'start');
  assert.equal(T(root, 'kicker').textContent, 'Ordklasser');
  assert.equal(T(root, 'title').textContent, 'Vilken ordklass är ordet?');
  assert.equal(T(root, 'title').tagName, 'H1');
  assert.equal(T(root, 'subtitle').textContent, 'Så känner du igen dem. Sedan kör du mot klockan.');
  const cards = root.querySelectorAll('.card');
  assert.equal(cards.length, 3);
  const verb = T(root, 'card-verb');
  assert.equal(verb.querySelector('.card-name').textContent, 'verb');
  assert.equal(verb.querySelector('.card-example').textContent, 'äta');
  assert.equal(verb.querySelector('.card-desc').textContent, 'Något man gör eller något som händer.');
  assert.deepEqual([...verb.querySelectorAll('.chip')].map((c) => c.textContent), ['läsa', 'sova', 'bygga']);
  assert.match(verb.getAttribute('style'), /--tint:#DCE8FA;--deep:#1D4C91/);
  assert.equal(root.querySelector('.cards').getAttribute('style'), '--cols:3');
});

test('desktop reads name first; mobile puts the example first', () => {
  const desk = setup().root.querySelector('[data-testid="card-verb"]');
  assert.deepEqual([...desk.children].map((c) => c.className), ['card-name', 'card-example', 'card-desc', 'chips']);
  const mob = setup({ mobile: true }).root.querySelector('[data-testid="card-verb"]');
  assert.deepEqual([...mob.children].map((c) => c.className), ['card-example', 'card-text']);
  assert.deepEqual([...mob.querySelector('.card-text').children].map((c) => c.className), ['card-name', 'card-desc', 'chips']);
});

test('round info text follows wordsPerRound', () => {
  const { root } = setup();
  assert.equal(T(root, 'round-info').textContent, '10 ord per runda. Klockan går tills du valt rätt på alla.');
  const twenty = { ...config, settings: { ...config.settings, wordsPerRound: 20 } };
  assert.match(T(setup({ cfg: twenty }).root, 'round-info').textContent, /^20 ord per runda/);
});

test('best time shown only when stored', () => {
  assert.equal(T(setup().root, 'best-so-far'), null);
  assert.equal(T(setup({ best: 21300 }).root, 'best-so-far').textContent, 'Bästa tid hittills: 21,3 s');
});

test('start button is a real button and dispatches START', () => {
  const { root, calls } = setup();
  const btn = T(root, 'start-button');
  assert.equal(btn.tagName, 'BUTTON');
  assert.equal(btn.type, 'button');
  assert.equal(btn.textContent, 'starta');
  assert.equal(btn.querySelector('svg').getAttribute('aria-hidden'), 'true');
  click(btn);
  assert.deepEqual(calls, ['START']);
});

test('content is escaped', () => {
  const raw = structuredClone(rawConfig());
  raw.texts.title = '<b>Ord</b> & "så"';
  const { config: cfg } = validateConfig(raw);
  assert.equal(T(setup({ cfg }).root, 'title').innerHTML, '&lt;b&gt;Ord&lt;/b&gt; &amp; "så"');
});

test('4 classes: 2×2 card grid', () => {
  const raw = structuredClone(rawConfig());
  raw.classes.push({ ...structuredClone(raw.classes[0]), key: 'pronomen', name: 'pronomen', symbol: 'P' });
  raw.settings.activeClasses.push('pronomen');
  const { config: cfg } = validateConfig(raw);
  const { root } = setup({ cfg });
  assert.equal(root.querySelectorAll('.card').length, 4);
  assert.equal(root.querySelector('.cards').getAttribute('style'), '--cols:2');
});
