import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const SPEC = JSON.parse(readFileSync(ROOT + 'design/spec.json', 'utf8'));

// Serves the pinned design fixture config (or another fixture dir) instead
// of site/config, so editing the real word list never breaks a design test.
export async function useFixtureConfig(page, dir = 'design-config') {
  await page.route('**/config/*.json*', (route) => {
    const file = new URL(route.request().url()).pathname.split('/').pop();
    route.fulfill({
      contentType: 'application/json',
      body: readFileSync(`${ROOT}tests/fixtures/${dir}/${file}`, 'utf8')
    });
  });
}

export async function waitForFonts(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.fonts).map((f) => f.load().catch(() => null)));
  });
}

// Opens a fixture state (?demo=…) at a viewport from spec.json.
export async function openDemo(page, viewport, state, extra = '') {
  await page.setViewportSize(SPEC.viewports[viewport]);
  await useFixtureConfig(page);
  await page.goto(`./?demo=${state}${extra}`);
  await page.waitForSelector('[data-testid="app"] .screen');
  await waitForFonts(page);
}

// Opens the live game with a fixed seed.
export async function openGame(page, viewport = 'desktop', query = '') {
  await page.setViewportSize(SPEC.viewports[viewport]);
  await useFixtureConfig(page);
  await page.goto(`./?seed=7${query}`);
  await page.waitForSelector('[data-testid="start-button"]');
  await waitForFonts(page);
}
