import { test } from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../../site/src/ui/result.js';
import { demoState } from '../../site/src/demo.js';
import { click, makeDom, realConfig } from './helpers.mjs';

const config = realConfig();
const T = (root, id) => root.querySelector(`[data-testid="${id}"]`);

function setup(state) {
  const { root } = makeDom();
  const calls = [];
  render(state, { config, onAgain: () => calls.push('AGAIN'), onDone: () => calls.push('DONE') }, root);
  return { root, calls };
}

test('total time, result line and misses line', () => {
  const { root } = setup(demoState('result'));
  assert.equal(root.dataset.screen, 'result');
  assert.equal(T(root, 'result-kicker').textContent, 'Resultat · Ordklasser');
  assert.equal(T(root, 'result-time').textContent, '23,4');
  assert.equal(root.querySelector('.result-unit').textContent, 's');
  assert.equal(T(root, 'result-line').textContent, 'Du klarade 10 ord på 23,4 sekunder.');
  assert.equal(T(root, 'miss-line').textContent, 'Felklick på vägen: 3');
  const clean = setup({ ...demoState('result'), misses: 0 }).root;
  assert.equal(T(clean, 'miss-line').textContent, 'Rätt på första försöket varje gång!');
});

test('best line: best, record, none', () => {
  const best = T(setup(demoState('result')).root, 'best-line');
  assert.equal(best.textContent, 'Bästa tid: 21,3 s');
  assert.equal(best.dataset.kind, 'best');
  const rec = T(setup({ ...demoState('result'), record: true, best: 20000, prevBest: 21300 }).root, 'best-line');
  assert.equal(rec.textContent, 'Nytt rekord! Förra bästa var 21,3 s.');
  assert.equal(rec.dataset.kind, 'record');
  assert.equal(T(setup({ ...demoState('result'), best: 23400, prevBest: null }).root, 'best-line'), null);
});

test('one history tile per word with class tint and missed border', () => {
  const { root } = setup(demoState('result'));
  const tiles = root.querySelectorAll('.tile');
  assert.equal(tiles.length, 10);
  const hund = T(root, 'tile-0');
  assert.equal(hund.querySelector('.tile-word').textContent, 'hund');
  assert.equal(hund.querySelector('.tile-meta').textContent, 'substantiv · 1,9 s');
  assert.match(hund.getAttribute('style'), /--tint:#FCE6D4/);
  assert.equal(hund.hasAttribute('data-miss'), false);
  const glad = T(root, 'tile-1');
  assert.equal(glad.hasAttribute('data-miss'), true);
  assert.match(glad.getAttribute('style'), /--tint:#D3F1EA/);
  assert.equal([...tiles].filter((t) => t.hasAttribute('data-miss')).length, 3);
});

test('multi-class tile: tint of the first correct pick, all classes in meta', () => {
  const st = { ...demoState('result'), history: [{ word: 'bär', classes: ['substantiv', 'verb'], first: 'verb', ms: 2100, miss: false }] };
  const tile = T(setup(st).root, 'tile-0');
  assert.equal(tile.querySelector('.tile-meta').textContent, 'substantiv/verb · 2,1 s');
  assert.match(tile.getAttribute('style'), /--tint:#DCE8FA/);
  assert.ok(tile.hasAttribute('data-multi'));
});

test('legend and both buttons dispatch the right action', () => {
  const { root, calls } = setup(demoState('result'));
  assert.equal(T(root, 'legend').textContent.replace(/\s+/g, ' ').trim(), 'rätt direkt fel först');
  assert.equal(T(root, 'play-again').textContent, 'spela igen');
  assert.equal(T(root, 'to-start').textContent, 'till start');
  click(T(root, 'play-again'));
  click(T(root, 'to-start'));
  assert.deepEqual(calls, ['AGAIN', 'DONE']);
});

test('multi-class tile marker: dots in the first-picked class, then the other', () => {
  const { root } = setup(demoState('multi-result'));
  const marker = T(root, 'tile-marker-6');
  assert.equal(marker.getAttribute('aria-hidden'), 'true');
  assert.deepEqual([...marker.querySelectorAll('.dot')].map((d) => d.getAttribute('style')), ['--dot:#8A420E', '--dot:#1D4C91']);
  assert.equal(T(root, 'tile-6').querySelector('.tile-meta').textContent, 'substantiv/verb · 2,1 s');
  assert.equal(T(root, 'tile-0').querySelector('.tile-marker'), null);
  const legend = T(root, 'legend-multi');
  assert.equal(legend.textContent, 'flera ordklasser');
  assert.equal(legend.querySelectorAll('.dot').length, 2);
  const picked = { ...demoState('multi-result') };
  picked.history = picked.history.map((h, i) => (i === 6 ? { ...h, first: 'verb' } : h));
  const flipped = setup(picked).root;
  assert.deepEqual([...T(flipped, 'tile-marker-6').querySelectorAll('.dot')].map((d) => d.getAttribute('style')), ['--dot:#1D4C91', '--dot:#8A420E']);
});

test('no multi-class word → no multi legend item', () => {
  assert.equal(T(setup(demoState('result')).root, 'legend-multi'), null);
});
