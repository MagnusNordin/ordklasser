// Best time per round configuration, in localStorage. Every access is
// guarded: without storage the game works and simply shows no best time.

export function bestKey({ wordsPerRound, activeClasses, mode }) {
  return `ordklasser:best:${wordsPerRound}:${[...activeClasses].sort().join(',')}:${mode}`;
}

// `getStorage` returns a Storage-like object; it may throw (blocked storage).
export function createBestStore(getStorage) {
  const store = () => {
    try { return getStorage() || null; } catch { return null; }
  };
  return {
    read(round) {
      try {
        const raw = store()?.getItem(bestKey(round));
        const ms = raw == null ? NaN : Number(raw);
        return Number.isFinite(ms) && ms > 0 ? ms : null;
      } catch { return null; }
    },
    write(round, ms) {
      const s = store();
      if (!s) return false;
      try { s.setItem(bestKey(round), String(Math.round(ms))); return true; } catch { return false; }
    }
  };
}
