import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { boot, createApp, roundSettings, showError } from '../../site/src/main.js';
import { seededRng } from '../../site/src/round.js';
import { CONFIG_FILES } from '../../site/src/config.js';
import { ROOT, click, designConfig, key, makeDom, realConfig } from './helpers.mjs';

const T = (root, id) => root.querySelector(`[data-testid="${id}"]`);

// A controllable world: manual clock, timers and animation frames.
function harness({ config = designConfig(), mobile = false, stored = null, writeOk = true } = {}) {
  const dom = makeDom({ mobile });
  let t = 0;
  const timers = new Map();
  let nextId = 1;
  const frames = [];
  const writes = [];
  const app = createApp({
    root: dom.root,
    config,
    win: dom.win,
    bestStore: { read: () => stored, write: (round, ms) => { writes.push([round, ms]); return writeOk; } },
    now: () => t,
    rng: seededRng(1),
    schedule: (fn, ms) => { const id = nextId++; timers.set(id, { fn, at: t + ms }); return id; },
    cancel: (id) => timers.delete(id),
    raf: (fn) => frames.push(fn)
  });
  return {
    ...dom,
    app,
    timers,
    writes,
    advance(ms) {
      t += ms;
      for (const [id, tm] of [...timers]) if (tm.at <= t) { timers.delete(id); tm.fn(); }
    },
    frame() { const fs = frames.splice(0); fs.forEach((f) => f()); return fs.length; },
    set now(v) { t = v; },
    get now() { return t; }
  };
}

function rightKey(h) {
  const st = h.app.getState();
  return st.round[st.index].classes[0];
}

function wrongKey(h) {
  const right = rightKey(h);
  return h.app.getState().round.length && ['substantiv', 'verb', 'adjektiv'].find((k) => k !== right);
}

function playRound(h, { msPerWord = 1000, missFirst = false } = {}) {
  const n = h.app.getState().round.length;
  for (let i = 0; i < n; i++) {
    if (missFirst && i === 0) click(T(h.root, `choice-${wrongKey(h)}`));
    h.advance(msPerWord);
    click(T(h.root, `choice-${rightKey(h)}`));
    h.advance(700);
  }
}

test('starts on the start screen with the stored best time', () => {
  const h = harness({ stored: 21300 });
  assert.equal(h.root.dataset.screen, 'start');
  assert.equal(T(h.root, 'best-so-far').textContent, 'Bästa tid hittills: 21,3 s');
  assert.equal(harness().root.querySelector('[data-testid="best-so-far"]'), null);
});

test('START builds a round from the config and focuses the quiz', () => {
  const h = harness();
  T(h.root, 'start-button').focus();
  click(T(h.root, 'start-button'));
  const st = h.app.getState();
  assert.equal(h.root.dataset.screen, 'quiz');
  assert.equal(st.round.length, 10);
  assert.equal(h.doc.activeElement, T(h.root, 'quiz'));
  assert.equal(T(h.root, 'progress').textContent, 'Ord 1 av 10');
});

test('a correct pick schedules exactly one advance after advanceDelayMs', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  h.advance(1500);
  click(T(h.root, `choice-${rightKey(h)}`));
  assert.equal(h.timers.size, 1);
  click(T(h.root, `choice-${rightKey(h)}`)); // ignored: already solved
  assert.equal(h.timers.size, 1);
  h.advance(699);
  assert.equal(h.app.getState().index, 0);
  h.advance(1);
  assert.equal(h.app.getState().index, 1);
  assert.equal(T(h.root, 'progress').textContent, 'Ord 2 av 10');
  assert.equal(h.timers.size, 0);
});

test('multi-class words wait twice as long', () => {
  const h = harness({ config: realConfig() });
  click(T(h.root, 'start-button'));
  let guard = 0;
  while (h.app.getState().round[h.app.getState().index].classes.length < 2 && guard++ < 10) {
    click(T(h.root, `choice-${rightKey(h)}`));
    h.advance(700);
  }
  const before = h.app.getState().index;
  click(T(h.root, `choice-${rightKey(h)}`));
  h.advance(1399);
  assert.equal(h.app.getState().index, before);
  h.advance(1);
  assert.equal(h.app.getState().index, before + 1);
});

