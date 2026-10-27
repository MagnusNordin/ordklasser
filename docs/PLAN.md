# Ordklasser – implementation plan

A small Swedish word-class game: a word is shown, the player taps its word class
(substantiv, verb, adjektiv) and races the clock through a round. Built as a
static site, deployed to GitHub Pages, with all words, classes, texts and rules
in plain JSON config files.

Source design: the "Ordklasser" canvas (desktop 1024×768 and mobile 390×844
artboards: start, ord, fel val, rätt val, resultat, plus a playable prototype).
This plan turns that prototype into a real app and adds one thing the design
does not cover: **a word can belong to more than one class**.

---

## 1. Goals and non-goals

**Goals**

- Match the design's look and flow: start → quiz (neutral / wrong / correct
  states) → result, on desktop and phone.
- Deploy automatically to GitHub Pages on every push to `main`.
- Make every piece of content configurable without touching code: words,
  classes, round length, hints, texts, colors.
- Support words with multiple word classes (e.g. *bär*, *får*, *kort*).
- Make it trivial to add a fourth class later (e.g. pronomen, adverb).

**Non-goals (for now)**

- No accounts, server, or shared leaderboard. Best time lives in the browser.
- No in-app editor for the word list; editing is done in JSON in the repo.
- No inflection/sentence parsing: each word is a fixed string with fixed classes.

---

## 2. Tech choices

| Decision | Choice | Why |
|---|---|---|
| Framework | None – vanilla HTML, CSS, ES modules | Three screens and a timer don't need a framework. No build step means "edit JSON → push → live". |
| Build | None | GitHub Pages serves `site/` as-is. |
| Config format | JSON files in `site/config/` | Readable, editable in GitHub's web editor, fetchable from the browser. |
| Unit tests | `node:test` (built into Node 22) + `jsdom` for UI modules | Fast, no browser needed. Built-in coverage with enforced thresholds. |
| Design verification | Playwright (`@playwright/test`) against the design's reference images and measured specs | Every step is checked against the design automatically, not by eye. See section 10. |
| Config validation | `scripts/validate-config.mjs` run in CI | A typo in the word list fails the deploy instead of breaking the live game. |
| Deploy | GitHub Actions → `actions/deploy-pages` | Official Pages flow; deploys only after validation, unit tests and design checks pass. |

The site itself still has no build step and no runtime dependencies;
`package.json` only holds dev dependencies for testing.
| Fonts | Google Fonts: Anton (display), DM Sans (body) | Matches the Cutie Poppers shop. |
| Storage | `localStorage` (wrapped in try/catch) | Best time per configuration; the game works fine without it. |

---

## 3. Repository layout

```
ordklasser/
├─ site/                         ← everything deployed to Pages
│  ├─ index.html
│  ├─ styles/
│  │  ├─ tokens.css              ← colors, fonts, radii from the design
│  │  └─ app.css                 ← layout, responsive rules
│  ├─ src/
│  │  ├─ main.js                 ← boot: load config, wire up UI
│  │  ├─ config.js               ← fetch + normalize + validate config
│  │  ├─ game.js                 ← pure state machine (no DOM)
│  │  ├─ round.js                ← pure: build a balanced round
│  │  ├─ format.js               ← "2,7 s", Swedish articles/negation
│  │  ├─ storage.js              ← best time in localStorage
│  │  └─ ui/
│  │     ├─ start.js
│  │     ├─ quiz.js
│  │     └─ result.js
│  └─ config/
│     ├─ settings.json           ← round size, hints, multi-class mode, timing
│     ├─ classes.json            ← word class definitions + colors
│     ├─ words.json              ← the word bank
│     └─ texts.sv.json           ← all UI strings
├─ design/
│  ├─ source/                    ← the canvas's .dc.html artboards, as exported
│  ├─ reference/                 ← one PNG per artboard (10 images)
│  └─ spec.json                  ← measured values from the design (section 10.2)
├─ scripts/
│  ├─ validate-config.mjs
│  └─ capture-design.mjs         ← renders design/source → design/reference
├─ tests/
│  ├─ unit/                      ← node:test, one file per src module
│  │  ├─ config.test.mjs
│  │  ├─ round.test.mjs
│  │  ├─ game.test.mjs
│  │  ├─ format.test.mjs
│  │  ├─ storage.test.mjs
│  │  ├─ tokens.test.mjs         ← CSS tokens equal design values
│  │  ├─ design-assets.test.mjs  ← references and spec are complete
│  │  ├─ content.test.mjs        ← texts/classes equal the design
│  │  ├─ parity.test.mjs         ← our logic vs. the prototype's logic
│  │  ├─ ui-start.test.mjs       ← jsdom
│  │  ├─ ui-quiz.test.mjs        ← jsdom
│  │  └─ ui-result.test.mjs      ← jsdom
│  ├─ fixtures/                  ← broken/edge-case configs for the validator
│  └─ design/                    ← Playwright: compare app with the design
│     ├─ visual.spec.mjs
│     ├─ spec-values.spec.mjs
│     ├─ flow.spec.mjs
│     └─ a11y.spec.mjs
├─ playwright.config.mjs
├─ package.json                  ← dev dependencies + npm scripts only
├─ .github/workflows/pages.yml
├─ docs/PLAN.md                  ← this file
└─ README.md                     ← how to run locally and edit words
```

