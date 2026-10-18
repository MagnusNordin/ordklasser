// Milestone 1: page background, text color and the design's fonts actually
// load. Milestone 2: the in-page config error uses design tokens only.
import { test, expect } from '@playwright/test';
import { SPEC, openDemo, useFixtureConfig, waitForFonts } from './helpers.mjs';

const TOKEN_COLORS = new Set([...Object.values(SPEC.tokens.colors), 'rgba(0, 0, 0, 0)']);

for (const viewport of Object.keys(SPEC.viewports)) {
  test(`${viewport}: background, text color and fonts load`, async ({ page }) => {
    await openDemo(page, viewport, 'start');
    const body = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(body).toBe(SPEC.tokens.colors.bg);
    const app = page.getByTestId('app');
    await expect(app).toHaveCSS('background-color', SPEC.tokens.colors.bg);
    await expect(app).toHaveCSS('color', SPEC.tokens.colors.ink);
    const loaded = await page.evaluate(() => ({
      display: document.fonts.check('800 64px "Bricolage Grotesque"'),
      body: document.fonts.check('400 16px "Atkinson Hyperlegible"'),
      bodyBold: document.fonts.check('700 16px "Atkinson Hyperlegible"'),
      faces: Array.from(document.fonts).filter((f) => f.status === 'loaded').map((f) => f.family.replace(/"/g, ''))
    }));
    expect(loaded.display && loaded.body && loaded.bodyBold, JSON.stringify(loaded)).toBe(true);
    expect(new Set(loaded.faces)).toEqual(new Set(['Bricolage Grotesque', 'Atkinson Hyperlegible']));
  });

  test(`${viewport}: config error message uses design tokens only`, async ({ page }) => {
    await page.setViewportSize(SPEC.viewports[viewport]);
    await useFixtureConfig(page, 'typo-in-words');
    await page.goto('./');
    const alert = page.getByRole('alert');
    await expect(alert).toContainText('ordet "katt" har okänd ordklass "substantv"');
    await waitForFonts(page);
    await expect(alert.locator('h1')).toHaveCSS('font-family', SPEC.tokens.fonts.display);
    await expect(alert.locator('li').first()).toHaveCSS('color', SPEC.tokens.colors.wrong);
    const used = await alert.evaluate((root) => {
      const out = [];
      for (const el of [root, ...root.querySelectorAll('*')]) {
        const cs = getComputedStyle(el);
        out.push(cs.color, cs.backgroundColor, cs.fontFamily);
      }
      return out;
    });
    const fonts = new Set([SPEC.tokens.fonts.display, SPEC.tokens.fonts.body]);
    for (const v of used) {
      if (v.startsWith('rgb')) expect(TOKEN_COLORS.has(v), `color ${v}`).toBe(true);
      else expect(fonts.has(v), `font ${v}`).toBe(true);
    }
  });
}
