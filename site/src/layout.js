// Breakpoint and motion preferences. The CSS uses the same media queries.

export const MOBILE_QUERY = '(max-width: 719.98px)';
export const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)';

export function matches(win, query) {
  return Boolean(win.matchMedia?.(query).matches);
}

// Calls cb(matches) whenever the query flips. Returns an unsubscribe function.
export function watch(win, query, cb) {
  const mql = win.matchMedia?.(query);
  if (!mql?.addEventListener) return () => {};
  const listener = (e) => cb(e.matches);
  mql.addEventListener('change', listener);
  return () => mql.removeEventListener('change', listener);
}
