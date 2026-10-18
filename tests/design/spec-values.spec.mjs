// Every key element's box (± 2 px), colors, font, radius and text equal the
// values measured from the design (design/spec.json).
import { test, expect } from '@playwright/test';
import { STATES, TARGETS, measureElement } from '../../scripts/spec-targets.mjs';
import { SPEC, openDemo } from './helpers.mjs';

const EXACT = ['background', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'radius', 'border', 'opacity', 'text'];

for (const viewport of Object.keys(SPEC.viewports)) {
  for (const state of STATES) {
    test(`${viewport} ${state} matches spec values`, async ({ page }) => {
      await openDemo(page, viewport, state);
      const expected = SPEC.screens[viewport][state].elements;
      const actual = await page.evaluate(([names, measure]) => {
        const fn = new Function('return ' + measure)();
        const out = {};
        for (const n of names) {
          const el = document.querySelector(`[data-testid="${n}"]`);
          out[n] = el ? fn(el) : null;
        }
        return out;
      }, [TARGETS[state], measureElement.toString()]);

      const problems = [];
      for (const name of TARGETS[state]) {
        const want = expected[name];
        const got = actual[name];
        if (!got) { problems.push(`${name}: missing in app`); continue; }
        for (const k of ['x', 'y', 'w', 'h']) {
          if (Math.abs(got.box[k] - want.box[k]) > 2) problems.push(`${name}.box.${k}: ${got.box[k]} ≠ ${want.box[k]}`);
        }
        for (const k of EXACT) {
          if (got[k] !== want[k]) problems.push(`${name}.${k}: ${JSON.stringify(got[k])} ≠ ${JSON.stringify(want[k])}`);
        }
      }
      expect(problems, problems.join('\n')).toEqual([]);
    });
  }
}
