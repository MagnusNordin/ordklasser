// Screenshot of each fixture state vs. the design artboard rendered in the
// same browser (so fonts and anti-aliasing match on any machine): at most
// 1 % of pixels may differ (per-pixel threshold 0.2). The committed PNGs in
// design/reference are the reviewed snapshot; the design must still match it.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { ARTBOARDS, STATES } from '../../scripts/spec-targets.mjs';
import { openDesign } from '../../scripts/render-design.mjs';
import { ROOT, SPEC, openDemo } from './helpers.mjs';

const MAX_DIFF = 0.01;
// Committed reference vs. a fresh render of the design: only rendering noise
// between machines is allowed, never a changed design.
const MAX_SNAPSHOT_DRIFT = 0.03;

function compare(a, b, width, height) {
  const diff = new PNG({ width, height });
  const bad = pixelmatch(a.data, b.data, diff.data, width, height, { threshold: 0.2 });
  return { ratio: bad / (width * height), diff };
}

for (const viewport of Object.keys(SPEC.viewports)) {
  for (const state of STATES) {
    const artboard = ARTBOARDS[viewport][state];
    test(`${viewport} ${state} looks like ${artboard}`, async ({ page, browser }, info) => {
      const { width, height } = SPEC.viewports[viewport];
      const clip = { x: 0, y: 0, width, height };

      const designPage = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
      await openDesign(designPage, viewport, state);
      const expected = PNG.sync.read(await designPage.screenshot({ clip, animations: 'disabled' }));
      await designPage.close();

      await openDemo(page, viewport, state);
      const actual = PNG.sync.read(await page.screenshot({ clip, animations: 'disabled' }));

      const snapshot = PNG.sync.read(readFileSync(`${ROOT}design/reference/${artboard}.png`));
      const drift = compare(snapshot, expected, width, height).ratio;
      expect(drift, `design render drifted ${(drift * 100).toFixed(2)} % from design/reference/${artboard}.png`).toBeLessThanOrEqual(MAX_SNAPSHOT_DRIFT);

      const { ratio, diff } = compare(expected, actual, width, height);
      if (ratio > MAX_DIFF) {
        await info.attach('expected', { body: PNG.sync.write(expected), contentType: 'image/png' });
        await info.attach('actual', { body: PNG.sync.write(actual), contentType: 'image/png' });
        await info.attach('diff', { body: PNG.sync.write(diff), contentType: 'image/png' });
      }
      expect(ratio, `${(ratio * 100).toFixed(2)} % of pixels differ`).toBeLessThanOrEqual(MAX_DIFF);
    });
  }
}
