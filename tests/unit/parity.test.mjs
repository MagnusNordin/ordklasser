// Our logic vs. the prototype's logic (design/source/Main.dc.html, run in a
// Node vm): the same inputs must give the same texts, times and states.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatTime, fill } from '../../site/src/format.js';
import {
  bestLine, choiceState, elapsedMs, initialState, isChoiceDimmed, isChoiceDisabled, missLine, reduce, rulerTicks, statusLine
} from '../../site/src/game.js';
import { buildRound, seededRng } from '../../site/src/round.js';
import { designConfig, loadPrototype } from './helpers.mjs';

const config = designConfig();
const { classMap, texts } = config;
const KEYS = ['substantiv', 'verb', 'adjektiv'];

function makeProto(props = {}) {
  let t = 0;
  const rng = seededRng(11);
  const Proto = loadPrototype('design/source/Main.dc.html', { random: rng, now: () => t });
  const comp = new Proto({ screen: 'start', words: 10, showHints: true, ...props });
  return { comp, setNow: (v) => { t = v; } };
}

test('time formatting matches fmt()', () => {
  const { comp } = makeProto();
  for (let ms = 0; ms <= 100000; ms += 37) assert.equal(formatTime(ms), comp.fmt(ms), `ms=${ms}`);
  assert.equal(formatTime(undefined), comp.fmt(undefined));
});

