// Screenshot of each fixture state vs. the design's reference PNG:
// at most 1 % of pixels may differ (per-pixel threshold 0.2).
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { ARTBOARDS, STATES } from '../../scripts/spec-targets.mjs';
import { ROOT, SPEC, openDemo } from './helpers.mjs';

const MAX_DIFF = 0.01;

for (const viewport of Object.keys(SPEC.viewports)) {
  for (const state of STATES) {
    const artboard = ARTBOARDS[viewport][state];
    test(`${viewport} ${state} looks like ${artboard}`, async ({ page }, info) => {
      await openDemo(page, viewport, state);
      const { width, height } = SPEC.viewports[viewport];
      const actual = PNG.sync.read(await page.screenshot({ clip: { x: 0, y: 0, width, height }, animations: 'disabled' }));
      const expected = PNG.sync.read(readFileSync(`${ROOT}design/reference/${artboard}.png`));
      expect([actual.width, actual.height]).toEqual([expected.width, expected.height]);
      const diff = new PNG({ width, height });
      const bad = pixelmatch(expected.data, actual.data, diff.data, width, height, { threshold: 0.2 });
      const ratio = bad / (width * height);
      if (ratio > MAX_DIFF) {
        await info.attach('expected', { body: PNG.sync.write(expected), contentType: 'image/png' });
        await info.attach('actual', { body: PNG.sync.write(actual), contentType: 'image/png' });
        await info.attach('diff', { body: PNG.sync.write(diff), contentType: 'image/png' });
      }
      expect(ratio, `${(ratio * 100).toFixed(2)} % of pixels differ`).toBeLessThanOrEqual(MAX_DIFF);
    });
  }
}
