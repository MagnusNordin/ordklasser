import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';
import { validateConfig } from '../../site/src/config.js';

export const ROOT = fileURLToPath(new URL('../../', import.meta.url));

export function readJson(path) {
  return JSON.parse(readFileSync(ROOT + path, 'utf8'));
}

// Parsed config files from a directory (relative to the repo root).
export function rawConfig(dir = 'site/config') {
  return {
    settings: readJson(`${dir}/settings.json`),
    classes: readJson(`${dir}/classes.json`),
    words: readJson(`${dir}/words.json`),
    texts: readJson(`${dir}/texts.sv.json`)
  };
}

export function loadConfig(dir) {
  const result = validateConfig(rawConfig(dir));
  if (result.errors.length) throw new Error(result.errors.join('\n'));
  return result.config;
}

export const designConfig = () => loadConfig('tests/fixtures/design-config');
export const realConfig = () => loadConfig('site/config');

// A jsdom window with an #app root; matchMedia answers `mobile`.
export function makeDom({ mobile = false, reducedMotion = false, url = 'http://localhost/' } = {}) {
  const dom = new JSDOM('<!doctype html><html lang="sv"><head><meta name="version" content="test"></head><body><main id="app" class="app" data-testid="app"></main></body></html>', { url });
  const win = dom.window;
  const listeners = {};
  win.matchMedia = (q) => ({
    matches: q.includes('max-width') ? mobile : q.includes('reduced-motion') ? reducedMotion : false,
    addEventListener: (_, fn) => { listeners[q] = fn; },
    removeEventListener: () => { delete listeners[q]; }
  });
  return { win, doc: win.document, root: win.document.getElementById('app'), mediaListeners: listeners };
}

export function click(el) {
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true }));
}

export function key(el, k, mods = {}) {
  const ev = new el.ownerDocument.defaultView.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...mods });
  el.dispatchEvent(ev);
  return ev;
}

// The prototype's component class from design/source/Main.dc.html, runnable
// in Node: new Proto(props) → .renderVals(), .state, .setState().
export function loadPrototype(file = 'design/source/Main.dc.html', { random = Math.random, now = () => 0 } = {}) {
  const html = readFileSync(ROOT + file, 'utf8');
  const src = html.match(/<script type="text\/x-dc" data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
  const sandbox = {
    Math: Object.assign(Object.create(Math), { random }),
    Date: { now },
    setInterval: () => 1,
    clearInterval: () => {},
    setTimeout: () => 1,
    clearTimeout: () => {}
  };
  vm.createContext(sandbox);
  return vm.runInContext(`
    class DCLogic {
      constructor(props) { this.props = props; this.state = null; }
      setState(patch) { this.state = Object.assign({}, this.state, patch); }
    }
    ${src}
    Component;`, sandbox);
}