`game.js`, `round.js`, `format.js` and the validation part of `config.js` are
pure functions so they can be imported both by the browser and by Node tests.
UI modules export `render(state, config, root)` functions that take a DOM root,
so they can be unit-tested in jsdom without a browser.

npm scripts:

| Script | Runs |
|---|---|
| `npm run validate` | config validator |
| `npm test` | all unit tests with coverage thresholds |
| `npm run test:design` | Playwright design verification |
| `npm run check` | all three, in that order – what CI runs |
| `npm run serve` | local static server for `site/` |

---

## 4. Configuration

All four files live in `site/config/`. Editing any of them and pushing to
`main` redeploys the game.

### 4.1 `settings.json`

```json
{
  "wordsPerRound": 10,
  "minWordsPerRound": 3,
  "maxWordsPerRound": 30,
  "showHints": true,
  "activeClasses": ["substantiv", "verb", "adjektiv"],
  "advanceDelayMs": 700,
  "multiClass": {
    "mode": "any",
    "maxPerRound": 2
  },
  "allowUrlOverrides": true
}
```

| Key | Meaning |
|---|---|
| `wordsPerRound` | Default number of words in a round (design: 10). |
| `min/maxWordsPerRound` | Clamp for the value, also for URL overrides (design: 3–30). |
| `showHints` | Show the short hint under each class name on the choice buttons. |
| `activeClasses` | Which classes from `classes.json` are playable, in button order. |
| `advanceDelayMs` | Pause on the "Rätt!" state before the next word (design: 700 ms). |
| `multiClass.mode` | `"any"` or `"all"` – see section 5. |
| `multiClass.maxPerRound` | Cap on multi-class words per round so they stay a spice, not the meal. `0` disables them. |
| `allowUrlOverrides` | Allow `?ord=20&klasser=substantiv,verb&tips=0&lage=all` for teachers sharing a link. |

### 4.2 `classes.json`

One entry per class. Adding a class = adding an entry here, adding it to
`activeClasses`, and tagging words with it.

```json
[
  {
    "key": "substantiv",
    "name": "substantiv",
    "article": "ett",
    "symbol": "S",
    "hint": "saker, djur, personer",
    "description": "Namn på saker, djur, personer och platser.",
    "example": "hund",
    "moreExamples": ["katt", "skola", "äpple"],
    "colors": { "tint": "#FCE6D4", "deep": "#8A420E" }
  },
  {
    "key": "verb",
    "name": "verb",
    "article": "ett",
    "symbol": "V",
    "hint": "något man gör",
    "description": "Något man gör eller något som händer.",
    "example": "äter",
    "moreExamples": ["läser", "sover", "bygger"],
    "colors": { "tint": "#DCE8FA", "deep": "#1D4C91" }
  },
  {
    "key": "adjektiv",
    "name": "adjektiv",
    "article": "ett",
    "symbol": "A",
    "hint": "hur något är",
    "description": "Beskriver hur något är eller ser ut.",
    "example": "röd",
    "moreExamples": ["glad", "stor", "mjuk"],
    "colors": { "tint": "#D3F1EA", "deep": "#0B6553" }
  }
]
```

`article` drives the grammar of feedback texts: `"ett"` → "är **ett** verb" /
"är **inget** verb"; `"en"` → "är **en** …" / "är **ingen** …". This keeps the
texts correct if a future class needs "en".

