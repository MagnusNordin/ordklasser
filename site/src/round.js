// Builds a balanced round of words. Pure; randomness is injected.

// Seeded random source (mulberry32), returns floats in [0, 1).
export function seededRng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Words that can be played with these classes, their classes narrowed to the
// active ones (in activeClasses order).
export function playable(words, activeClasses) {
  const out = [];
  for (const w of words) {
    const classes = activeClasses.filter((c) => w.classes.includes(c));
    if (classes.length) out.push({ ...w, classes });
  }
  return out;
}

// round(words, n, rng, { activeClasses, maxMulti }) → n round items
// ({ word, classes, examples }), no repeats, balanced across classes, at most
// min(maxMulti, floor(n / 4)) multi-class words, never two of those in a row.
export function buildRound(words, n, rng, { activeClasses, maxMulti = 0 }) {
  const pool = playable(words, activeClasses);
  if (pool.length < n) {
    throw new Error(`Ordbanken räcker inte: rundan behöver ${n} ord men bara ${pool.length} går att spela.`);
  }
  const buckets = Object.fromEntries(activeClasses.map((c) => [c, []]));
  let multi = [];
  for (const w of pool) {
    if (w.classes.length > 1) multi.push(w);
    else buckets[w.classes[0]].push(w);
  }
  multi = shuffle(multi, rng);
  for (const c of activeClasses) buckets[c] = shuffle(buckets[c], rng);

  const k = Math.min(maxMulti, multi.length, Math.floor(n / 4));
  const picked = multi.slice(0, k);
  const spare = multi.slice(k);

  const singles = [];
  const per = Math.floor((n - k) / activeClasses.length);
  for (const c of activeClasses) singles.push(...buckets[c].splice(0, per));
  while (singles.length < n - k) {
    const left = activeClasses.filter((c) => buckets[c].length);
    if (!left.length) break;
    const c = left[Math.floor(rng() * left.length)];
    singles.push(buckets[c].pop());
  }
  // Pool too unbalanced to fill with single-class words: use spare multi ones
  // rather than fail (the validator warns about this situation).
  while (singles.length + picked.length < n) picked.push(spare.shift());

  // Put each multi-class word in its own gap between single-class words
  // (any that don't fit, only possible with a lopsided pool, go last).
  const order = shuffle(singles, rng);
  const gaps = shuffle(Array.from({ length: order.length + 1 }, (_, i) => i), rng)
    .slice(0, picked.length)
    .sort((a, b) => b - a);
  gaps.forEach((g, i) => order.splice(g, 0, picked[i]));
  order.push(...picked.slice(gaps.length));
  return order.map((w) => ({ word: w.word, classes: w.classes, examples: w.examples || {} }));
}
