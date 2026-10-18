// Shared between capture-design.mjs (measuring the design) and the
// spec-values design test (measuring the app).

export const VIEWPORTS = {
  desktop: { width: 1024, height: 768 },
  mobile: { width: 390, height: 844 }
};

// Fixture states in the order of the canvas's artboards.
export const STATES = ['start', 'quiz', 'wrong', 'correct', 'result'];

export const ARTBOARDS = {
  desktop: { start: 'Main', quiz: 'Quiz', wrong: 'Wrong', correct: 'Correct', result: 'Result' },
  mobile: { start: 'MobileMain', quiz: 'MobileQuiz', wrong: 'MobileWrong', correct: 'MobileCorrect', result: 'MobileResult' }
};

const QUIZ = ['quit-button', 'timer', 'progress', 'ruler', 'question', 'word', 'status',
  'choice-substantiv', 'choice-verb', 'choice-adjektiv'];

// The data-testid values checked on each screen.
export const TARGETS = {
  start: ['app', 'kicker', 'title', 'subtitle', 'card-substantiv', 'card-verb', 'card-adjektiv',
    'start-button', 'round-info'],
  quiz: ['app', ...QUIZ],
  wrong: ['app', ...QUIZ],
  correct: ['app', ...QUIZ],
  result: ['app', 'result-kicker', 'result-time', 'result-line', 'miss-line', 'best-line',
    'history', 'tile-0', 'tile-1', 'legend', 'play-again', 'to-start']
};

// Browser-side: reads the measurable values of one element.
export function measureElement(el) {
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);
  return {
    box: { x: Math.round(r.x * 10) / 10, y: Math.round(r.y * 10) / 10, w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 },
    background: cs.backgroundColor,
    color: cs.color,
    fontFamily: cs.fontFamily,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    radius: cs.borderTopLeftRadius,
    border: cs.borderTopWidth + ' ' + cs.borderTopColor,
    opacity: cs.opacity,
    text: el.innerText.replace(/\s+/g, ' ').trim()
  };
}

// Browser-side: finds each target in the rendered design (which has no
// data-testids). `names` is a TARGETS list; returns { name: element }.
export function locateInDesign(root, names) {
  const norm = (s) => s.replace(/\s+/g, ' ').trim();
  const all = Array.from(root.querySelectorAll('*'));
  const deepest = (test) => {
    const hits = all.filter((e) => test(norm(e.innerText || '')));
    return hits.find((e) => !hits.some((o) => o !== e && e.contains(o))) || null;
  };
  const is = (t) => deepest((s) => s === t);
  const starts = (t) => deepest((s) => s.startsWith(t));
  const button = (t) => Array.from(root.querySelectorAll('button')).find((b) => norm(b.innerText) === t);
  const timer = () => root.querySelector('[role=timer]');
  const find = {
    app: () => root,
    kicker: () => is('ORDKLASSER'),
    title: () => root.querySelector('h1'),
    subtitle: () => root.querySelector('h1').nextElementSibling,
    'card-substantiv': () => is('SUBSTANTIV').closest('div'),
    'card-verb': () => is('VERB').closest('div'),
    'card-adjektiv': () => is('ADJEKTIV').closest('div'),
    'start-button': () => root.querySelector('button'),
    'round-info': () => starts('10 ord per runda'),
    'quit-button': () => root.querySelector('button'),
    timer,
    progress: () => timer().nextElementSibling,
    ruler: () => timer().parentElement.nextElementSibling,
    question: () => is('VILKEN ORDKLASS?'),
    word: () => root.querySelector('div[lang=sv]'),
    status: () => root.querySelector('[role=status]'),
    'choice-substantiv': () => root.querySelector('button[aria-label^="substantiv"]'),
    'choice-verb': () => root.querySelector('button[aria-label^="verb"]'),
    'choice-adjektiv': () => root.querySelector('button[aria-label^="adjektiv"]'),
    'result-kicker': () => is('RESULTAT · ORDKLASSER'),
    'result-time': () => is('23,4'),
    'result-line': () => starts('Du klarade'),
    'miss-line': () => starts('Felklick'),
    'best-line': () => starts('Bästa tid'),
    'tile-0': () => is('hund').parentElement,
    'tile-1': () => is('glad').parentElement,
    history: () => is('hund').parentElement.parentElement,
    legend: () => is('rätt direkt').parentElement,
    'play-again': () => button('spela igen'),
    'to-start': () => button('till start')
  };
  const out = {};
  for (const n of names) out[n] = find[n]();
  return out;
}
