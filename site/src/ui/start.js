// Start screen: the classes with examples, the start button and best time.
import { fill, formatTime } from '../format.js';
import { ICONS, classVars, esc, fitTextWhenReady } from './dom.js';

// ctx: { config, mobile, best, onStart }
export function render(state, ctx, root) {
  const { settings, classMap, texts } = ctx.config;
  const active = settings.activeClasses.map((k) => classMap[k]);
  // Desktop cards read name → example; mobile puts the example first, beside the text.
  const cards = active.map((c) => {
    const name = `<span class="card-name">${esc(c.name)}</span>`;
    const example = `<span class="card-example" lang="sv">${esc(c.example)}</span>`;
    const desc = `<span class="card-desc">${esc(c.description)}</span>`;
    const chips = `<span class="chips">${c.moreExamples.map((m) => `<span class="chip" lang="sv">${esc(m)}</span>`).join('')}</span>`;
    const body = ctx.mobile
      ? `${example}<span class="card-text">${name}${desc}${chips}</span>`
      : `${name}${example}${desc}${chips}`;
    return `<div class="card" data-testid="card-${esc(c.key)}" style="${classVars(c)}">${body}</div>`;
  }).join('');
  const best = ctx.best != null
    ? `<p class="best-so-far" data-testid="best-so-far">${esc(fill(texts.bestSoFar, { time: formatTime(ctx.best) }))}</p>`
    : '';
  root.dataset.screen = 'start';
  root.innerHTML = `
  <div class="screen screen--start">
    <div class="intro">
      <div class="kicker" data-testid="kicker">${esc(texts.kicker)}</div>
      <h1 class="title" data-testid="title">${esc(texts.title)}</h1>
      <p class="subtitle" data-testid="subtitle">${esc(texts.subtitle)}</p>
    </div>
    <div class="cards" data-count="${active.length}" style="--cols:${active.length === 4 ? 2 : Math.min(active.length, 3)}">${cards}</div>
    <div class="start-row">
      <button type="button" class="btn-primary start-button" data-testid="start-button">${esc(texts.start)}${ICONS.arrow}</button>
      <div class="start-info">
        <p class="round-info" data-testid="round-info">${esc(fill(texts.roundInfo, { n: settings.wordsPerRound }))}</p>
        ${best}
      </div>
    </div>
  </div>`;
  root.querySelector('[data-testid="start-button"]').addEventListener('click', () => ctx.onStart());
  root.querySelectorAll('.card-example').forEach((el) => fitTextWhenReady(el));
}
