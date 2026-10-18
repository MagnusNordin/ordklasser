// A fourth class (fixture config): layout keeps the design's spacing,
// radii and colors, and nothing overflows.
import { test, expect } from '@playwright/test';
import { SPEC, useFixtureConfig, waitForFonts } from './helpers.mjs';

async function open(page, viewport, query) {
  await page.setViewportSize(SPEC.viewports[viewport]);
  await useFixtureConfig(page, 'four-classes');
  await page.goto(`./?seed=3${query}`);
  await page.waitForSelector('[data-testid="app"] .screen');
  await waitForFonts(page);
}

async function noOverflow(page) {
  const spill = await page.evaluate(() => Array.from(document.querySelectorAll('#app *'))
    .filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > window.innerWidth + 1 || r.left < -1); })
    .map((el) => el.dataset.testid || el.className));
  expect(spill).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
}

test('desktop start: 4 cards in a 2×2 grid with the design gap and radius', async ({ page }) => {
  await open(page, 'desktop', '');
  const cards = page.locator('.card');
  await expect(cards).toHaveCount(4);
  const boxes = await cards.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
  expect(boxes[0].y).toBe(boxes[1].y);
  expect(boxes[2].y).toBeGreaterThan(boxes[0].y);
  expect(Math.round(boxes[1].x - boxes[0].right)).toBe(24);
  const radius = await cards.first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
  expect(radius).toBe(SPEC.tokens.radii.card);
  await expect(page.getByTestId('card-pronomen')).toHaveCSS('background-color', 'rgb(237, 227, 247)');
  await noOverflow(page);
});

for (const viewport of ['desktop', 'mobile']) {
  test(`${viewport} quiz: 4 choice buttons, design spacing, no overflow`, async ({ page }) => {
    await open(page, viewport, '');
    await page.getByTestId('start-button').click();
    const choices = page.locator('.choice');
    await expect(choices).toHaveCount(4);
    const boxes = await choices.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()));
    const radius = await choices.first().evaluate((e) => getComputedStyle(e).borderTopLeftRadius);
    if (viewport === 'desktop') {
      expect(new Set(boxes.map((b) => b.y)).size).toBe(1);
      expect(Math.round(boxes[1].x - boxes[0].right)).toBe(20);
      expect(radius).toBe(SPEC.tokens.radii.choice);
    } else {
      expect(new Set(boxes.map((b) => b.x)).size).toBe(1);
      expect(Math.round(boxes[1].y - boxes[0].bottom)).toBe(12);
      expect(radius).toBe(SPEC.tokens.radii.choiceMobile);
    }
    await expect(page.getByTestId('choice-pronomen').locator('.choice-sym')).toHaveText('P');
    await page.keyboard.press('4');
    await noOverflow(page);
  });
}
