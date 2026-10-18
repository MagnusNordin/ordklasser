// Quiz screen: timer, ruler, the word, status line and the class buttons.
import { fill, formatTime } from '../format.js';
import { choiceState, elapsedMs, isChoiceDimmed, isChoiceDisabled, rulerTicks, statusLine } from '../game.js';
import { ICONS, classVars, esc, fitText } from './dom.js';

export function timerText(state, now) {
  return formatTime(elapsedMs(state, now)) + ' s';
}

// Key → class for keyboard play: "1"…"n" by position, or the class symbol.
export function keyToClass(key, activeClasses, classMap) {
  if (/^[1-9]$/.test(key)) return activeClasses[Number(key) - 1] ?? null;
  const k = key.toLowerCase();
  return activeClasses.find((c) => classMap[c].symbol.toLowerCase() === k) ?? null;
}

function symbol(cls, st) {
  if (st === 'right' || st === 'also') return ICONS.check;
  if (st === 'wrong') return ICONS.cross;
  return `<span>${esc(cls.symbol)}</span>`;
}

// ctx: { config, mobile, now, onQuit, onPick(key) }
export function render(state, ctx, root) {
  const { settings, classMap, texts } = ctx.config;
  const total = state.round.length;
  const word = state.round[state.index];
  const status = statusLine(state, classMap, texts);
  const progress = fill(ctx.mobile ? texts.progressShort : texts.progress, { i: state.index + 1, n: total });
  const ticks = rulerTicks(total, state.index, state.solved).map((t) => {
    const cls = ['tick-bar', t.major && 'is-major', t.done && 'is-done', t.current && 'is-current'].filter(Boolean).join(' ');
    const label = t.showLabel ? `<span class="tick-label">${t.label}</span>` : '';
    return `<div class="tick"><div class="${cls}"></div>${label}</div>`;
  }).join('');
  const choices = settings.activeClasses.map((key) => {
    const c = classMap[key];
    const st = choiceState(state, key);
    const aria = c.name + (st === 'wrong' ? ', ' + texts.ariaWrong : st === 'right' ? ', ' + texts.ariaRight : '');
    const hint = settings.showHints ? `<span class="choice-hint">${esc(c.hint)}</span>` : '';
    return `
      <button type="button" class="choice" data-testid="choice-${esc(key)}" data-key="${esc(key)}" data-state="${st}"
        aria-label="${esc(aria)}" style="${classVars(c)}"${isChoiceDimmed(state, key) ? ' data-dimmed' : ''}${isChoiceDisabled(state, key) ? ' disabled' : ''}>
        <span class="choice-sym">${symbol(c, st)}</span>
        <span class="choice-text"><span class="choice-name">${esc(c.name)}</span>${hint}</span>
      </button>`;
  }).join('');

  root.dataset.screen = 'quiz';
  root.innerHTML = `
  <div class="screen screen--quiz" tabindex="-1" data-testid="quiz">
    <div class="topbar">
      <button type="button" class="quit" data-testid="quit-button" aria-label="${esc(texts.quit)}">${ICONS.close}<span class="quit-label">${esc(texts.quit)}</span></button>
      <div class="timer" role="timer" aria-label="${esc(texts.timerLabel)}" data-testid="timer">${ICONS.clock}<span class="timer-value">${timerText(state, ctx.now)}</span></div>
      <div class="progress" data-testid="progress">${esc(progress)}</div>
    </div>
    <div class="ruler" aria-hidden="true" data-testid="ruler">${ticks}</div>
    <div class="stage">
      <div class="question" data-testid="question">${esc(texts.question)}</div>
      <div class="word" lang="sv" data-testid="word"${state.solved ? ' data-solved' : ''}>${esc(word.word)}</div>
      <p class="status" role="status" aria-live="polite" data-kind="${status.kind}" data-testid="status">${esc(status.text)}</p>
    </div>
    <div class="choices" data-hints="${settings.showHints}" data-count="${settings.activeClasses.length}">${choices}</div>
  </div>`;

  const screen = root.querySelector('.screen--quiz');
  root.querySelector('[data-testid="quit-button"]').addEventListener('click', () => ctx.onQuit());
  root.querySelectorAll('.choice').forEach((b) => b.addEventListener('click', () => ctx.onPick(b.dataset.key)));
  screen.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const key = keyToClass(e.key, settings.activeClasses, classMap);
    if (!key) return;
    e.preventDefault();
    ctx.onPick(key);
  });
  fitText(root.querySelector('.word'));
}

export function updateTimer(state, now, root) {
  const el = root.querySelector('.timer-value');
  if (el) el.textContent = timerText(state, now);
}
