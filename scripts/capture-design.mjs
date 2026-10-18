// Renders the canvas's artboards (design/source) in headless Chromium and
// writes one reference PNG per artboard (design/reference) plus the measured
// values of every key element (design/spec.json).
//
//   node scripts/capture-design.mjs
import { chromium } from '@playwright/test';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { VIEWPORTS, STATES, ARTBOARDS, TARGETS, measureElement, locateInDesign } from './spec-targets.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const renderer = await readFile(ROOT + 'scripts/dc-render.js', 'utf8');

const shell = `<!doctype html><html lang="sv"><head><meta charset="utf-8">
<style>body{margin:0}</style><script>${renderer}</script></head><body><div id="mount"></div></body></html>`;

const browser = await chromium.launch();
const spec = { viewports: VIEWPORTS, screens: {}, tokens: {} };
await mkdir(ROOT + 'design/reference', { recursive: true });

for (const [vp, size] of Object.entries(VIEWPORTS)) {
  spec.screens[vp] = {};
  const main = ARTBOARDS[vp].start;
  const source = await readFile(`${ROOT}design/source/${main}.dc.html`, 'utf8');
  for (const state of STATES) {
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await page.setContent(shell);
    await page.evaluate(([src, screen]) => {
      window.renderDC(src, document.getElementById('mount'), { screen });
    }, [source, state]);
    await page.waitForLoadState('networkidle');
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.fonts).map((f) => f.load().catch(() => null)));
    });
    const names = TARGETS[state];
    const elements = await page.evaluate(
      ([names, locate, measure]) => {
        const locateFn = new Function('return ' + locate)();
        const measureFn = new Function('return ' + measure)();
        const found = locateFn(document.getElementById('mount').firstElementChild, names);
        const out = {};
        for (const n of names) {
          if (!found[n]) throw new Error('design element not found: ' + n);
          out[n] = measureFn(found[n]);
        }
        return out;
      },
      [names, locateInDesign.toString(), measureElement.toString()]
    );
    const artboard = ARTBOARDS[vp][state];
    await page.screenshot({ path: `${ROOT}design/reference/${artboard}.png`, clip: { x: 0, y: 0, ...size } });
    spec.screens[vp][state] = { artboard, elements };
    await page.close();
    console.log(`captured ${artboard}`);
  }
}
await browser.close();

const d = spec.screens.desktop;
const m = spec.screens.mobile;
spec.tokens = {
  colors: {
    bg: d.start.elements.app.background,
    ink: d.start.elements.app.color,
    inkMuted: d.start.elements.kicker.color,
    line: d.quiz.elements['quit-button'].border.split(' ').slice(1).join(' '),
    lineSoft: d.quiz.elements.timer.border.split(' ').slice(1).join(' '),
    surface: d.quiz.elements.timer.background,
    ruler: d.quiz.elements.ruler.background,
    right: d.correct.elements['choice-verb'].background,
    wrong: d.wrong.elements['choice-substantiv'].border.split(' ').slice(1).join(' '),
    wrongTint: d.wrong.elements['choice-substantiv'].background
  },
  fonts: {
    display: d.start.elements.title.fontFamily,
    body: d.start.elements.app.fontFamily
  },
  radii: {
    pill: d.start.elements['start-button'].radius,
    card: d.start.elements['card-verb'].radius,
    cardMobile: m.start.elements['card-verb'].radius,
    choice: d.quiz.elements['choice-verb'].radius,
    choiceMobile: m.quiz.elements['choice-verb'].radius,
    ruler: d.quiz.elements.ruler.radius,
    tile: d.result.elements['tile-0'].radius,
    tileMobile: m.result.elements['tile-0'].radius
  }
};
await writeFile(ROOT + 'design/spec.json', JSON.stringify(spec, null, 2) + '\n');
console.log('wrote design/spec.json');
