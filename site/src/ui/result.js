// Result screen: total time, misses, best time and the word history.
import { fill, formatTime } from '../format.js';
import { bestLine, missLine } from '../game.js';
import { classVars, esc } from './dom.js';

// ctx: { config, onAgain, onDone }
export function render(state, ctx, root) {
  const { classMap, texts } = ctx.config;
  const dot = (k) => `<span class="dot" style="--dot:${classMap[k].colors.deep}"></span>`;
  const time = formatTime(state.totalMs);
  const best = bestLine(state, texts);
  const tiles = state.history.map((h, i) => {
    const c = classMap[h.first];
    const meta = h.classes.map((k) => classMap[k].name).join('/') + ' · ' + formatTime(h.ms) + ' s';
    const dotKeys = [h.first, ...h.classes.filter((k) => k !== h.first)];
    const marker = h.classes.length > 1
      ? `<span class="tile-marker" data-testid="tile-marker-${i}" aria-hidden="true">${dotKeys.map(dot).join('')}</span>`
      : '';
    return `
      <div class="tile" data-testid="tile-${i}"${h.miss ? ' data-miss' : ''}${h.classes.length > 1 ? ' data-multi' : ''} style="${classVars(c)}">${marker}
        <span class="tile-word" lang="sv">${esc(h.word)}</span>
        <span class="tile-meta">${esc(meta)}</span>
      </div>`;
  }).join('');
  const multiLegend = state.history.some((h) => h.classes.length > 1)
    ? `<span class="legend-item" data-testid="legend-multi"><span class="dots" aria-hidden="true">${ctx.config.settings.activeClasses.slice(0, 2).map(dot).join('')}</span>${esc(texts.legendMulti)}</span>`
    : '';
  root.dataset.screen = 'result';
  root.innerHTML = `
  <div class="screen screen--result">
    <div class="result-main">
      <div class="kicker" data-testid="result-kicker">${esc(texts.resultKicker)}</div>
      <div class="result-time"><span class="result-num" data-testid="result-time">${time}</span><span class="result-unit">${esc(texts.seconds)}</span></div>
      <p class="result-line" data-testid="result-line">${esc(fill(texts.resultLine, { n: state.round.length, time }))}</p>
      <div class="result-meta">
        <span data-testid="miss-line">${esc(missLine(state, texts))}</span>
        ${best ? `<span class="best-line" data-kind="${best.kind}" data-testid="best-line">${esc(best.text)}</span>` : ''}
      </div>
      <div class="history" data-testid="history">${tiles}</div>
      <div class="legend" data-testid="legend">
        <span class="legend-item"><span class="swatch swatch--direct"></span>${esc(texts.legendDirect)}</span>
        <span class="legend-item"><span class="swatch swatch--missed"></span>${esc(texts.legendMissed)}</span>
        ${multiLegend}
      </div>
    </div>
    <div class="result-actions">
      <button type="button" class="btn-primary" data-testid="play-again">${esc(texts.playAgain)}</button>
      <button type="button" class="btn-secondary" data-testid="to-start">${esc(texts.toStart)}</button>
    </div>
  </div>`;
  root.querySelector('[data-testid="play-again"]').addEventListener('click', () => ctx.onAgain());
  root.querySelector('[data-testid="to-start"]').addEventListener('click', () => ctx.onDone());
}
