import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyToClass, render, timerText, updateTimer } from '../../site/src/ui/quiz.js';
import { demoState } from '../../site/src/demo.js';
import { initialState, reduce } from '../../site/src/game.js';
import { click, key, makeDom, realConfig } from './helpers.mjs';

const config = realConfig();
const T = (root, id) => root.querySelector(`[data-testid="${id}"]`);
const W = (word, ...classes) => ({ word, classes, examples: {} });

function setup(state, { mobile = false, cfg = config, now = 0 } = {}) {
  const { root } = makeDom({ mobile });
  const calls = [];
  render(state, { config: cfg, mobile, now, onQuit: () => calls.push('QUIT'), onPick: (k) => calls.push(k) }, root);
  return { root, calls };
}

test('word, progress and timer texts', () => {
  const { root } = setup(demoState('quiz'));
  assert.equal(root.dataset.screen, 'quiz');
  assert.equal(T(root, 'word').textContent, 'springer');
  assert.equal(T(root, 'word').getAttribute('lang'), 'sv');
  assert.equal(T(root, 'progress').textContent, 'Ord 4 av 10');
  assert.equal(T(root, 'timer').getAttribute('role'), 'timer');
  assert.equal(T(root, 'timer').getAttribute('aria-label'), 'Tid');
  assert.equal(root.querySelector('.timer-value').textContent, '8,6 s');
  assert.equal(T(root, 'question').textContent, 'Vilken ordklass?');
});

test('ruler: tick count, tall current tick, labels every word / every 5th', () => {
  const { root } = setup(demoState('quiz'));
  assert.equal(T(root, 'ruler').getAttribute('aria-hidden'), 'true');
  const bars = root.querySelectorAll('.tick-bar');
  assert.equal(bars.length, 11);
  assert.equal(root.querySelectorAll('.tick-bar.is-current').length, 1);
  assert.ok(bars[4].classList.contains('is-current'));
  assert.equal(root.querySelectorAll('.tick-bar.is-done').length, 4);
  assert.deepEqual([...root.querySelectorAll('.tick-label')].map((l) => l.textContent), ['0', '1', '2', '3', '5', '6', '7', '8', '9', '10']);
  const twenty = setup(demoState('quiz', 20)).root;
  assert.equal(twenty.querySelectorAll('.tick-bar').length, 21);
  assert.deepEqual([...twenty.querySelectorAll('.tick-label')].map((l) => l.textContent), ['0', '5', '10', '15', '20']);
  assert.equal(twenty.querySelectorAll('.tick-bar.is-major').length, 5);
});

test('choice buttons: neutral state with symbol, name, hint', () => {
  const { root } = setup(demoState('quiz'));
  const btns = root.querySelectorAll('.choice');
  assert.deepEqual([...btns].map((b) => b.dataset.key), ['substantiv', 'verb', 'adjektiv']);
  for (const b of btns) {
    assert.equal(b.tagName, 'BUTTON');
    assert.equal(b.dataset.state, 'neutral');
    assert.equal(b.disabled, false);
  }
  const verb = T(root, 'choice-verb');
  assert.equal(verb.querySelector('.choice-sym').textContent, 'V');
  assert.equal(verb.querySelector('.choice-name').textContent, 'verb');
  assert.equal(verb.querySelector('.choice-hint').textContent, 'något man gör');
  assert.equal(verb.getAttribute('aria-label'), 'verb');
});

test('wrong state: red, ✕, disabled, aria and status text', () => {
  const { root } = setup(demoState('wrong'));
  const s = T(root, 'choice-substantiv');
  assert.equal(s.dataset.state, 'wrong');
  assert.equal(s.disabled, true);
  assert.equal(s.getAttribute('aria-label'), 'substantiv, fel');
  assert.ok(s.querySelector('.icon-cross'));
  assert.equal(T(root, 'choice-verb').disabled, false);
  assert.equal(s.hasAttribute('data-dimmed'), false);
  const status = T(root, 'status');
  assert.equal(status.getAttribute('role'), 'status');
  assert.equal(status.getAttribute('aria-live'), 'polite');
  assert.equal(status.dataset.kind, 'wrong');
  assert.equal(status.textContent, '”springer” är inget substantiv. Försök igen.');
});