### 4.3 `words.json`

Each word lists one or more classes. Single-class words can use a short form;
the loader normalizes both to the long form.

```json
{
  "words": [
    { "word": "hund", "classes": ["substantiv"] },
    { "word": "springer", "classes": ["verb"] },
    {
      "word": "bär",
      "classes": ["substantiv", "verb"],
      "examples": {
        "substantiv": "Vi plockar bär i skogen.",
        "verb": "Hon bär en tung väska."
      }
    }
  ]
}
```

- `word` – the string shown. Must be unique (case-insensitive).
- `classes` – one or more keys from `classes.json`. Order doesn't matter.
- `examples` – optional, one sentence per class. Shown after a correct answer
  on multi-class words so the player sees *why* both are right. Recommended
  for every multi-class word; the validator warns if one is missing.

### 4.4 `texts.sv.json`

Every user-facing string, with `{placeholders}`:

```json
{
  "kicker": "Ordklasser",
  "title": "Vilken ordklass är ordet?",
  "subtitle": "Så känner du igen dem. Sedan kör du mot klockan.",
  "start": "starta",
  "roundInfo": "{n} ord per runda. Klockan går tills du valt rätt på alla.",
  "bestSoFar": "Bästa tid hittills: {time} s",
  "quit": "Avsluta",
  "question": "Vilken ordklass?",
  "progress": "Ord {i} av {n}",
  "progressShort": "{i} / {n}",
  "promptIdle": "Tryck på rätt ordklass.",
  "promptWrong": "”{word}” är {neg} {class}. Försök igen.",
  "promptRight": "Rätt! ”{word}” är {art} {class}.",
  "promptRightAlso": "Rätt! ”{word}” är {art} {class} – men kan också vara {others}.",
  "promptFoundOneMore": "Rätt! ”{word}” är {art} {class}. Det finns en ordklass till – hitta den!",
  "promptFoundAll": "Rätt! ”{word}” kan vara både {all}.",
  "resultKicker": "Resultat · Ordklasser",
  "resultLine": "Du klarade {n} ord på {time} sekunder.",
  "noMisses": "Rätt på första försöket varje gång!",
  "misses": "Felklick på vägen: {n}",
  "newRecord": "Nytt rekord! Förra bästa var {time} s.",
  "bestTime": "Bästa tid: {time} s",
  "legendDirect": "rätt direkt",
  "legendMissed": "fel först",
  "playAgain": "spela igen",
  "toStart": "till start"
}
```

Lists like `{others}` / `{all}` are joined Swedish-style: "ett substantiv",
"ett substantiv och ett verb", "ett substantiv, ett verb och ett adjektiv".

### 4.5 Validation rules (`scripts/validate-config.mjs`)

Errors (fail the deploy):

- Invalid JSON, or missing required keys.
- Duplicate class keys or duplicate words (case-insensitive, trimmed).
- A word with no classes, or a class key not defined in `classes.json`.
- `activeClasses` refers to an unknown class, or has fewer than 2 entries.
- `wordsPerRound` outside `min…max`.
- Not enough playable words to fill `maxWordsPerRound` without repeats.
- A text template missing a placeholder the code needs.
- Colors not valid `#RRGGBB`.

