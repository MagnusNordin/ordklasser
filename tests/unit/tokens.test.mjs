// Every color, font and radius token in tokens.css equals the design value.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ROOT, readJson } from './helpers.mjs';

const css = readFileSync(ROOT + 'site/styles/tokens.css', 'utf8');
const tokens = Object.fromEntries(Array.from(css.matchAll(/--([\w-]+):\s*([^;]+);/g), (m) => [m[1], m[2].trim()]));
const spec = readJson('design/spec.json').tokens;

function hexToRgb(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

const COLOR_VARS = {
  bg: 'bg', ink: 'ink', inkMuted: 'ink-muted', line: 'line', lineSoft: 'line-soft', surface: 'surface',
  ruler: 'ruler', right: 'right', wrong: 'wrong', wrongTint: 'wrong-tint'
};
const RADIUS_VARS = {
  pill: 'radius-pill', card: 'radius-card', cardMobile: 'radius-card-mobile', choice: 'radius-choice',
  choiceMobile: 'radius-choice-mobile', ruler: 'radius-ruler', tile: 'radius-tile', tileMobile: 'radius-tile-mobile'
};

test('every spec color has a token with the same value', () => {
  assert.deepEqual(Object.keys(COLOR_VARS).sort(), Object.keys(spec.colors).sort());
  for (const [name, v] of Object.entries(COLOR_VARS)) {
    assert.ok(tokens[v], `--${v} defined`);
    assert.equal(hexToRgb(tokens[v]), spec.colors[name], `--${v}`);
  }
});

test('font stacks equal the design (as the browser computes them)', () => {
  const computed = (stack) => stack.replace(/'/g, '"');
  assert.equal(computed(tokens['font-display']), spec.fonts.display);
  assert.equal(computed(tokens['font-body']), spec.fonts.body);
});

test('every spec radius has a token with the same value', () => {
  assert.deepEqual(Object.keys(RADIUS_VARS).sort(), Object.keys(spec.radii).sort());
  for (const [name, v] of Object.entries(RADIUS_VARS)) assert.equal(tokens[v], spec.radii[name], `--${v}`);
});

test('app.css uses tokens rather than raw design colors', () => {
  const app = readFileSync(ROOT + 'site/styles/app.css', 'utf8');
  for (const v of Object.values(COLOR_VARS)) {
    const hex = tokens[v].toUpperCase();
    if (hex === '#FFFFFF') continue; // white text/fills are literal in the design too
    assert.ok(!app.toUpperCase().includes(hex), `app.css hard-codes ${hex} (use var(--${v}))`);
  }
});