test('correct state: green ✓, others dimmed and disabled, word marked solved', () => {
  const { root } = setup(demoState('correct'));
  const v = T(root, 'choice-verb');
  assert.equal(v.dataset.state, 'right');
  assert.equal(v.getAttribute('aria-label'), 'verb, rätt');
  assert.ok(v.querySelector('.icon-check'));
  for (const k of ['substantiv', 'adjektiv']) {
    assert.equal(T(root, `choice-${k}`).dataset.state, 'dimmed');
    assert.ok(T(root, `choice-${k}`).hasAttribute('data-dimmed'));
    assert.equal(T(root, `choice-${k}`).disabled, true);
  }
  assert.ok(T(root, 'word').hasAttribute('data-solved'));
  assert.equal(T(root, 'status').textContent, 'Rätt! ”springer” är ett verb.');
  assert.equal(T(root, 'status').dataset.kind, 'right');
  assert.equal(root.querySelectorAll('.tick-bar.is-current').length, 0);
});

test('idle status and "also right" state for a multi-class word', () => {
  let s = reduce(initialState(), { type: 'START', round: [W('bär', 'substantiv', 'verb')], now: 0 });
  assert.equal(T(setup(s).root, 'status').dataset.kind, 'idle');
  assert.equal(T(setup(s).root, 'status').textContent, 'Tryck på rätt ordklass.');
  s = reduce(s, { type: 'PICK', key: 'verb', now: 100 });
  const { root } = setup(s);
  assert.equal(T(root, 'choice-verb').dataset.state, 'right');
  assert.equal(T(root, 'choice-substantiv').dataset.state, 'also');
  assert.ok(T(root, 'choice-substantiv').querySelector('.icon-check'));
  assert.equal(T(root, 'choice-adjektiv').dataset.state, 'dimmed');
  assert.equal(T(root, 'status').textContent, 'Rätt! ”bär” är ett verb – men kan också vara ett substantiv.');
});

test('hints shown or hidden by setting', () => {
  const off = { ...config, settings: { ...config.settings, showHints: false } };
  const { root } = setup(demoState('quiz'), { cfg: off });
  assert.equal(root.querySelectorAll('.choice-hint').length, 0);
  assert.equal(root.querySelector('.choices').dataset.hints, 'false');
  assert.equal(setup(demoState('quiz')).root.querySelectorAll('.choice-hint').length, 3);
});

test('mobile: short progress, icon-only quit keeps its accessible name', () => {
  const { root } = setup(demoState('quiz'), { mobile: true });
  assert.equal(T(root, 'progress').textContent, '4 / 10');
  const quit = T(root, 'quit-button');
  assert.equal(quit.getAttribute('aria-label'), 'Avsluta');
  assert.ok(quit.querySelector('svg[aria-hidden="true"]'));
});

test('Avsluta dispatches QUIT; buttons dispatch their class', () => {
  const { root, calls } = setup(demoState('quiz'));
  click(T(root, 'choice-adjektiv'));
  click(T(root, 'quit-button'));
  assert.deepEqual(calls, ['adjektiv', 'QUIT']);
  assert.equal(T(root, 'quit-button').textContent, 'Avsluta');
});

test('keyboard: number and symbol keys pick, modifiers and other keys ignored', () => {
  const { root, calls } = setup(demoState('quiz'));
  const screen = T(root, 'quiz');
  assert.equal(screen.getAttribute('tabindex'), '-1');
  assert.equal(key(screen, '1').defaultPrevented, true);
  key(screen, '3');
  key(screen, 'v');
  key(screen, 'S');
  key(screen, '2', { ctrlKey: true });
  key(screen, 'a', { metaKey: true });
  key(screen, 'v', { altKey: true });
  assert.equal(key(screen, 'x').defaultPrevented, false);
  key(screen, '9');
  key(screen, 'Enter');
  assert.deepEqual(calls, ['substantiv', 'adjektiv', 'verb', 'substantiv']);
});

test('keyToClass maps positions and symbols', () => {
  const active = config.settings.activeClasses;
  assert.equal(keyToClass('1', active, config.classMap), 'substantiv');
  assert.equal(keyToClass('3', active, config.classMap), 'adjektiv');
  assert.equal(keyToClass('4', active, config.classMap), null);
  assert.equal(keyToClass('0', active, config.classMap), null);
  assert.equal(keyToClass('A', active, config.classMap), 'adjektiv');
  assert.equal(keyToClass('q', active, config.classMap), null);
});