test('wrong pick re-renders and keeps focus on the quiz', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  const wrong = wrongKey(h);
  T(h.root, `choice-${wrong}`).focus();
  click(T(h.root, `choice-${wrong}`));
  assert.equal(T(h.root, `choice-${wrong}`).dataset.state, 'wrong');
  assert.equal(h.doc.activeElement, T(h.root, 'quiz'), 'disabled button → focus falls back to the quiz');
  const right = rightKey(h);
  T(h.root, `choice-${right}`).focus();
  key(T(h.root, 'quiz'), 'x'); // no-op key keeps everything
  assert.equal(h.doc.activeElement, T(h.root, `choice-${right}`));
});

test('quit cancels the pending advance', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  click(T(h.root, `choice-${rightKey(h)}`));
  assert.equal(h.timers.size, 1);
  click(T(h.root, 'quit-button'));
  assert.equal(h.timers.size, 0);
  assert.equal(h.root.dataset.screen, 'start');
  h.advance(5000);
  assert.equal(h.root.dataset.screen, 'start');
});

test('a full round reaches the result, stores the new best, play again / to start', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  playRound(h, { msPerWord: 2000, missFirst: true });
  assert.equal(h.root.dataset.screen, 'result');
  assert.equal(T(h.root, 'result-time').textContent, '20,0');
  assert.equal(T(h.root, 'miss-line').textContent, 'Felklick på vägen: 1');
  assert.deepEqual(h.writes, [[roundSettings(designConfig().settings), 20000]]);

  click(T(h.root, 'play-again'));
  assert.equal(h.root.dataset.screen, 'quiz');
  playRound(h, { msPerWord: 3000 });
  assert.equal(h.writes.length, 1, 'slower round does not overwrite the best');
  assert.equal(T(h.root, 'best-line').textContent, 'Bästa tid: 20,0 s');

  click(T(h.root, 'play-again'));
  playRound(h, { msPerWord: 1000 });
  assert.equal(h.writes.length, 2);
  assert.equal(T(h.root, 'best-line').textContent, 'Nytt rekord! Förra bästa var 20,0 s.');

  click(T(h.root, 'to-start'));
  assert.equal(h.root.dataset.screen, 'start');
  assert.equal(T(h.root, 'best-so-far').textContent, 'Bästa tid hittills: 10,0 s');
});

test('timer repaints at most every 100 ms and stops after the quiz', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  const value = () => h.root.querySelector('.timer-value').textContent;
  h.now = 50;
  h.frame();
  assert.equal(value(), '0,0 s');
  h.now = 120;
  h.frame();
  assert.equal(value(), '0,1 s');
  h.now = 180;
  h.frame();
  assert.equal(value(), '0,1 s', 'throttled');
  h.now = 260;
  h.frame();
  assert.equal(value(), '0,3 s');
  click(T(h.root, 'quit-button'));
  assert.equal(h.frame(), 1, 'one last frame is pending');
  assert.equal(h.frame(), 0, 'the loop stops on the start screen');
});

test('hidden tab pauses the clock (visibilitychange)', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  h.advance(1000);
  Object.defineProperty(h.doc, 'hidden', { configurable: true, get: () => true });
  h.doc.dispatchEvent(new h.win.Event('visibilitychange'));
  assert.equal(h.app.getState().paused, true);
  h.advance(60000);
  Object.defineProperty(h.doc, 'hidden', { configurable: true, get: () => false });
  h.doc.dispatchEvent(new h.win.Event('visibilitychange'));
  assert.equal(h.app.getState().paused, false);
  h.advance(500);
  click(T(h.root, `choice-${rightKey(h)}`));
  assert.equal(h.app.getState().accMs, 1500);
});

test('breakpoint change re-renders with the mobile texts', () => {
  const h = harness();
  click(T(h.root, 'start-button'));
  assert.equal(T(h.root, 'progress').textContent, 'Ord 1 av 10');
  h.mediaListeners['(max-width: 719.98px)']({ matches: true });
  assert.equal(T(h.root, 'progress').textContent, '1 / 10');
});

test('a round that cannot be built shows the config error', () => {
  const config = designConfig();
  const broken = { ...config, settings: { ...config.settings, wordsPerRound: 30 }, words: config.words.slice(0, 5) };
  const h = harness({ config: broken });
  click(T(h.root, 'start-button'));
  assert.equal(h.root.dataset.screen, 'error');
  assert.equal(h.root.querySelector('h1').textContent, 'Konfigurationen innehåller fel');
  assert.match(h.root.querySelector('li').textContent, /^Ordbanken räcker inte/);
  assert.equal(h.root.querySelector('[role="alert"]') != null, true);
});

