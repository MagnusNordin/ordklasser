import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEMO_SCREENS, demoState } from '../../site/src/demo.js';
import { bestLine, elapsedMs, missLine } from '../../site/src/game.js';
import { formatTime } from '../../site/src/format.js';
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, matches, watch } from '../../site/src/layout.js';
import { classVars, esc, fitText } from '../../site/src/ui/dom.js';
import { makeDom, realConfig } from './helpers.mjs';

const { texts } = realConfig();

test('fixture states reproduce the design numbers', () => {
  assert.deepEqual(DEMO_SCREENS, ['start', 'quiz', 'wrong', 'correct', 'result']);
  assert.equal(demoState('nope'), null);
  assert.equal(demoState(null), null);
  assert.deepEqual(demoState('start'), { screen: 'start', best: null });
  const quiz = demoState('quiz');
  assert.equal(quiz.round[quiz.index].word, 'springer');
  assert.equal(quiz.index + 1, 4);
  assert.equal(formatTime(elapsedMs(quiz, 123456)), '8,6');
  const wrong = demoState('wrong');
  assert.deepEqual(wrong.wrong, ['substantiv']);
  assert.equal(formatTime(elapsedMs(wrong, 0)), '8,6');
  const correct = demoState('correct');
  assert.equal(correct.solved, true);
  assert.equal(formatTime(elapsedMs(correct, 0)), '8,6');
  assert.equal(correct.history.length, 4);
  const result = demoState('result');
  assert.equal(formatTime(result.totalMs), '23,4');
  assert.equal(missLine(result, texts), 'Felklick på vägen: 3');
  assert.equal(bestLine(result, texts).text, 'Bästa tid: 21,3 s');
});

test('fixture states scale to other round sizes', () => {
  assert.equal(demoState('quiz', 20).round.length, 20);
  assert.equal(demoState('result', 20).history.length, 20);
  const tiny = demoState('quiz', 3);
  assert.equal(tiny.index, 2);
});

test('layout queries via matchMedia, with or without support', () => {
  const { win, mediaListeners } = makeDom({ mobile: true, reducedMotion: true });
  assert.equal(matches(win, MOBILE_QUERY), true);
  assert.equal(matches(win, REDUCED_MOTION_QUERY), true);
  assert.equal(matches(win, '(min-width: 1px)'), false);
  assert.equal(matches({}, MOBILE_QUERY), false);
  const seen = [];
  const off = watch(win, MOBILE_QUERY, (m) => seen.push(m));
  mediaListeners[MOBILE_QUERY]({ matches: false });
  assert.deepEqual(seen, [false]);
  off();
  assert.equal(mediaListeners[MOBILE_QUERY], undefined);
  assert.equal(typeof watch({}, MOBILE_QUERY, () => {}), 'function');
  watch({}, MOBILE_QUERY, () => {})();
  assert.equal(typeof watch({ matchMedia: () => ({}) }, MOBILE_QUERY, () => {}), 'function');
});

test('dom helpers: escaping, class vars, fitText', () => {
  assert.equal(esc(`<a href="x">'&'</a>`), '&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;');
  assert.equal(esc(5), '5');
  assert.equal(classVars({ colors: { tint: '#111111', deep: '#222222' } }), '--tint:#111111;--deep:#222222');
  // jsdom has no layout: fitText leaves the element alone.
  const { doc } = makeDom();
  const el = doc.createElement('div');
  doc.body.appendChild(el);
  fitText(el);
  assert.equal(el.style.fontSize, '');
});

test('fitText shrinks until the text fits', () => {
  // A fake element whose content width shrinks with the font size.
  let size = 100;
  const el = {
    clientWidth: 300,
    get scrollWidth() { return size * 4; },
    style: { set fontSize(v) { size = v === '' ? 100 : parseFloat(v); }, get fontSize() { return size + 'px'; } },
    ownerDocument: { defaultView: { getComputedStyle: () => ({ fontSize: size + 'px' }) } }
  };
  fitText(el);
  assert.equal(size, 74);
  size = 100;
  fitText(el, 90);
  assert.equal(size, 90, 'stops at the minimum');
});