test('timer text and updateTimer', () => {
  let s = reduce(initialState(), { type: 'START', round: [W('hund', 'substantiv')], now: 1000 });
  assert.equal(timerText(s, 3650), '2,7 s');
  const { root } = setup(s, { now: 1000 });
  assert.equal(root.querySelector('.timer-value').textContent, '0,0 s');
  updateTimer(s, 2600, root);
  assert.equal(root.querySelector('.timer-value').textContent, '1,6 s');
  const empty = makeDom().root;
  assert.doesNotThrow(() => updateTimer(s, 1, empty));
});

test('multi "any": also-right aria, example sentences with the word in bold', () => {
  const { root } = setup(demoState('multi-any'));
  assert.equal(T(root, 'choice-substantiv').getAttribute('aria-label'), 'substantiv, också rätt');
  assert.equal(T(root, 'choice-adjektiv').getAttribute('aria-label'), 'adjektiv, rätt');
  assert.ok(T(root, 'choice-verb').hasAttribute('data-dimmed'));
  assert.equal(T(root, 'choice-substantiv').hasAttribute('data-dimmed'), false);
  assert.ok(root.querySelector('.stage').hasAttribute('data-multi'));
  assert.equal(T(root, 'badge'), null);
  const ex = root.querySelectorAll('.example');
  assert.equal(ex.length, 2);
  assert.equal(T(root, 'example-class-0').textContent, 'adjektiv');
  assert.match(T(root, 'example-class-0').getAttribute('style'), /--tint:#D3F1EA/);
  assert.equal(ex[0].querySelector('b').textContent, 'kort');
  assert.equal(ex[0].textContent, 'adjektivHon har kort hår.');
  assert.equal(ex[1].textContent, 'substantivVi spelar kort.');
});

test('multi "all": badge, partial solve keeps the clock running and buttons open', () => {
  const partial = demoState('multi-all-partial');
  const { root, calls } = setup({ ...partial, paused: false, segStart: 0 }, { now: 0 });
  assert.equal(T(root, 'badge').textContent, '2 ordklasser');
  assert.equal(T(root, 'word').hasAttribute('data-solved'), false);
  assert.equal(T(root, 'choice-verb').dataset.state, 'right');
  assert.equal(T(root, 'choice-verb').disabled, true);
  assert.equal(T(root, 'choice-substantiv').disabled, false);
  assert.equal(T(root, 'choice-adjektiv').hasAttribute('data-dimmed'), false);
  assert.equal(T(root, 'examples'), null);
  assert.equal(root.querySelectorAll('.tick-bar.is-current').length, 1);
  updateTimer({ ...partial, paused: false, segStart: 0 }, 1000, root);
  assert.equal(root.querySelector('.timer-value').textContent, '8,8 s');
  click(T(root, 'choice-substantiv'));
  assert.deepEqual(calls, ['substantiv']);

  const done = setup(demoState('multi-all-done')).root;
  assert.equal(T(done, 'badge').textContent, '2 ordklasser');
  assert.equal(T(done, 'status').textContent, 'Rätt! ”bär” kan vara både ett substantiv och ett verb.');
  assert.deepEqual(['substantiv', 'verb', 'adjektiv'].map((k) => T(done, `choice-${k}`).dataset.state), ['right', 'right', 'dimmed']);
});

test('single-class words keep the original stage', () => {
  const { root } = setup(demoState('correct'));
  assert.equal(root.querySelector('.stage').hasAttribute('data-multi'), false);
  assert.equal(T(root, 'examples'), null);
  assert.equal(T(root, 'badge'), null);
});

test('example without the word in it is shown whole', () => {
  let s = reduce(initialState(), { type: 'START', round: [{ word: 'bär', classes: ['substantiv', 'verb'], examples: { verb: 'Hon lyfter väskan.' } }], now: 0 });
  s = reduce(s, { type: 'PICK', key: 'verb', now: 10 });
  const { root } = setup(s);
  assert.equal(root.querySelector('.example b'), null);
  assert.equal(T(root, 'example-0').textContent, 'verbHon lyfter väskan.');
});