test('showError escapes and uses the default heading', () => {
  const { root } = makeDom();
  showError(root, ['<x> & y']);
  assert.equal(root.querySelector('h1').textContent, 'Konfigurationen innehåller fel');
  assert.equal(root.querySelector('li').innerHTML, '&lt;x&gt; &amp; y');
});

// ---- boot ----

function bootWindow(url, files = {}, opts = {}) {
  const dom = makeDom({ url, ...opts });
  const real = Object.fromEntries(Object.values(CONFIG_FILES).map((f) => [f, readFileSync(`${ROOT}site/config/${f}`, 'utf8')]));
  const all = { ...real, ...files };
  const requested = [];
  dom.win.fetch = async (u) => {
    requested.push(u);
    const name = u.split('?')[0].split('/').pop();
    return all[name] == null ? { ok: false, status: 404 } : { ok: true, text: async () => all[name] };
  };
  dom.win.requestAnimationFrame = () => 0;
  return { ...dom, requested };
}

test('boot: loads config with the version and starts the game', async () => {
  const w = bootWindow('http://localhost/');
  const app = await boot(w.win);
  assert.ok(app);
  assert.equal(w.root.dataset.screen, 'start');
  assert.ok(w.requested.every((u) => u.startsWith('./config/') && u.endsWith('?v=test')));
  click(T(w.root, 'start-button'));
  assert.equal(w.root.dataset.screen, 'quiz');
});

test('boot: seed makes rounds reproducible; URL overrides apply', async () => {
  const a = bootWindow('http://localhost/?seed=5&ord=5&klasser=substantiv,verb');
  const b = bootWindow('http://localhost/?seed=5&ord=5&klasser=substantiv,verb');
  const appA = await boot(a.win);
  const appB = await boot(b.win);
  appA.startRound();
  appB.startRound();
  assert.deepEqual(appA.getState().round, appB.getState().round);
  assert.equal(appA.getState().round.length, 5);
  assert.equal(a.root.querySelectorAll('.choice').length, 2);
});

test('boot: best time survives in localStorage', async () => {
  const w = bootWindow('http://localhost/?ord=3');
  const app = await boot(w.win);
  app.startRound();
  for (let i = 0; i < 3; i++) {
    const st = app.getState();
    app.dispatch({ type: 'PICK', key: st.round[st.index].classes[0], now: (i + 1) * 1000 + st.segStart });
    app.dispatch({ type: 'ADVANCE', now: 0 });
  }
  assert.equal(w.root.dataset.screen, 'result');
  assert.equal(w.win.localStorage.getItem('ordklasser:best:3:adjektiv,substantiv,verb:any') != null, true);
});

test('boot: demo fixture states render without a running game', async () => {
  for (const screen of ['start', 'quiz', 'wrong', 'correct', 'result']) {
    const w = bootWindow(`http://localhost/?demo=${screen}`, {}, { mobile: screen === 'quiz' });
    assert.equal(await boot(w.win), null);
    assert.equal(w.root.dataset.screen, screen === 'wrong' || screen === 'correct' ? 'quiz' : screen);
  }
  const q = bootWindow('http://localhost/?demo=quiz', {}, { mobile: true });
  await boot(q.win);
  assert.equal(T(q.root, 'progress').textContent, '4 / 10');
  click(T(q.root, 'choice-verb')); // no-op handlers
  click(T(q.root, 'quit-button'));
  assert.equal(T(q.root, 'choice-verb').dataset.state, 'neutral');
});

test('boot: a broken config shows the error list instead of the game', async () => {
  const w = bootWindow('http://localhost/', { 'words.json': '{"words": [{"word": "hund", "classes": ["substantv"]}]}' });
  assert.equal(await boot(w.win), null);
  assert.equal(w.root.dataset.screen, 'error');
  assert.ok([...w.root.querySelectorAll('li')].some((li) => li.textContent === 'words.json: ordet "hund" har okänd ordklass "substantv"'));
});

test('boot: reduced motion toggles a class on <html>; missing version meta → dev', async () => {
  const w = bootWindow('http://localhost/', {}, { reducedMotion: true });
  w.doc.querySelector('meta[name="version"]').remove();
  await boot(w.win);
  assert.ok(w.doc.documentElement.classList.contains('reduce-motion'));
  assert.ok(w.requested.every((u) => u.endsWith('?v=dev')));
  w.mediaListeners['(prefers-reduced-motion: reduce)']({ matches: false });
  assert.equal(w.doc.documentElement.classList.contains('reduce-motion'), false);
});
