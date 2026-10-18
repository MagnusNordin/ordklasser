// Loads, normalizes and validates the JSON config in site/config/.
// validateConfig is pure and shared with scripts/validate-config.mjs.
import { placeholders } from './format.js';

export const CONFIG_FILES = {
  settings: 'settings.json',
  classes: 'classes.json',
  words: 'words.json',
  texts: 'texts.sv.json'
};

// Every text key the code uses, with the placeholders it fills in.
export const REQUIRED_TEXTS = {
  kicker: [], title: [], subtitle: [], start: [],
  roundInfo: ['n'], bestSoFar: ['time'],
  quit: [], timerLabel: [], question: [],
  progress: ['i', 'n'], progressShort: ['i', 'n'],
  promptIdle: [],
  promptWrong: ['word', 'neg', 'class'],
  promptRight: ['word', 'art', 'class'],
  promptRightAlso: ['word', 'art', 'class', 'others'],
  promptFoundOneMore: ['word', 'art', 'class'],
  promptFoundMore: ['word', 'art', 'class', 'n'],
  promptFoundAll: ['word', 'all'],
  ariaWrong: [], ariaRight: [], ariaAlso: [], badge: ['n'],
  resultKicker: [], resultLine: ['n', 'time'], seconds: [],
  noMisses: [], misses: ['n'], newRecord: ['time'], bestTime: ['time'],
  legendDirect: [], legendMissed: [], legendMulti: [],
  playAgain: [], toStart: [], configError: []
};

const SETTINGS_KEYS = ['wordsPerRound', 'minWordsPerRound', 'maxWordsPerRound', 'showHints',
  'activeClasses', 'advanceDelayMs', 'multiClass', 'allowUrlOverrides'];
const CLASS_KEYS = ['key', 'name', 'article', 'symbol', 'hint', 'description', 'example', 'moreExamples', 'colors'];
const HEX = /^#[0-9A-Fa-f]{6}$/;

function luminance(hex) {
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// { "word": "hund", "class": "substantiv" } and
// { "word": "hund", "classes": ["substantiv"] } both become the long form.
export function normalizeWord(entry) {
  const classes = Array.isArray(entry.classes) ? entry.classes : entry.class != null ? [entry.class] : [];
  return { word: typeof entry.word === 'string' ? entry.word.trim() : '', classes, examples: entry.examples || {} };
}

// raw = { settings, classes, words, texts } as parsed JSON.
// Returns { errors, warnings, config } (config is null when there are errors).
export function validateConfig(raw) {
  const errors = [];
  const warnings = [];
  const { settings, classes, words, texts } = raw;

  for (const k of SETTINGS_KEYS) if (settings?.[k] === undefined) errors.push(`settings.json: saknar "${k}"`);
  if (!Array.isArray(classes)) errors.push('classes.json: måste vara en lista med ordklasser');
  if (!Array.isArray(words?.words)) errors.push('words.json: måste ha en lista "words"');
  if (texts == null || typeof texts !== 'object') errors.push('texts.sv.json: måste vara ett objekt med texter');
  if (errors.length) return { errors, warnings, config: null };

  // classes
  const classMap = {};
  for (const [i, c] of classes.entries()) {
    const label = c?.key ? `"${c.key}"` : `nummer ${i + 1}`;
    const missing = CLASS_KEYS.filter((k) => c?.[k] === undefined);
    if (missing.length) { errors.push(`classes.json: ordklass ${label} saknar ${missing.map((k) => `"${k}"`).join(', ')}`); continue; }
    if (classMap[c.key]) errors.push(`classes.json: ordklassen "${c.key}" finns två gånger`);
    if (c.article !== 'en' && c.article !== 'ett') errors.push(`classes.json: "${c.key}" har article "${c.article}", ska vara "en" eller "ett"`);
    for (const which of ['tint', 'deep']) {
      if (!HEX.test(c.colors?.[which] ?? '')) errors.push(`classes.json: "${c.key}" har ogiltig färg ${which} "${c.colors?.[which]}" (ska vara #RRGGBB)`);
    }
    if (HEX.test(c.colors?.tint ?? '') && HEX.test(c.colors?.deep ?? '')) {
      const ratio = contrast(c.colors.tint, c.colors.deep);
      if (ratio < 4.5) warnings.push(`classes.json: "${c.key}" har för låg kontrast mellan deep och tint (${ratio.toFixed(1)}:1, minst 4.5:1)`);
    }
    classMap[c.key] = c;
  }

  // settings
  const active = settings.activeClasses;
  if (!Array.isArray(active)) errors.push('settings.json: "activeClasses" måste vara en lista');
  else {
    for (const k of active) if (!classMap[k]) errors.push(`settings.json: activeClasses innehåller okänd ordklass "${k}"`);
    if (active.length < 2) errors.push('settings.json: activeClasses måste ha minst 2 ordklasser');
  }
  const { wordsPerRound: n, minWordsPerRound: min, maxWordsPerRound: max } = settings;
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || min > max) {
    errors.push(`settings.json: minWordsPerRound (${min}) och maxWordsPerRound (${max}) måste vara heltal med min ≤ max`);
  } else if (!Number.isInteger(n) || n < min || n > max) {
    errors.push(`settings.json: wordsPerRound (${n}) måste ligga mellan ${min} och ${max}`);
  }
  const mode = settings.multiClass?.mode;
  if (mode !== 'any' && mode !== 'all') errors.push(`settings.json: multiClass.mode ("${mode}") måste vara "any" eller "all"`);
  if (!Number.isInteger(settings.multiClass?.maxPerRound) || settings.multiClass.maxPerRound < 0) {
    errors.push('settings.json: multiClass.maxPerRound måste vara ett heltal ≥ 0');
  }

  // words
  const seen = new Set();
  const list = [];
  for (const entry of words.words) {
    const w = normalizeWord(entry ?? {});
    if (!w.word) { errors.push(`words.json: ett ord saknar "word" (${JSON.stringify(entry)})`); continue; }
    const id = w.word.toLowerCase();
    if (seen.has(id)) errors.push(`words.json: ordet "${w.word}" finns två gånger`);
    seen.add(id);
    if (!w.classes.length) errors.push(`words.json: ordet "${w.word}" saknar ordklasser`);
    for (const k of w.classes) if (!classMap[k]) errors.push(`words.json: ordet "${w.word}" har okänd ordklass "${k}"`);
    if (w.classes.length > 1) {
      for (const k of w.classes) if (!w.examples[k]) warnings.push(`words.json: "${w.word}" saknar exempelmening för ${k}`);
    }
    list.push(w);
  }

  // texts
  for (const [key, needed] of Object.entries(REQUIRED_TEXTS)) {
    if (typeof texts[key] !== 'string') { errors.push(`texts.sv.json: texten "${key}" saknas`); continue; }
    const has = placeholders(texts[key]);
    for (const p of needed) if (!has.includes(p)) errors.push(`texts.sv.json: "${key}" saknar {${p}}`);
  }

  // enough words (only meaningful once the parts above are sound)
  if (!errors.length) {
    const usable = list.filter((w) => w.classes.some((k) => active.includes(k)));
    if (usable.length < max) {
      errors.push(`words.json: för få ord – maxWordsPerRound är ${max} men bara ${usable.length} ord går att spela`);
    }
    const need = Math.ceil(max / active.length);
    for (const k of active) {
      const count = usable.filter((w) => w.classes.length === 1 && w.classes[0] === k).length;
      if (count < need) warnings.push(`words.json: ${k} har ${count} ord med bara den ordklassen – minst ${need} behövs för jämna rundor`);
    }
  }

  if (errors.length) return { errors, warnings, config: null };
  return {
    errors,
    warnings,
    config: { settings: { ...settings, multiClass: { ...settings.multiClass } }, classes, classMap, words: list, texts }
  };
}

