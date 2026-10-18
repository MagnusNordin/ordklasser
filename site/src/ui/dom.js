// Small DOM helpers shared by the screens.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ESC[c]);
}

// Inline CSS custom properties for a class's colors.
export function classVars(cls) {
  return `--tint:${cls.colors.tint};--deep:${cls.colors.deep}`;
}

export const ICONS = {
  arrow: '<svg aria-hidden="true" class="icon-arrow" width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"></path></svg>',
  close: '<svg aria-hidden="true" class="icon-close" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>',
  clock: '<svg aria-hidden="true" class="icon-clock" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8"></circle><path d="M12 9v4l2.5 2.5M10 2h4"></path></svg>',
  check: '<svg aria-hidden="true" class="icon-check" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1E7F4F" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"></path></svg>',
  cross: '<svg aria-hidden="true" class="icon-cross" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"></path></svg>'
};

// Shrinks an element's font size until its text fits its box (long words on
// narrow screens). No-op where there is no layout (jsdom).
export function fitText(el, minPx = 28) {
  const view = el.ownerDocument.defaultView;
  if (!el.clientWidth || !view?.getComputedStyle) return;
  el.style.fontSize = '';
  let size = parseFloat(view.getComputedStyle(el).fontSize);
  while (el.scrollWidth > el.clientWidth + 1 && size > minPx) {
    size -= 2;
    el.style.fontSize = size + 'px';
  }
}
