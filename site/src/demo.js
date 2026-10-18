// Fixture states that reproduce the design's example screens exactly
// (index.html?demo=start|quiz|wrong|correct|result). Used by the design tests.

export const DEMO_SCREENS = ['start', 'quiz', 'wrong', 'correct', 'result',
  'multi-any', 'multi-all-partial', 'multi-all-done', 'multi-result'];

const WORDS = [
  ['hund', 'substantiv'], ['glad', 'adjektiv'], ['skriver', 'verb'], ['springer', 'verb'], ['äpple', 'substantiv'],
  ['mjuk', 'adjektiv'], ['sover', 'verb'], ['fönster', 'substantiv'], ['trött', 'adjektiv'], ['bygger', 'verb']
];
const TIMES = [1900, 2400, 1600, 2700, 2000, 4200, 1800, 2200, 2500, 2100];
const MISSES = [false, true, false, true, false, true, false, false, false, false];
const CURRENT = 3;
// The approved multi-class artboards (milestone 6).
const KORT = { word: 'kort', classes: ['substantiv', 'adjektiv'],
  examples: { adjektiv: 'Hon har kort hår.', substantiv: 'Vi spelar kort.' } };
const BAR = { word: 'bär', classes: ['substantiv', 'verb'], examples: {} };
const MULTI_INDEX = 6;
const MULTI_MS = 2100;
const CURRENT_MS = 2700;
const PREV_BEST = 21300;

export function demoState(screen, total = 10) {
  if (!DEMO_SCREENS.includes(screen)) return null;
  if (screen === 'start') return { screen: 'start', best: null };
  const round = [];
  const hist = [];
  for (let i = 0; i < total; i++) {
    const [word, cls] = WORDS[i % 10];
    round.push({ word, classes: [cls], examples: {} });
    hist.push({ word, classes: [cls], first: cls, ms: TIMES[i % 10], miss: MISSES[i % 10] });
  }
  const sum = (list) => list.reduce((a, h) => a + h.ms, 0);
  const missCount = (list) => list.filter((h) => h.miss).length;
  const n = Math.min(CURRENT, total - 1);
  const past = hist.slice(0, n);
  // Paused with the current word's time frozen, so the timer reads 8,6 s.
  const st = {
    screen: 'quiz', mode: 'any', round, index: n, wrong: [], found: [], solved: false,
    accMs: sum(past), wordMs: CURRENT_MS, segStart: 0, paused: true,
    misses: missCount(past), history: past, totalMs: 0, best: null, prevBest: null, record: false
  };
  if (screen === 'multi-any') {
    round[n] = KORT;
    return { ...st, found: ['adjektiv'], solved: true, accMs: st.accMs + CURRENT_MS };
  }
  if (screen === 'multi-all-partial') {
    round[n] = BAR;
    return { ...st, mode: 'all', found: ['verb'], wordMs: 1900 };
  }
  if (screen === 'multi-all-done') {
    round[n] = BAR;
    return { ...st, mode: 'all', found: ['verb', 'substantiv'], solved: true, accMs: st.accMs + CURRENT_MS };
  }
  if (screen === 'multi-result') {
    const i = Math.min(MULTI_INDEX, total - 1);
    round[i] = BAR;
    hist[i] = { word: BAR.word, classes: BAR.classes, first: 'substantiv', ms: MULTI_MS, miss: false };
    screen = 'result';
  }
  if (screen === 'wrong') return { ...st, wrong: ['substantiv'], misses: st.misses + 1 };
  if (screen === 'correct') {
    return { ...st, found: [round[n].classes[0]], solved: true, accMs: st.accMs + CURRENT_MS, history: hist.slice(0, n + 1) };
  }
  if (screen === 'result') {
    const tot = sum(hist);
    return { ...st, screen: 'result', index: total - 1, solved: true, history: hist, accMs: tot, totalMs: tot,
      misses: missCount(hist), best: Math.min(tot, PREV_BEST), prevBest: PREV_BEST, record: false };
  }
  return st;
}
