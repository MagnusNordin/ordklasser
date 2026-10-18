// Boot: load config, then run the game (or show a design fixture state).
import { applyOverrides, loadConfig } from './config.js';
import { demoState } from './demo.js';
import { initialState, reduce } from './game.js';
import { MOBILE_QUERY, REDUCED_MOTION_QUERY, matches, watch } from './layout.js';
import { buildRound, seededRng } from './round.js';
import { createBestStore } from './storage.js';
import { esc } from './ui/dom.js';
import * as quiz from './ui/quiz.js';
import * as result from './ui/result.js';
import * as start from './ui/start.js';

const SCREENS = { start, quiz, result };
const TIMER_INTERVAL_MS = 100;

export function showError(root, errors, heading = 'Konfigurationen innehåller fel') {
  root.dataset.screen = 'error';
  root.innerHTML = `
  <div class="config-error" role="alert">
    <h1>${esc(heading)}</h1>
    <ul>${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>
  </div>`;
}

export function roundSettings(settings) {
  return { wordsPerRound: settings.wordsPerRound, activeClasses: settings.activeClasses, mode: settings.multiClass.mode };
}

// Renders a screen for `state`; ctx carries config, layout and callbacks.
export function renderScreen(state, ctx, root) {
  SCREENS[state.screen].render(state, ctx, root);
}

// Runs the game in `root`. Everything with side effects is injectable.
export function createApp({ root, config, win, bestStore, now, rng, schedule, cancel, raf }) {
  const settings = config.settings;
  const roundCfg = roundSettings(settings);
  let state = initialState(bestStore.read(roundCfg));
  let mobile = matches(win, MOBILE_QUERY);
  let pending = null;
  let lastPaint = 0;

  const ctx = () => ({
    config,
    mobile,
    now: now(),
    best: state.best,
    onStart: () => startRound(),
    onAgain: () => startRound(),
    onQuit: () => dispatch({ type: 'QUIT' }),
    onDone: () => dispatch({ type: 'QUIT' }),
    onPick: (key) => dispatch({ type: 'PICK', key, now: now() })
  });

  function render() {
    const doc = root.ownerDocument;
    const focused = root.contains(doc.activeElement) ? doc.activeElement : null;
    const focusId = focused?.dataset?.testid;
    renderScreen(state, ctx(), root);
    if (!focused) return;
    const same = focusId && root.querySelector(`[data-testid="${focusId}"]`);
    const fallback = root.querySelector('.screen--quiz') || root.querySelector('button');
    (same && !same.disabled ? same : fallback).focus();
  }

  function clearPending() {
    if (pending != null) cancel(pending);
    pending = null;
  }

  function dispatch(action) {
    const prev = state;
    state = reduce(state, action);
    if (state === prev) return;
    if (action.type === 'QUIT') clearPending();
    if (!prev.solved && state.solved && state.screen === 'quiz') {
      const word = state.round[state.index];
      const delay = settings.advanceDelayMs * (word.classes.length > 1 ? 2 : 1);
      clearPending();
      pending = schedule(() => { pending = null; dispatch({ type: 'ADVANCE', now: now() }); }, delay);
    }
    if (state.screen === 'result' && prev.screen !== 'result' && state.best !== prev.best) {
      bestStore.write(roundCfg, state.best);
    }
    render();
    if (state.screen === 'quiz' && prev.screen !== 'quiz') tick();
  }

  function startRound() {
    let round;
    try {
      round = buildRound(config.words, settings.wordsPerRound, rng, {
        activeClasses: settings.activeClasses,
        maxMulti: settings.multiClass.maxPerRound
      });
    } catch (e) {
      showError(root, [e.message], config.texts.configError);
      return;
    }
    dispatch({ type: 'START', round, now: now(), mode: settings.multiClass.mode });
    root.querySelector('.screen--quiz')?.focus();
  }

  // Repaints only the timer text, at most every 100 ms, while a quiz runs.
  function tick() {
    if (state.screen !== 'quiz') return;
    const t = now();
    if (t - lastPaint >= TIMER_INTERVAL_MS) {
      lastPaint = t;
      quiz.updateTimer(state, t, root);
    }
    raf(tick);
  }

  const doc = root.ownerDocument;
  doc.addEventListener('visibilitychange', () => {
    dispatch({ type: doc.hidden ? 'PAUSE' : 'RESUME', now: now() });
  });
  watch(win, MOBILE_QUERY, (m) => { mobile = m; render(); });
  render();

  return { dispatch, startRound, getState: () => state };
}

export async function boot(win) {
  const doc = win.document;
  const root = doc.getElementById('app');
  const version = doc.querySelector('meta[name="version"]')?.content || 'dev';
  const params = new URLSearchParams(win.location.search);

  const setMotion = (reduce) => doc.documentElement.classList.toggle('reduce-motion', reduce);
  setMotion(matches(win, REDUCED_MOTION_QUERY));
  watch(win, REDUCED_MOTION_QUERY, setMotion);

  const loaded = await loadConfig((url) => win.fetch(url), './config/', version);
  if (loaded.errors.length) {
    showError(root, loaded.errors);
    return null;
  }
  const config = applyOverrides(loaded.config, params);

  const demo = demoState(params.get('demo'), config.settings.wordsPerRound);
  if (demo) {
    const noop = () => {};
    const mobile = matches(win, MOBILE_QUERY);
    renderScreen(demo, { config, mobile, now: 0, best: null, onStart: noop, onAgain: noop, onQuit: noop, onDone: noop, onPick: noop }, root);
    return null;
  }

  const seed = params.get('seed');
  return createApp({
    root,
    config,
    win,
    bestStore: createBestStore(() => win.localStorage),
    now: () => win.performance.now(),
    rng: seed != null && /^\d+$/.test(seed) ? seededRng(Number(seed)) : Math.random,
    schedule: (fn, ms) => win.setTimeout(fn, ms),
    cancel: (id) => win.clearTimeout(id),
    raf: (fn) => win.requestAnimationFrame(fn)
  });
}
