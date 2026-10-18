// axe-core on every screen, a keyboard-only round, visible focus, and no
// horizontal scroll at common widths.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { STATES } from '../../scripts/spec-targets.mjs';
import { ROOT, SPEC, openDemo, openGame, useFixtureConfig, waitForFonts } from './helpers.mjs';

const WORDS = JSON.parse(readFileSync(`${ROOT}tests/fixtures/design-config/words.json`, 'utf8')).words;
const CLASS_OF = Object.fromEntries(WORDS.map((w) => [w.word, w.classes[0]]));
const KEY_OF = { substantiv: '1', verb: '2', adjektiv: '3' };

for (const viewport of Object.keys(SPEC.viewports)) {
  for (const state of STATES) {
    test(`axe: ${viewport} ${state} has no serious violations`, async ({ page }) => {
      await openDemo(page, viewport, state);
      const { violations } = await new AxeBuilder({ page }).analyze();
      const serious = violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
      expect(serious.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([]);
    });
  }
}

test('keyboard-only round with visible focus', async ({ page }) => {
  await openGame(page);
  await page.keyboard.press('Tab');
  const start = page.getByTestId('start-button');
  await expect(start).toBeFocused();
  const outline = await start.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).toBe('solid');
  await page.keyboard.press('Enter');
  for (let i = 1; i <= 10; i++) {
    await expect(page.getByTestId('progress')).toHaveText(`Ord ${i} av 10`);
    const word = (await page.getByTestId('word').textContent()).trim();
    await page.keyboard.press(KEY_OF[CLASS_OF[word]]);
  }
  await expect(page.getByTestId('result-line')).toBeVisible();
  // Focus stays in the page so play can continue from the keyboard.
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => document.activeElement?.dataset.testid);
  expect(['play-again', 'to-start']).toContain(focused);
});

test('letter keys pick by class symbol; modifiers are ignored', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('start-button').click();
  const word = (await page.getByTestId('word').textContent()).trim();
  const right = CLASS_OF[word];
  const symbol = { substantiv: 's', verb: 'v', adjektiv: 'a' }[right];
  await page.keyboard.press(`Control+${symbol}`);
  await expect(page.getByTestId(`choice-${right}`)).toHaveAttribute('data-state', 'neutral');
  await page.keyboard.press(symbol);
  await expect(page.getByTestId(`choice-${right}`)).toHaveAttribute('data-state', 'right');
});

const WIDTHS = [320, 360, 390, 720, 1024, 1440];
for (const width of WIDTHS) {
  test(`no horizontal scroll at ${width} px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await useFixtureConfig(page);
    const overflow = [];
    for (const state of STATES) {
      await page.goto(`./?demo=${state}&ord=30`);
      await page.waitForSelector('[data-testid="app"] .screen');
      await waitForFonts(page);
      const w = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (w > 0) overflow.push(`${state}: ${w}px`);
      // Nothing inside the app may spill past the viewport either.
      const spill = await page.evaluate(() => Array.from(document.querySelectorAll('#app *'))
        .filter((el) => { const r = el.getBoundingClientRect(); return r.width && (r.right > window.innerWidth + 1 || r.left < -1); })
        .map((el) => el.dataset.testid || el.className).slice(0, 3));
      if (spill.length) overflow.push(`${state}: ${spill.join(', ')}`);
    }
    expect(overflow).toEqual([]);
  });
}

for (const viewport of Object.keys(SPEC.viewports)) {
  test(`focus ring is visible at ${viewport} (screenshots attached)`, async ({ page }, info) => {
    await openGame(page, viewport);
    await page.keyboard.press('Tab');
    const start = page.getByTestId('start-button');
    await expect(start).toBeFocused();
    await expect(start).toHaveCSS('outline-style', 'solid');
    await expect(start).toHaveCSS('outline-width', '3px');
    await expect(start).toHaveCSS('outline-color', SPEC.tokens.colors.ink);
    await info.attach(`focus-start-${viewport}`, { body: await page.screenshot(), contentType: 'image/png' });
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focused = page.locator(':focus');
    await expect(focused).toHaveAttribute('data-testid', 'choice-substantiv');
    await expect(focused).toHaveCSS('outline-style', 'solid');
    await info.attach(`focus-choice-${viewport}`, { body: await page.screenshot(), contentType: 'image/png' });
  });
}