test('ruler ticks match for every size and position', () => {
  for (const words of [3, 7, 10, 12, 13, 20, 30]) {
    const { comp } = makeProto({ words });
    for (let n = 0; n < words; n++) {
      for (const solved of [false, true]) {
        comp.state = { live: true, screen: 'quiz', round: Array.from({ length: words }, () => ({ w: 'x', c: 'verb' })), n, solved, wrongPicks: [], accMs: 0, shownAt: 0, now: 0 };
        const theirs = comp.renderVals().ticks;
        const ours = rulerTicks(words, n, solved);
        assert.equal(ours.length, theirs.length);
        ours.forEach((tick, i) => {
          const th = theirs[i];
          const where = `words=${words} n=${n} solved=${solved} i=${i}`;
          assert.equal(tick.showLabel, th.hasLabel, where);
          assert.equal(tick.label, th.label, where);
          assert.equal(tick.current, /width:5px/.test(th.style), where);
          assert.equal(tick.done || tick.current, /background:#17203A/.test(th.style), where);
          const tall = /height:20px/.test(th.style);
          if (!tick.current) assert.equal(tick.major, tall, where);
        });
      }
    }
  }
});

test('round balancing: both give floor(n/3) per class plus the remainder', () => {
  for (let n = 3; n <= 30; n++) {
    const { comp } = makeProto({ words: n });
    const theirs = comp.makeRound(n);
    const ours = buildRound(config.words, n, seededRng(n), { activeClasses: KEYS, maxMulti: 0 });
    for (const [name, round, cls] of [['prototype', theirs, (w) => w.c], ['ours', ours, (w) => w.classes[0]]]) {
      assert.equal(round.length, n, name);
      const per = Math.floor(n / 3);
      const r = n - per * 3;
      for (const k of KEYS) {
        const count = round.filter((w) => cls(w) === k).length;
        assert.ok(count >= per && count <= per + r, `${name} n=${n} ${k}=${count}`);
      }
    }
  }
});

// Plays one round in both, step by step, comparing everything on screen.
function playBoth(proto, ourState, steps) {
  const { comp, setNow } = proto;
  const ui = () => comp.renderVals();
  const check = (st, now, where) => {
    const v = ui();
    const status = statusLine(st, classMap, texts);
    assert.equal(status.text, v.statusText, `${where} status`);
    assert.equal(formatTime(elapsedMs(st, now)) + ' s', v.timeText, `${where} time`);
    assert.equal(fill(texts.progress, { i: st.index + 1, n: st.round.length }), v.progressText, `${where} progress`);
    assert.equal(st.round[st.index].word, v.word, `${where} word`);
    v.choices.forEach((c, i) => {
      const k = KEYS[i];
      const state = choiceState(st, k);
      const aria = classMap[k].name + (state === 'wrong' ? ', ' + texts.ariaWrong : state === 'right' ? ', ' + texts.ariaRight : '');
      assert.equal(aria, c.aria, `${where} aria ${k}`);
      assert.equal(isChoiceDisabled(st, k), c.disabled, `${where} disabled ${k}`);
      assert.equal(isChoiceDimmed(st, k), /opacity:0.4/.test(c.style), `${where} dimmed ${k}`);
    });
  };
  let st = ourState;
  let now = comp.state.shownAt;
  for (const { picks, gap } of steps) {
    for (const [k, dt] of picks) {
      now += dt;
      setNow(now);
      ui().choices[KEYS.indexOf(k)].pick();
      st = reduce(st, { type: 'PICK', key: k, now });
      check(st, now, `word ${st.index} pick ${k}`);
    }
    now += gap;
    setNow(now);
    comp.advance();
    st = reduce(st, { type: 'ADVANCE', now });
    if (st.screen === 'quiz') check(st, now, `word ${st.index} shown`);
  }
  return st;
}

function compareResult(proto, st) {
  const v = proto.comp.renderVals();
  assert.equal(st.screen, 'result');
  assert.equal(v.isResult, true);
  assert.equal(formatTime(st.totalMs), v.timeBig);
  assert.equal(fill(texts.resultLine, { n: st.round.length, time: formatTime(st.totalMs) }), v.resultLine);
  assert.equal(missLine(st, texts), v.missLine);
  const best = bestLine(st, texts);
  assert.equal(Boolean(best), v.hasBestLine);
  if (best) assert.equal(best.text, v.bestLine);
  assert.equal(best?.kind === 'record', v.bestLineStyle.includes('#1E7F4F'));
  const hist = JSON.parse(JSON.stringify(v.hist.map((h) => [h.w, h.meta]))); // vm realm → plain arrays
  assert.deepEqual(st.history.map((h) => [h.word, classMap[h.first].name + ' · ' + formatTime(h.ms) + ' s']), hist);
}

function stepsFor(round, rnd) {
  return round.map((w, i) => {
    const right = w.c;
    const wrong = KEYS.filter((k) => k !== right);
    const picks = [];
    const misses = i % 3 === 1 ? 1 : i % 5 === 4 ? 2 : 0;
    for (let m = 0; m < misses; m++) picks.push([wrong[m], 300 + Math.floor(rnd() * 900)]);
    picks.push([right, 400 + Math.floor(rnd() * 2600)]);
    return { picks, gap: 700 };
  });
}

test('full rounds: statuses, times, buttons, results and best-time logic match', () => {
  const proto = makeProto({ words: 10 });
  const rnd = seededRng(99);
  proto.setNow(10000);
  let st = initialState();
  for (const roundNo of [1, 2, 3]) {
    proto.comp.renderVals().start();
    const theirRound = proto.comp.state.round;
    const round = theirRound.map((w) => ({ word: w.w, classes: [w.c], examples: {} }));
    st = reduce(st, { type: 'START', round, now: proto.comp.state.shownAt });
    const steps = stepsFor(theirRound, rnd);
    // Round 3 is played faster than the others → a record.
    if (roundNo === 3) steps.forEach((s) => s.picks.forEach((p) => { p[1] = 100; }));
    st = playBoth(proto, st, steps);
    compareResult(proto, st);
  }
  assert.equal(st.record, true);
});

test('mobile prototype uses the short progress text', () => {
  const Proto = loadPrototype('design/source/MobileMain.dc.html');
  const comp = new Proto({ screen: 'quiz', words: 10, showHints: true });
  assert.equal(comp.renderVals().progressText, fill(texts.progressShort, { i: 4, n: 10 }));
});
