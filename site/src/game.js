// The game as a pure reducer plus selectors. No DOM, no clock: every action
// that needs the time carries `now` (milliseconds, e.g. performance.now()).
import { fill, formatTime, joinList, negation, withArticle } from './format.js';

export function initialState(best = null) {
  return { screen: 'start', best };
}

function startRound(state, { round, now, mode = 'any', best = state.best ?? null }) {
  return {
    screen: 'quiz',
    mode,
    round,
    index: 0,
    wrong: [],
    found: [],
    solved: false,
    accMs: 0,
    wordMs: 0,
    segStart: now,
    paused: false,
    misses: 0,
    history: [],
    totalMs: 0,
    best,
    prevBest: null,
    record: false
  };
}

function pick(state, { key, now }) {
  if (state.screen !== 'quiz' || state.solved || state.paused) return state;
  if (state.wrong.includes(key) || state.found.includes(key)) return state;
  const word = state.round[state.index];
  if (!word.classes.includes(key)) {
    return { ...state, wrong: [...state.wrong, key], misses: state.misses + 1 };
  }
  const found = [...state.found, key];
  const done = state.mode !== 'all' || found.length === word.classes.length;
  if (!done) return { ...state, found };
  const ms = state.wordMs + (now - state.segStart);
  return {
    ...state,
    found,
    solved: true,
    accMs: state.accMs + ms,
    history: [...state.history, { word: word.word, classes: word.classes, first: found[0], ms, miss: state.wrong.length > 0 }]
  };
}

function advance(state, { now }) {
  if (state.screen !== 'quiz' || !state.solved) return state;
  if (state.index + 1 >= state.round.length) {
    const total = state.accMs;
    const best = state.best;
    return {
      ...state,
      screen: 'result',
      totalMs: total,
      prevBest: best,
      best: best == null || total < best ? total : best,
      record: best != null && total < best
    };
  }
  return { ...state, index: state.index + 1, wrong: [], found: [], solved: false, wordMs: 0, segStart: now };
}

// Hidden tab: stop the clock (also between words, so the next word starts
// paused if it appears while the tab is hidden).
function pause(state, { now }) {
  if (state.screen !== 'quiz' || state.paused) return state;
  const wordMs = state.solved ? state.wordMs : state.wordMs + (now - state.segStart);
  return { ...state, paused: true, wordMs };
}

function resume(state, { now }) {
  if (state.screen !== 'quiz' || !state.paused) return state;
  return { ...state, paused: false, segStart: now };
}

function quit(state) {
  if (state.screen === 'start') return state;
  return { screen: 'start', best: state.best ?? null };
}

export function reduce(state, action) {
  switch (action.type) {
    case 'START': return state.screen === 'quiz' ? state : startRound(state, action);
    case 'PICK': return pick(state, action);
    case 'ADVANCE': return advance(state, action);
    case 'PAUSE': return pause(state, action);
    case 'RESUME': return resume(state, action);
    case 'QUIT': return quit(state);
    default: return state;
  }
}

// ---- selectors ----

export function currentWord(state) {
  return state.screen === 'quiz' || state.screen === 'result' ? state.round[state.index] : null;
}

export function elapsedMs(state, now) {
  if (state.screen === 'result') return state.totalMs;
  if (state.screen !== 'quiz') return 0;
  if (state.solved) return state.accMs;
  return state.accMs + state.wordMs + (state.paused ? 0 : now - state.segStart);
}

// One tick per word boundary 0…total. Labels on every tick up to 12 words,
// else every 5th (and the last); the current word's end tick is tall.
export function rulerTicks(total, index, solved) {
  const done = Math.min(total, index + (solved ? 1 : 0));
  const every = total <= 12 ? 1 : 5;
  const ticks = [];
  for (let i = 0; i <= total; i++) {
    const major = i % every === 0 || i === total;
    const current = !solved && i === index + 1;
    ticks.push({ label: String(i), major, current, showLabel: major && !current, done: i <= done });
  }
  return ticks;
}

// 'neutral' | 'wrong' | 'right' | 'also' | 'dimmed'
export function choiceState(state, key) {
  if (state.wrong.includes(key)) return 'wrong';
  if (state.found.includes(key)) return 'right';
  if (!state.solved) return 'neutral';
  return state.round[state.index].classes.includes(key) ? 'also' : 'dimmed';
}

// After a solve every class that wasn't right fades, wrong picks included.
export function isChoiceDimmed(state, key) {
  const st = choiceState(state, key);
  return state.solved && (st === 'dimmed' || st === 'wrong');
}

export function isChoiceDisabled(state, key) {
  return state.solved || state.wrong.includes(key) || state.found.includes(key);
}

// Status line under the word: { kind: 'idle'|'wrong'|'right', text }.
export function statusLine(state, classMap, texts) {
  const word = state.round[state.index];
  const c = (k) => classMap[k];
  if (state.found.length) {
    const last = c(state.found[state.found.length - 1]);
    const base = { word: word.word, art: last.article, class: last.name };
    if (!state.solved) {
      const left = word.classes.length - state.found.length;
      const text = left === 1 ? fill(texts.promptFoundOneMore, base) : fill(texts.promptFoundMore, { ...base, n: left });
      return { kind: 'right', text };
    }
    if (word.classes.length === 1) return { kind: 'right', text: fill(texts.promptRight, base) };
    if (state.mode === 'all') {
      return { kind: 'right', text: fill(texts.promptFoundAll, { word: word.word, all: joinList(word.classes.map((k) => withArticle(c(k)))) }) };
    }
    const others = word.classes.filter((k) => !state.found.includes(k)).map((k) => withArticle(c(k)));
    return { kind: 'right', text: fill(texts.promptRightAlso, { ...base, others: joinList(others) }) };
  }
  if (state.wrong.length) {
    const last = c(state.wrong[state.wrong.length - 1]);
    return { kind: 'wrong', text: fill(texts.promptWrong, { word: word.word, neg: negation(last.article), class: last.name }) };
  }
  return { kind: 'idle', text: texts.promptIdle };
}

// What the result screen shows about best times.
export function bestLine(state, texts) {
  if (state.record) return { kind: 'record', text: fill(texts.newRecord, { time: formatTime(state.prevBest) }) };
  if (state.best != null && state.best !== state.totalMs) return { kind: 'best', text: fill(texts.bestTime, { time: formatTime(state.best) }) };
  return null;
}

export function missLine(state, texts) {
  return state.misses === 0 ? texts.noMisses : fill(texts.misses, { n: state.misses });
}
