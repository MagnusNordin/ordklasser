# Ordklasser

A Swedish word-class game (substantiv, verb, adjektiv) played against the clock,
deployed to GitHub Pages: <https://magnusnordin.github.io/ordklasser/>.

See [docs/PLAN.md](docs/PLAN.md) for the implementation plan: configuration
format, multi-class words, word bank, screens, and deployment.

## Run it locally

```bash
npm install
npm run serve        # http://localhost:4173/
```

The site in `site/` is plain HTML, CSS and ES modules with no build step;
`package.json` only holds test tools.

Useful URLs:

| URL | Shows |
|---|---|
| `/?ord=20&klasser=substantiv,verb&tips=0&lage=all` | Teacher link: 20 words, only substantiv and verb, no hints, every class of a word must be found. Values are clamped to the config's limits. |
| `/?seed=7` | Reproducible rounds (used by the tests). |
| `/?demo=start\|quiz\|wrong\|correct\|result` | The design's example screens, frozen (used by the design tests). |

## Edit the words

Everything the game shows lives in `site/config/`:

| File | Holds |
|---|---|
| `words.json` | The word bank. |
| `classes.json` | Word classes: name, symbol, hint, description, examples, colors. |
| `settings.json` | Round size and limits, hints, active classes, multi-class rules. |
| `texts.sv.json` | Every text on screen, with `{placeholders}`. |

### Add a word

1. Open `site/config/words.json` (GitHub's web editor is fine).
2. Add an entry to `"words"`:
   ```json
   { "word": "kanin", "classes": ["substantiv"] }
   ```
   A word with more than one class lists them all, plus one example sentence per class:
   ```json
   {
     "word": "bär",
     "classes": ["substantiv", "verb"],
     "examples": { "substantiv": "Vi plockar bär i skogen.", "verb": "Hon bär en tung väska." }
   }
   ```
3. Check it: `npm run validate`. A typo in a class name, a duplicate word or a
   missing text fails with a message that names the file and the word.
4. Push to `main`. CI validates, tests and then deploys; a broken config never
   reaches the live game.

### Add a word class

1. Add an entry to `classes.json` (`key`, `name`, `article` – `"en"` or `"ett"`,
   which decides "ett verb / inget verb" vs. "en … / ingen …" – `symbol`, `hint`,
   `description`, `example`, `moreExamples`, and `colors.tint` / `colors.deep`
   as `#RRGGBB` with at least 4.5:1 contrast).
2. Add its key to `activeClasses` in `settings.json` (the order is the button order;
   keys 1–n and the symbol letter pick a class from the keyboard).
3. Tag at least `maxWordsPerRound / number of classes` words with it so rounds stay balanced.
4. `npm run validate`, then push.

## Tests

| Command | Runs |
|---|---|
| `npm run validate` | Config validator (`scripts/validate-config.mjs [dir]`). |
| `npm test` | Unit tests (`node:test` + jsdom) with enforced coverage: 95 % lines, 90 % branches, 95 % functions. |
| `npm run test:design` | Playwright: screenshots vs. the design's reference images (≤ 1 % differing pixels), measured values vs. `design/spec.json` (± 2 px), game flow, axe accessibility, keyboard play, no horizontal scroll from 320 to 1440 px. Needs `npx playwright install chromium` once. |
| `npm run check` | All three – what CI runs. |

### The design as test data

`design/source/` holds the Ordklasser canvas's artboards. `npm run capture`
renders them in headless Chromium (with the small renderer in
`scripts/dc-render.js`) into `design/reference/*.png` and measures every key
element into `design/spec.json`. Re-run it only when the design changes; the
design tests use a pinned config in `tests/fixtures/design-config/`, so editing
the real word list never breaks them.

## Deploy

`.github/workflows/pages.yml` runs validation, unit tests and design tests on
every pull request and push; pushes to `main` then deploy `site/` to GitHub
Pages, stamping the commit SHA into `index.html` so config edits are never
served from cache.

One-time setup: in the repository's *Settings → Pages*, set *Source* to
**GitHub Actions**.

## Status

| Milestone | State |
|---|---|
| 1 – Skeleton, deploy, test harness | Done |
| 2 – Configuration and validation | Done |
| 3 – Game logic (incl. multi-class rules, both modes) | Done |
| 4 – Desktop UI | Done – all 5 desktop artboards pass the visual and spec checks |
| 5 – Mobile layout | Done – all 5 mobile artboards pass |
| 6 – Multi-class words in the UI | Partly: game rules, status texts and the "also right" outline work. Example sentences, the "2 ordklasser" badge and the result-tile marker wait for new artboards to be drawn and approved (plan §10.6). |
| 7 – Polish | Done: keyboard play, pause on hidden tab, URL overrides, reduced motion, focus styles, 4-class layout check |
