// Text formatting: times, Swedish articles/negation, lists and templates.

// 2649 → "2,6", 2650 → "2,7" (tenths of a second, comma decimal).
export function formatTime(ms) {
  const tenths = Math.round((ms || 0) / 100);
  return (tenths / 10).toFixed(1).replace('.', ',');
}

// "ett" → "inget", "en" → "ingen".
export function negation(article) {
  return article === 'en' ? 'ingen' : 'inget';
}

// "ett verb"
export function withArticle(cls) {
  return cls.article + ' ' + cls.name;
}

// ["a"] → "a", ["a","b"] → "a och b", ["a","b","c"] → "a, b och c".
export function joinList(items) {
  if (items.length <= 1) return items.join('');
  return items.slice(0, -1).join(', ') + ' och ' + items[items.length - 1];
}

// Placeholders used in a template: "{n} ord" → ["n"].
export function placeholders(template) {
  return Array.from(template.matchAll(/\{(\w+)\}/g), (m) => m[1]);
}

// fill("{n} ord", { n: 10 }) → "10 ord". Throws on a missing value.
export function fill(template, params) {
  return template.replace(/\{(\w+)\}/g, (_, key) => {
    if (!(key in params)) throw new Error(`Saknar värde för {${key}} i "${template}"`);
    return String(params[key]);
  });
}
