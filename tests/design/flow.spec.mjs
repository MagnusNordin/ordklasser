// Plays real rounds (fixed seed, design fixture config) and checks the
// prototype's transitions, texts and states.
import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { ROOT, openGame } from './helpers.mjs';

const WORDS = JSON.parse(readFileSync(`${ROOT}tests/fixtures/design-config/words.json`, 'utf8')).words;
const CLASS_OF = Object.fromEntries(WORDS.map((w) => [w.word, w.classes[0]]));
const KEYS = ['substantiv', 'verb', 'adjektiv'];

async function currentWord(page) {
  return (await page.getByTestId('word').textContent()).trim();
}

async function answer(page) {
  const word = await currentWord(page);
  await page.getByTestId(`choice-${CLASS_OF[word]}`).click();
  return word;
}

async function waitForNext(page, i) {
  await expect(page.getByTestId('progress')).toHaveText(`Ord ${i} av 10`);
}

test('wrong pick, right pick, advance after 700 ms', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('start-button').click();
  await waitForNext(page, 1);
  await expect(page.getByTestId('status')).toHaveText('Tryck på rätt ordklass.');

  const word = await currentWord(page);
  const right = CLASS_OF[word];
  const wrong = KEYS.find((k) => k !== right);

  await page.getByTestId(`choice-${wrong}`).click();
  const wrongBtn = page.getByTestId(`choice-${wrong}`);
  await expect(wrongBtn).toHaveAttribute('data-state', 'wrong');
  await expect(wrongBtn).toBeDisabled();
  await expect(wrongBtn).toHaveAttribute('aria-label', `${wrong}, fel`);
  await expect(wrongBtn.locator('.icon-cross')).toHaveCount(1);
  await expect(page.getByTestId('status')).toHaveText(`”${word}” är inget ${wrong}. Försök igen.`);
  await expect(page.getByTestId('status')).toHaveAttribute('data-kind', 'wrong');

  await page.getByTestId(`choice-${right}`).click();
  const t0 = Date.now();
  const rightBtn = page.getByTestId(`choice-${right}`);
  await expect(rightBtn).toHaveAttribute('data-state', 'right');
  await expect(rightBtn.locator('.icon-check')).toHaveCount(1);
  await expect(page.getByTestId('status')).toHaveText(`Rätt! ”${word}” är ett ${right}.`);
  for (const k of KEYS.filter((k) => k !== right && k !== wrong)) {
    await expect(page.getByTestId(`choice-${k}`)).toHaveAttribute('data-state', 'dimmed');
  }
  await waitForNext(page, 2);
  const waited = Date.now() - t0;
  expect(waited).toBeGreaterThanOrEqual(550);
  expect(waited).toBeLessThan(1500);
  await expect(page.getByTestId('status')).toHaveText('Tryck på rätt ordklass.');
});

test('a full round ends on the result screen; play again and back to start', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('start-button').click();
  const played = [];
  for (let i = 1; i <= 10; i++) {
    await waitForNext(page, i);
    played.push(await answer(page));
  }
  await expect(page.getByTestId('result-line')).toHaveText(/^Du klarade 10 ord på \d+,\d sekunder\.$/);
  await expect(page.getByTestId('miss-line')).toHaveText('Rätt på första försöket varje gång!');
  await expect(page.getByTestId('best-line')).toHaveCount(0);
  await expect(page.locator('.tile')).toHaveCount(10);
  expect(new Set(played).size).toBe(10);
  for (const [i, w] of played.entries()) {
    await expect(page.getByTestId(`tile-${i}`).locator('.tile-word')).toHaveText(w);
  }

  await page.getByTestId('play-again').click();
  await waitForNext(page, 1);
  await page.getByTestId('quit-button').click();
  await expect(page.getByTestId('start-button')).toBeVisible();
  await expect(page.getByTestId('best-so-far')).toHaveText(/^Bästa tid hittills: \d+,\d s$/);

  await page.getByTestId('start-button').click();
  for (let i = 1; i <= 10; i++) {
    await waitForNext(page, i);
    await answer(page);
  }
  await page.getByTestId('to-start').click();
  await expect(page.getByTestId('start-button')).toBeVisible();
});

test('Avsluta mid-word cancels the pending advance', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('start-button').click();
  await answer(page);
  await page.getByTestId('quit-button').click();
  await expect(page.getByTestId('start-button')).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByTestId('start-button')).toBeVisible();
});

test('timer counts up while a word is unsolved and survives a hidden tab', async ({ page }) => {
  await openGame(page);
  await page.getByTestId('start-button').click();
  await page.waitForTimeout(450);
  const t1 = await page.locator('.timer-value').textContent();
  expect(t1).toMatch(/^0,[3-9] s$/);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(150);
  const t2 = await page.locator('.timer-value').textContent();
  const secs = Number(t2.replace(' s', '').replace(',', '.'));
  expect(secs).toBeLessThan(0.9);
});