Warnings (printed, don't fail):

- Multi-class word without an `examples` sentence for each class.
- An active class with fewer than `ceil(maxWordsPerRound / activeClasses)` words
  (rounds can't stay balanced).
- `tint`/`deep` contrast below 4.5:1 (class name text on its tint).

The same validation runs in the browser at boot; on error the page shows a
plain message ("Konfigurationen innehåller fel: …") instead of a broken game.

---

## 5. Multiple classes per word

The design only shows single-class words. The rule set below extends it while
keeping the same buttons and flow.

### 5.1 What counts as correct

Two modes, chosen with `settings.multiClass.mode` (or `?lage=` in the URL):

**`"any"` (default)** – Any of the word's classes is a correct answer.

- Tapping a correct class solves the word immediately, as for single-class
  words (green card, ✓, timer stops, advance after `advanceDelayMs`).
- The other correct class(es) get a thin green outline and a ✓ but stay
  un-filled, so the player sees they would also have been right.
- Status line: *"Rätt! ”bär” är ett verb – men kan också vara ett substantiv."*
- If the word has `examples`, one sentence per class is shown under the status
  line on the correct state. Because there is more to read, the advance delay
  is doubled for multi-class words (configurable later if needed).

Why default: it keeps the speed game fair (a correct tap is never "wrong") and
still teaches that words can have several classes.

**`"all"`** – The player must find every class of the word.

- First correct tap: that card turns green with ✓ and is disabled; the timer
  keeps running. Status: *"Rätt! ”bär” är ett verb. Det finns en ordklass till
  – hitta den!"*
- Wrong taps behave as in the design (red card, ✕, disabled, miss counted).
- When the last correct class is found the word is solved: all its cards green,
  status *"Rätt! ”bär” kan vara både ett substantiv och ett verb."*, examples
  shown, advance.
- The player is told in advance: a small badge "2 ordklasser" appears under
  the word for multi-class words in this mode, so the game never feels like a
  trick.

### 5.2 Inactive classes

If a word's classes include a class that isn't in `activeClasses` (e.g. a
teacher plays with only substantiv + verb), that class is ignored for that
round. A word is playable only if at least one of its classes is active. In
`"all"` mode only the active classes must be found. If that leaves a single
class, the word plays as a normal single-class word.

### 5.3 Round building

`round.js` builds a round of `n` words from the playable pool:

1. Split playable words into single-class words (bucketed by class) and
   multi-class words.
2. Pick `k = min(maxPerRound, multiClassAvailable, floor(n / 4))` multi-class
   words at random.
3. Fill the remaining `n − k` slots evenly across active classes from the
   single-class buckets (as the prototype does: `floor` per class, remainder
   at random from classes with words left).
4. Shuffle. Never place the same word twice in a round. Avoid putting two
   multi-class words back to back.

The random source is injectable (`round(pool, n, rng)`) so tests are
deterministic.

### 5.4 Result screen

- History tiles: tile color = tint of the first correct class the player
  picked; meta text lists all classes: *"substantiv/verb · 2,1 s"*.
- A multi-class tile gets a small two-dot marker in the corner (both class
  colors), so they stand out in the grid.
- The red "fel först" border keeps its meaning (any wrong tap on that word).

---

## 6. Initial word bank

All words chosen for early-school readers: common, concrete, present-tense
verbs, base-form adjectives. Words that are commonly another class too (e.g.
*cyklar* is also a plural noun, *kall* also a noun) are avoided in the
single-class lists.

**Substantiv (20):** hund, katt, bil, hus, stol, boll, äpple, fönster, träd,
cykel, lampa, gurka, mössa, säng, tröja, banan, penna, fågel, skola, sko

**Verb (20):** springer, äter, sover, skriver, läser, simmar, sjunger, hoppar,
skrattar, dricker, leker, bygger, tänker, målar, städar, dansar, viskar,
kramar, letar, lyssnar

**Adjektiv (20):** röd, stor, liten, glad, snabb, mjuk, varm, trött, ledsen,
hungrig, blöt, tung, modig, gammal, sur, rolig, arg, tyst, smal, kall

**Multi-class (10):**

| Ord | Klasser | Exempel |
|---|---|---|
| bär | substantiv, verb | Vi plockar bär i skogen. / Hon bär en tung väska. |
| får | substantiv, verb | Bonden har tre får. / Jag får en present. |
| fika | substantiv, verb | Vi tar en fika. / Ska vi fika? |
| vila | substantiv, verb | Vi tar en kort vila. / Hunden vill vila. |
| dricka | substantiv, verb | Vi köper en dricka. / Jag vill dricka vatten. |
| kort | adjektiv, substantiv | Hon har kort hår. / Vi spelar kort. |
| ljus | adjektiv, substantiv | Himlen är ljus. / Vi tänder ett ljus. |
| fel | adjektiv, substantiv | Du tog fel buss. / Jag gjorde ett fel. |
| rätt | adjektiv, substantiv | Det är rätt svar. / Kocken lagar en god rätt. |
| lugn | adjektiv, substantiv | Sjön är lugn. / Det är ett skönt lugn. |

(*kall* stays a single-class adjektiv: the noun "ett kall" is too rare for the
audience. Changing that is a one-line edit in `words.json`.)

---

## 7. Screens and behavior (from the design)

One responsive page instead of separate desktop/mobile builds. Breakpoint at
**720 px**: below it the mobile artboards' layout applies.

### Tokens (`tokens.css`)

| Token | Value |
|---|---|
| `--bg` | `#F6F4EE` |
| `--ink` | `#17203A` |
| `--ink-muted` | `#4A5168` |
| `--line` | `#D9D6CC` / `#E4E1D8` |
| `--ruler` | `#F2C230` |
| `--right` | `#1E7F4F` |
| `--wrong` | `#B5321F`, tint `#FCE3DD` |
| class tints/deeps | from `classes.json`, set as CSS custom properties at boot |
| `--font-display` | Anton 400 |
| `--font-body` | DM Sans 400/500/700 |

### Start

- Kicker, title, subtitle.
- One card per active class (desktop: grid row; mobile: stacked rows) with
  name, big example word, description, and `moreExamples` chips.
- "starta" pill button, round info line, best time (if stored).
- With 4+ classes: desktop grid becomes 2×2 (or `auto-fit, minmax(260px,1fr)`).

### Quiz

- Top bar: Avsluta (icon-only on mobile), timer pill (`role="timer"`,
  tenths of a second, comma decimal), progress "Ord 3 av 10" / "3 / 10".
- Yellow ruler: one tick per word, labels every word when `n ≤ 12`, else every
  5th; the current word gets a tall dark tick.
- The word, large, `lang="sv"`.
- Status line (`role="status"`, `aria-live="polite"`) – idle / wrong / right
  texts from section 4.4.
- Choice buttons, one per active class: symbol circle, name, optional hint.
  Desktop: row of equal-width cards; mobile: full-width stacked buttons.
  States: neutral (class tint), wrong (red tint, ✕, disabled), right (green,
  ✓), dimmed (40% opacity after solve), "also right" outline (section 5.1).
- Keyboard: buttons are real `<button>`s; additionally keys `1…n` pick the
  n-th class (and the class `symbol` letter, e.g. S/V/A) – handled on the quiz
  container, not globally, and ignored while a modifier is pressed.

### Timing rules (same as prototype)

- Time counts only while an unsolved word is on screen; the pause after a
  correct answer is not counted.
- Total time = sum of per-word times. Wrong taps add no penalty other than the
  time they take.
- Timer display updates every 100 ms via `requestAnimationFrame` throttling;
  times are computed from `performance.now()` deltas, not tick counts.
- If the tab is hidden mid-word, the clock pauses and resumes on return (so a
  child switching apps isn't punished). *Not in the prototype; small addition.*

### Result

- Big total time "21,3 s", result line, misses line, best/record line.
- History grid (5 columns desktop, 2 columns mobile) with class tint, red
  border if missed first, multi-class marker.
- Legend, "spela igen" and "till start".

### Best time

Stored in `localStorage` under a key built from the round configuration
(`wordsPerRound`, sorted `activeClasses`, `multiClass.mode`), so a 10-word
round and a 20-word round don't compete. Wrapped in try/catch; if storage is
unavailable the best-time line is simply hidden.

---

## 8. Game logic (`game.js`)

A pure reducer, easy to test:

```
state = { screen, round[], index, picks[], solved, perWordMs[], misses, startedAt, … }
actions = START, PICK(classKey, now), ADVANCE(now), QUIT, PAUSE(now), RESUME(now)
```

- `PICK` decides wrong / correct / partially-correct (in `"all"` mode) using the
  word's active classes and the mode.
- `ADVANCE` moves to the next word or to `result`.
- The UI layer only dispatches actions, renders state, and owns the
  `setTimeout` for the advance delay.

---

## 9. Deployment to GitHub Pages

`.github/workflows/pages.yml`:

```yaml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run validate
      - run: npm test
      - run: npm run test:design
      - if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: design-diff
          path: test-results/

  deploy:
    if: github.event_name != 'pull_request'
    needs: check
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/configure-pages@v5
      - uses: actions/upload-pages-artifact@v3
        with: { path: site }
      - id: deployment
        uses: actions/deploy-pages@v4
```

- Pull requests run validation, unit tests and design checks; pushes to
  `main` also deploy. Nothing deploys unless all three pass.
- On a design-check failure, the diff images (expected / actual / diff) are
  uploaded as a workflow artifact so the mismatch can be seen.
- **One-time manual step:** in the repo's *Settings → Pages*, set *Source* to
  **GitHub Actions**.
- Site URL: `https://magnusnordin.github.io/ordklasser/`. All asset and config
  paths are relative (`./config/words.json`) so the `/ordklasser/` sub-path
  works without configuration.
- Config is fetched with a cache-busting query (`?v=<commit sha>` injected into
  `index.html` by the workflow with `sed`), so word-list edits show up
  immediately after deploy.

---

## 10. Quality gates: unit tests and design verification

Every milestone in section 11 must ship with **(a)** a full unit test suite
for everything it adds and **(b)** an automated check that what it adds matches
the design. Both run in CI on every PR; a milestone isn't done and nothing
deploys until both pass. Checks from earlier milestones keep running, so later
work can't silently break what was already verified.

### 10.1 Unit tests

- One test file per source module in `tests/unit/`, written in the same PR as
  the module.
- Pure modules (`config`, `round`, `game`, `format`, `storage`) are tested
  directly. UI modules are tested in `jsdom`: render a state, assert on the
  DOM (texts, `data-state` attributes, disabled buttons, ARIA attributes) and
  simulate clicks/keys.
- Randomness and time are always injected (`rng`, `now`), never read
  globally, so every test is deterministic.
- **Coverage is enforced** with Node's built-in coverage:
  `node --test --experimental-test-coverage --test-coverage-include='site/src/**'
  --test-coverage-lines=95 --test-coverage-branches=90 --test-coverage-functions=95`.
  Dropping below fails CI.
- "Full set" means, for every function: the normal case, each branch, each
  boundary (min/max values, empty lists, first/last word), and each error
  path. Each milestone below lists its required cases explicitly.

### 10.2 The design as test data

The design is turned into files in the repo once (milestone 1), so it can be
checked by machines instead of by eye:

- **`design/source/`** – the canvas's 10 artboards (`Main`, `Quiz`, `Wrong`,
  `Correct`, `Result` and the 5 `Mobile*` variants) exported as `.dc.html`.
- **`design/reference/`** – one PNG per artboard at its exact size
  (1024×768 desktop, 390×844 mobile), rendered by `scripts/capture-design.mjs`
  in the same headless Chromium that runs the tests, so fonts and
  anti-aliasing match. (If the design runtime can't be run headless, the PNGs
  are exported from the canvas instead and the visual tolerance is raised; the
  spec checks below still hold the exact values.)
- **`design/spec.json`** – the measurable values per screen and viewport,
  collected by the capture script from the rendered design and reviewed once:
  for each key element (title, start button, class cards, timer pill, ruler,
  word, status line, choice buttons, result time, history tiles, buttons) its
  bounding box, background, text color, font family/size/weight, border radius
  and text content.

App elements that correspond to a spec entry carry a matching
`data-testid` (`start-button`, `choice-verb`, `timer`, `word`, …).

### 10.3 Design fixture mode

The design shows fixed example states. The app gets a fixture mode that
reproduces them exactly, used only by tests:

`index.html?demo=start|quiz|wrong|correct|result` with the design's demo data:
round *hund, glad, skriver, springer, äpple, mjuk, sover, fönster, trött,
bygger*, current word *springer* ("Ord 4 av 10", timer "8,6 s"); wrong state
has *substantiv* picked; result shows "23,4 s", "Felklick på vägen: 3",
"Bästa tid: 21,3 s".

Design tests also load a pinned **design fixture config**
(`tests/fixtures/design-config/`, intercepted by Playwright) with exactly the
design's three classes, texts and settings. Editing the real word list later
therefore never breaks a design test.

### 10.4 Design checks (Playwright, `tests/design/`)

| Check | What it does | Tolerance |
|---|---|---|
| **Visual** (`visual.spec.mjs`) | Screenshot of each demo state at 1024×768 and 390×844, compared with the matching reference PNG. | ≤ 1 % differing pixels, per-pixel threshold 0.2 |
| **Spec values** (`spec-values.spec.mjs`) | For each `spec.json` entry: bounding box, computed colors, font, radius and text of the matching `data-testid`. | Position/size ± 2 px; colors, fonts and text exact |
| **Behavior** (`flow.spec.mjs`) | Plays rounds with a fixed seed and checks the transitions the prototype has: wrong pick → red card, ✕, disabled, status text; right pick → green, ✓, others dimmed, next word after 700 ms; last word → result; "spela igen" / "till start" / "Avsluta". | Exact texts and states |
| **Accessibility** (`a11y.spec.mjs`) | axe-core on every screen; a keyboard-only round; focus visible. | 0 serious/critical violations |
| **Responsive** | No horizontal scroll at 320, 360, 390, 720, 1024 and 1440 px wide. | None allowed |

On failure, CI uploads expected / actual / diff images (section 9).

### 10.5 Behavior parity with the prototype

The prototype's game logic lives in `design/source/Main.dc.html`. A unit test
(`tests/unit/parity.test.mjs`) loads that script in a Node `vm` with a small
stub for its base class and runs the same inputs through both the prototype
and our `game.js`/`format.js`: time formatting, ruler ticks and labels
(every word up to 12, every 5th above), status texts, round balancing, result
lines and best-time logic. Any difference fails the test.

### 10.6 What has no design yet

The multi-class feature isn't in the design. Before it is built (milestone 6),
its states are first drawn as new artboards in the Ordklasser canvas, using
the existing colors and type, and approved by you. After approval they are
exported into `design/source/` and `design/reference/` like the rest and
verified the same way.

---

## 11. Milestones

Each milestone is one PR. Each lists its scope, its required unit tests, how
it is verified against the design, and when it is done.

### Milestone 1 – Skeleton, deploy and test harness

**Scope:** `site/index.html` with the design's background and fonts,
`tokens.css`, `package.json`, `playwright.config.mjs`, the Pages workflow,
`design/` (sources, reference PNGs, `spec.json`), `capture-design.mjs`,
fixture mode stub.

**Unit tests:**
- `tokens.test.mjs`: every color, font and radius token in `tokens.css`
  equals the value in `spec.json`.
- `design-assets.test.mjs`: all 10 reference PNGs exist with the right pixel
  size; every `spec.json` entry has the required fields; every
  `design/source` artboard has a reference.
- Coverage thresholds wired up and passing.

**Design verification:** page background, text color and loaded font
families match the spec at both viewports; responsive no-scroll check.

**Done when:** the Pages URL shows the page, and CI runs validate → unit →
design and fails if any of them fail (proven by a deliberately broken commit
on a test branch).

### Milestone 2 – Configuration and validation

**Scope:** the four config files with the full word bank, `config.js`
loader/normalizer, `validate-config.mjs`, in-page error message.

**Unit tests (`config.test.mjs`):**
- Valid config loads; short form `{ "word", "classes": ["x"] }` and long form
  normalize to the same result.
- One failing fixture per error rule in section 4.5 (duplicate word,
  case-insensitive duplicate, unknown class, empty classes, fewer than 2
  active classes, `wordsPerRound` out of range, too few words, missing
  placeholder, bad color, invalid JSON) – each asserts the exact message.
- Each warning rule produces its warning and does not fail.
- The real config in `site/config/` passes with zero errors.
- URL overrides: valid values applied, out-of-range values clamped, unknown
  classes ignored, overrides off when `allowUrlOverrides` is false.

**Design verification:** `content.test.mjs` checks that the design fixture
config's class names, symbols, hints, descriptions, examples, colors and all
UI texts are identical to the strings and values in `design/source`. Visual
check: the in-page config-error message uses design tokens only.

**Done when:** a deliberate typo in `words.json` fails CI with a clear
message naming the file and word.

### Milestone 3 – Game logic

**Scope:** `round.js`, `game.js`, `format.js`, `storage.js` (no UI).

**Unit tests:**
- `round.test.mjs`: correct length for every size 3–30; no duplicate words;
  balanced across classes (each class gets ⌊n/k⌋ or more); remainder handled;
  multi-class cap respected, including cap 0; no two multi-class words in a
  row; inactive classes filtered; word with only inactive classes excluded;
  deterministic with a seeded `rng`; throws a clear error when the pool is too
  small.
- `game.test.mjs`: every action in every screen (including invalid ones, which
  leave state unchanged); `PICK` wrong / right / repeated wrong / pick after
  solved; time excludes the advance pause; `PAUSE`/`RESUME` excludes hidden
  time; misses counted; history entries; last word → result; record vs.
  non-record; `"any"` and `"all"` modes for multi-class words; inactive class
  in `"all"` mode.
- `format.test.mjs`: `0 → "0,0"`, rounding (`2649 → "2,6"`, `2650 → "2,7"`),
  large values; article/negation for "ett" and "en"; Swedish list joining for
  1, 2 and 3+ items; template filling and missing placeholders.
- `storage.test.mjs`: key depends on round size, classes (order-independent)
  and mode; read/write; storage throwing or missing → no crash, returns null.
- `parity.test.mjs`: section 10.5.

**Design verification:** the parity test (prototype vs. our logic) plus the
fixture-mode data producing exactly the design's numbers (8,6 s, 23,4 s,
3 misses, 21,3 s best).

**Done when:** coverage thresholds pass and parity has zero differences.

### Milestone 4 – Desktop UI: start, quiz, result

**Scope:** `ui/start.js`, `ui/quiz.js`, `ui/result.js`, `app.css` for ≥ 720 px.

**Unit tests (jsdom):**
- `ui-start.test.mjs`: one card per active class with name, example,
  description and chips; round info text; best time shown only when stored;
  start button dispatches `START`.
- `ui-quiz.test.mjs`: word, progress and timer texts; ruler tick count, tall
  current tick, labels every word / every 5th; each choice button state
  (neutral, wrong, right, dimmed) via `data-state` and `disabled`; hints
  shown/hidden by setting; status text and `role="status"`; Avsluta
  dispatches `QUIT`; advance timer scheduled once and cleared on quit.
- `ui-result.test.mjs`: total time, result line, misses line (zero and
  non-zero), record vs. best line vs. none; one history tile per word with
  correct class tint and missed border; both buttons dispatch the right action.

**Design verification:** visual + spec-values checks for the 5 desktop
artboards (start, quiz, wrong, correct, result); behavior flow; axe.

**Done when:** all 5 desktop states pass visual (≤ 1 %) and spec (± 2 px)
checks.

### Milestone 5 – Mobile layout

**Scope:** responsive CSS below 720 px; icon-only Avsluta; short progress
text.

**Unit tests:** jsdom tests for the mobile-only markup differences (icon-only
quit button has `aria-label="Avsluta"`, short progress "4 / 10", layout class
switched by the breakpoint helper).

**Design verification:** visual + spec-values checks for the 5 mobile
artboards at 390×844; desktop checks still pass; no horizontal scroll at all
widths in 10.4.

**Done when:** all 10 artboards pass.

### Milestone 6 – Multi-class words in the UI

**Scope:** first, new artboards in the Ordklasser canvas for: correct with
"also right" outline and example sentences (`any` mode), the "2 ordklasser"
badge and first-of-two found (`all` mode), and a result tile with the
multi-class marker – desktop and mobile. After your approval: export to
`design/`, then build.

**Unit tests:** jsdom tests for every new state and text: "also right"
outline on the other classes, example sentences per class, badge shown only
in `all` mode, partial-solve state keeps the timer running, final state lists
all classes, result tile meta "substantiv/verb · 2,1 s" and marker; longer
advance delay for multi-class words.

**Design verification:** visual + spec checks for the new approved artboards
(fixture states `?demo=multi-any`, `multi-all-partial`, `multi-all-done`,
`multi-result`); all 10 original artboards still pass unchanged.

**Done when:** new and old artboards all pass, and you've approved the new
artboards.

### Milestone 7 – Polish

**Scope:** keyboard shortcuts, pause on hidden tab, URL overrides in the UI,
`prefers-reduced-motion`, focus styles, README "how to add words and
classes".

**Unit tests:** number and letter keys pick the right class, ignored with
modifiers or outside the quiz; `visibilitychange` dispatches
`PAUSE`/`RESUME`; overrides reach the round; reduced motion removes
transitions (class toggled); a 4-class fixture config renders 4 cards and
4 buttons.

**Design verification:** full suite still passes; focus ring screenshots at
both viewports; with a 4-class fixture, layout follows the design's spacing
and colors (spec checks on gaps and radii) and nothing overflows.

**Done when:** full suite green and the README instructions are followed
once end-to-end to add a word, with CI passing.

---

## 12. Open questions

These have defaults in this plan; change them any time.

1. **Default multi-class mode** – plan uses `"any"`. `"all"` is more
   educational but slower; could be the default for older kids.
2. **Multi-class share** – plan caps at 2 per 10-word round.
3. **Language of config keys** – plan uses English keys with Swedish values.
   Could switch to Swedish keys (`ord`, `ordklasser`) if the people editing
   the lists prefer that.
4. **Custom domain** – none planned; can be added later with a `CNAME` file.
