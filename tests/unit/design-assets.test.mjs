// The design reference files are complete and consistent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { PNG } from 'pngjs';
import { ARTBOARDS, STATES, TARGETS, VIEWPORTS } from '../../scripts/spec-targets.mjs';
import { ROOT, readJson } from './helpers.mjs';

const spec = readJson('design/spec.json');
const canvas = readJson('design/source/canvas.json');
const FIELDS = ['box', 'background', 'color', 'fontFamily', 'fontSize', 'fontWeight', 'radius', 'border', 'opacity', 'text'];

test('all 10 reference PNGs exist with the artboard pixel size', () => {
  let count = 0;
  for (const [vp, boards] of Object.entries(ARTBOARDS)) {
    for (const name of Object.values(boards)) {
      const file = `${ROOT}design/reference/${name}.png`;
      assert.ok(existsSync(file), file);
      const png = PNG.sync.read(readFileSync(file));
      assert.deepEqual([png.width, png.height], [VIEWPORTS[vp].width, VIEWPORTS[vp].height], name);
      count++;
    }
  }
  assert.equal(count, 10);
});

test('every design/source artboard has a reference and matches the canvas index', () => {
  const sources = readdirSync(ROOT + 'design/source').filter((f) => f.endsWith('.dc.html'));
  assert.equal(sources.length, 10);
  assert.deepEqual(sources.sort(), Object.keys(canvas.boards).sort());
  for (const f of sources) {
    const name = f.replace('.dc.html', '');
    assert.ok(existsSync(`${ROOT}design/reference/${name}.png`), `${name}.png`);
    const board = canvas.boards[f];
    const isMobile = name.startsWith('Mobile');
    assert.deepEqual([board.w, board.h], isMobile ? [390, 844] : [1024, 768], f);
  }
});

test('spec.json has every screen, viewport and target with all fields', () => {
  assert.deepEqual(spec.viewports, VIEWPORTS);
  for (const vp of Object.keys(VIEWPORTS)) {
    for (const state of STATES) {
      const screen = spec.screens[vp][state];
      assert.equal(screen.artboard, ARTBOARDS[vp][state]);
      assert.deepEqual(Object.keys(screen.elements).sort(), [...TARGETS[state]].sort(), `${vp} ${state}`);
      for (const [name, el] of Object.entries(screen.elements)) {
        for (const f of FIELDS) assert.ok(f in el, `${vp} ${state} ${name}.${f}`);
        for (const k of ['x', 'y', 'w', 'h']) assert.equal(typeof el.box[k], 'number');
        assert.ok(el.box.w > 0 && el.box.h > 0, `${vp} ${state} ${name} has a size`);
      }
    }
  }
  for (const group of ['colors', 'fonts', 'radii']) assert.ok(Object.keys(spec.tokens[group]).length > 0, group);
});

test('the app root covers the artboard at both viewports', () => {
  for (const vp of Object.keys(VIEWPORTS)) {
    const app = spec.screens[vp].start.elements.app;
    assert.deepEqual(app.box, { x: 0, y: 0, w: VIEWPORTS[vp].width, h: VIEWPORTS[vp].height });
  }
});
