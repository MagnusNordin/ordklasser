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
| Tests | `node:test` (built into Node 20+), no dependencies | Pure game logic is unit-tested in CI without `npm install`. |
| Config validation | `scripts/validate-config.mjs` run in CI | A typo in the word list fails the deploy instead of breaking the live game. |
| Deploy | GitHub Actions → `actions/deploy-pages` | Official Pages flow; deploys only after validation and tests pass. |
| Fonts | Google Fonts: Bricolage Grotesque (display), Atkinson Hyperlegible (body) | As in the design. |
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
├─ scripts/
│  └─ validate-config.mjs
├─ tests/
│  ├─ round.test.mjs
│  ├─ game.test.mjs
│  ├─ format.test.mjs
│  └─ config.test.mjs            ← runs the validator on the real config
├─ .github/workflows/pages.yml
├─ docs/PLAN.md                  ← this file
└─ README.md                     ← how to run locally and edit words
```

`game.js`, `round.js`, `format.js` and the validation part of `config.js` are
pure functions so they can be imported both by the browser and by Node tests.

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
| `--font-display` | Bricolage Grotesque 600–800 |
| `--font-body` | Atkinson Hyperlegible 400/700 |

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
        with: { node-version: 22 }
      - run: node scripts/validate-config.mjs
      - run: node --test tests/

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

- Pull requests run validation and tests only; pushes to `main` also deploy.
- **One-time manual step:** in the repo's *Settings → Pages*, set *Source* to
  **GitHub Actions**.
- Site URL: `https://magnusnordin.github.io/ordklasser/`. All asset and config
  paths are relative (`./config/words.json`) so the `/ordklasser/` sub-path
  works without configuration.
- Config is fetched with a cache-busting query (`?v=<commit sha>` injected into
  `index.html` by the workflow with `sed`), so word-list edits show up
  immediately after deploy.

---

## 10. Milestones

Each milestone is a separate PR with a working deploy.

1. **Skeleton + deploy** – `site/index.html` placeholder, workflow,
   validator stub, empty test run. *Done when:* the Pages URL shows the page.
2. **Config + validation** – the four config files with the full word bank,
   loader, validator with all rules, tests. *Done when:* a deliberate typo in
   `words.json` fails CI with a clear message.
3. **Game logic** – `round.js`, `game.js`, `format.js` with unit tests,
   including multi-class in both modes. *Done when:* tests cover balanced
   rounds, any/all mode, inactive classes, timing, best time.
4. **UI: start + quiz + result (desktop)** – matches the desktop artboards.
5. **Responsive mobile layout** – matches the mobile artboards at 390 px;
   no horizontal scroll down to 320 px.
6. **Multi-class UI** – "also right" outline, examples, "2 ordklasser" badge,
   result tile marker.
7. **Polish** – keyboard shortcuts, pause on hidden tab, URL overrides,
   `prefers-reduced-motion`, accessibility pass (contrast, focus rings,
   screen-reader texts), README with "how to add words".

---

## 11. Testing

- **Unit (CI):** round balance and uniqueness; multi-class cap; inactive-class
  filtering; `PICK` outcomes in both modes; time accumulation excluding the
  advance pause and hidden time; Swedish formatting (`2,7`, "ett … och ett …",
  "inget"/"ingen"); best-time keying.
- **Config (CI):** validator passes on the real config; fails on fixture
  configs with each error type.
- **Manual before each UI milestone:** Chrome + Safari on desktop, iOS Safari
  and Android Chrome on phone; a full round in each mode; keyboard-only round;
  VoiceOver reads word, status and button states.

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
