// Renders one design state (a canvas artboard) into a Playwright page, so the
// capture script and the visual test draw the design in the same browser.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { designSource } from './spec-targets.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

export async function openDesign(page, viewport, state) {
  const renderer = await readFile(ROOT + 'scripts/dc-render.js', 'utf8');
  const { file, screen } = designSource(viewport, state);
  const source = await readFile(`${ROOT}design/source/${file}.dc.html`, 'utf8');
  await page.setContent(`<!doctype html><html lang="sv"><head><meta charset="utf-8">
<style>body{margin:0}</style><script>${renderer}</script></head><body><div id="mount"></div></body></html>`);
  await page.evaluate(([src, screen]) => {
    window.renderDC(src, document.getElementById('mount'), { screen });
  }, [source, screen]);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.fonts).map((f) => f.load().catch(() => null)));
  });
}