// Parses each file, naming the file in any error.
export function parseConfigFiles(sources) {
  const raw = {};
  const errors = [];
  for (const [part, file] of Object.entries(CONFIG_FILES)) {
    try { raw[part] = JSON.parse(sources[part]); } catch (e) { errors.push(`${file}: ogiltig JSON (${e.message})`); }
  }
  return { raw, errors };
}

// Fetches the four files relative to `base` and validates them.
export async function loadConfig(fetchFn, base, version) {
  const sources = {};
  const errors = [];
  await Promise.all(Object.entries(CONFIG_FILES).map(async ([part, file]) => {
    try {
      const res = await fetchFn(`${base}${file}?v=${encodeURIComponent(version)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      sources[part] = await res.text();
    } catch (e) {
      errors.push(`${file}: kunde inte hämtas (${e.message})`);
    }
  }));
  if (errors.length) return { errors, warnings: [], config: null };
  const parsed = parseConfigFiles(sources);
  if (parsed.errors.length) return { errors: parsed.errors, warnings: [], config: null };
  return validateConfig(parsed.raw);
}

// URL overrides for teachers: ?ord=20&klasser=substantiv,verb&tips=0&lage=all
export function applyOverrides(config, params) {
  const s = config.settings;
  if (!s.allowUrlOverrides) return config;
  const next = { ...s, multiClass: { ...s.multiClass } };
  const ord = params.get('ord');
  if (ord != null && /^\d+$/.test(ord.trim())) {
    next.wordsPerRound = Math.max(s.minWordsPerRound, Math.min(s.maxWordsPerRound, parseInt(ord, 10)));
  }
  const klasser = params.get('klasser');
  if (klasser != null) {
    const keys = [...new Set(klasser.split(',').map((k) => k.trim()).filter((k) => config.classMap[k]))];
    if (keys.length >= 2) next.activeClasses = keys;
  }
  const tips = params.get('tips');
  if (tips === '0' || tips === '1') next.showHints = tips === '1';
  const lage = params.get('lage');
  if (lage === 'any' || lage === 'all') next.multiClass.mode = lage;
  return { ...config, settings: next };
}
