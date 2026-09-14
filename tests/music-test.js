'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
// Load the module before any DOM stubs exist, purely for shape data
const T = require(__dirname + '/../game.js');

// --- DOM stub (same shape as smoke.js) ---
const ctxStub = new Proxy({}, {
  get(t, prop) {
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient')
      return () => ({ addColorStop() {} });
    if (prop === 'measureText') return () => ({ width: 10 });
    return () => undefined;
  },
  set() { return true; }
});
function makeEl() {
  return {
    id: '',
    style: { setProperty() {}, classList: { toggle() {} } },
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {}, removeEventListener() {},
    appendChild() {}, remove() {},
    textContent: '', innerHTML: '', hidden: false,
    value: '', checked: false,
    getContext: () => ctxStub,
    width: 320, height: 640, offsetWidth: 100
  };
}
const els = {};
let rafCb = null;
const listeners = { keydown: [], keyup: [], blur: [] };
global.window = {
  addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
  removeEventListener() {},
  innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
  requestAnimationFrame: cb => { rafCb = cb; return 1; }
};
global.document = {
  getElementById: id => els[id] || (els[id] = makeEl()),
  createElement: () => makeEl(),
  addEventListener() {},
  documentElement: { style: { setProperty() {} } },
  hidden: false
};
global.requestAnimationFrame = cb => { rafCb = cb; return 1; };

// --- localStorage stub ---
const ls = {};
global.localStorage = {
  getItem: k => (k in ls ? ls[k] : null),
  setItem: (k, v) => { ls[k] = String(v); }
};

// --- AudioContext stub capturing every scheduled note ---
const scheduled = [];
const AC = class {
  constructor() {
    AC.instances.push(this);
    this.currentTime = 0;
    this.state = 'running';
    this.destination = {};
  }
  createGain() {
    return {
      gain: { value: 0.5, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} },
      connect() {}
    };
  }
  createOscillator() {
    const o = {
      type: 'square', _f: 0, _t: 0,
      frequency: { setValueAtTime(f, t) { o._f = f; o._t = t; }, exponentialRampToValueAtTime() {} },
      connect() {},
      start() {},
      stop() { scheduled.push({ f: o._f, t: o._t, type: o.type }); }
    };
    return o;
  }
  resume() {}
};
AC.instances = [];
global.window.AudioContext = AC;

// track intervals so we can stop them before exiting
const origSetInterval = global.setInterval;
const intervals = [];
global.setInterval = (fn, ms) => {
  const id = origSetInterval(fn, ms);
  intervals.push(id);
  return id;
};

const raw = fs.readFileSync(__dirname + '/../game.js', 'utf8');
const src = raw.replace(/\}\s*$/, '  globalThis.__game = game;\n}');
vm.runInThisContext(src, { filename: 'game.js' });

const fire = (type, ev) => listeners[type].forEach(fn => fn(ev));
const key = (type, code) => fire(type, { code, repeat: false, preventDefault() {} });
let now = performance.now();
const step = ms => { now += ms; const cb = rafCb; rafCb = null; cb(now); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const MELODY_SET = new Set([659.25, 830.61, 987.77, 880, 1046.5, 1174.66, 1318.51, 1244.51, 1567.98, 1760]);
const BASS_SET = new Set([329.63, 220, 246.94, 261.63, 349.23]);
const melodyNotes = () => scheduled.filter(n => MELODY_SET.has(n.f) && n.type === 'square')
  .sort((a, b) => a.t - b.t);
const bassNotes = () => scheduled.filter(n => BASS_SET.has(n.f) && n.type === 'triangle')
  .sort((a, b) => a.t - b.t);
// SFX (clear/over etc.) use staggered real-time setTimeouts and would pollute
// raw counts, so "music" assertions only count melody + bass notes.
const musicCount = () => melodyNotes().length + bassNotes().length;

(async () => {
  const g = global.__game;
  key('keydown', 'Enter');
  assert.strictEqual(g.status(), 'playing', 'game starts');
  assert.ok(AC.instances.length === 1, 'audio context created');
  const actx = AC.instances[0];

  // --- 1. initial schedule: 1 melody note + 2 bass notes within 0.3s window ---
  let m = melodyNotes();
  let b = bassNotes();
  assert.strictEqual(m.length, 1, 'one melody note in first window, got ' + m.length);
  assert.strictEqual(m[0].f, 659.25, 'first note is E5');
  assert.strictEqual(b.length, 2, 'two bass eighths in first window, got ' + b.length);
  assert.strictEqual(b[0].f, 329.63, 'bass root is E4 (Em bar)');

  // --- 2. advance audio time, collect the melody prefix ---
  actx.currentTime += 2.0;
  await sleep(80);
  m = melodyNotes();
  assert.deepStrictEqual(
    m.map(n => n.f),
    [659.25, 830.61, 987.77, 830.61, 659.25, 880],
    'melody prefix matches Korobeiniki A-phrase'
  );
  const gaps1 = m.slice(1).map((n, i) => n.t - m[i].t);
  for (const gap of gaps1) {
    assert.ok(Math.abs(gap - 0.21) < 0.005 || Math.abs(gap - 0.42) < 0.005 || Math.abs(gap - 0.63) < 0.005,
      'L1 note gap ' + gap.toFixed(3) + ' is a whole-beat multiple of 0.42');
  }

  // --- 3. clear 10+ lines -> level 2 -> tempo must speed up ---
  // The DOM game uses the sliding bag (any piece types), so the rig adapts
  // to each piece's rot-1 footprint: rows 20-23 filled except its columns.
  const grid = g.grid();
  let drops = 0;
  while (g.lines() < 10 && drops < 40) {
    const p = g.current();
    p.rot = 1;
    const cells = T.SHAPES[p.type][1];
    p.x = 3 - Math.min.apply(null, cells.map(c => c[0]));
    p.y = 0;
    const absCols = new Set(cells.map(([dx]) => p.x + dx));
    for (let r = 20; r < 24; r++)
      for (let c = 0; c < 10; c++) grid[r][c] = absCols.has(c) ? null : 'J';
    g.hardDrop();
    g.tick(0.3);
    drops++;
  }
  assert.ok(g.lines() >= 10, 'cleared at least 10 lines, got ' + g.lines());
  assert.strictEqual(g.level(), 2, 'level 2');

  const before = melodyNotes().length;
  actx.currentTime += 2.5;
  await sleep(80);
  const m2 = melodyNotes();
  assert.ok(m2.length > before, 'music keeps scheduling after level-up');
  // gap between note i and i+1 == duration of note i; the anchor (fresh[0])
  // is the last pre-level note, so measure from fresh[1] onward (post-level)
  const fresh = m2.slice(before - 1);
  const l2Gaps = fresh.slice(2).map((n, i) => n.t - fresh[i + 1].t).filter(gap => gap > 0.5);
  assert.ok(l2Gaps.length > 0, 'found long notes after level-up');
  for (const gap of l2Gaps) {
    assert.ok(Math.abs(gap - 1.5 * (0.42 / 1.06)) < 0.01,
      'L2 long note gap ' + gap.toFixed(3) + ' ~= ' + (1.5 * 0.42 / 1.06).toFixed(3));
  }

  // --- 4. K toggles music off, then on ---
  key('keydown', 'KeyK');
  const countOff = musicCount();
  actx.currentTime += 2.0;
  await sleep(120);
  assert.strictEqual(musicCount(), countOff, 'no music scheduled while off');
  key('keydown', 'KeyK');
  await sleep(80);
  assert.ok(musicCount() > countOff, 'music resumes after K re-enables it');

  // --- 5. danger tint: stack in the top rows, frames must not throw ---
  // Leave column 0 empty so no row is full (a full row would make the next
  // lock start a clear, which pre-empts the top-out in step 6).
  for (let r = 4; r < 8; r++)
    for (let c = 1; c < 10; c++) grid[r][c] = 'J';
  step(16.7);
  step(16.7);

  // --- 6. force game over: rows 4-7 are J (danger step), so the spawned
  // piece (y=2, cells rows 2-3) cannot fall and locks entirely in hidden
  // rows -> top-out. No line clears involved. The rows were filled under an
  // already-spawned piece (which drops to y=3 on spawn), so put it back at
  // y=2, where a piece spawning over this stack would stay.
  g.current().y = 2;
  const linesBefore = g.lines();
  g.hardDrop();
  assert.strictEqual(g.status(), 'over', 'game over via top-out');
  await sleep(500);
  const ov = els['overlay'].innerHTML;
  assert.ok(ov.indexOf('All-time') >= 0, 'game over shows all-time section');
  assert.ok(ov.indexOf('T-spins') >= 0, 'game over shows T-spins stat');
  const lt = JSON.parse(ls['showpiece.lifetime']);
  assert.strictEqual(lt.games, 1, 'lifetime games = 1');
  assert.strictEqual(lt.lines, g.lines(), 'lifetime lines match game total');
  assert.strictEqual(g.lines(), linesBefore, 'top-out clears no lines');
  assert.ok(lt.seconds > 0, 'lifetime time accumulated');

  // --- 7. music stopped on game over ---
  const countOver = musicCount();
  actx.currentTime += 3.0;
  await sleep(120);
  assert.strictEqual(musicCount(), countOver, 'no music after game over');

  intervals.forEach(id => clearInterval(id));
  console.log('MUSIC + LIFETIME TESTS PASSED');
  process.exit(0);
})().catch(e => {
  intervals.forEach(id => clearInterval(id));
  console.error('FAIL:', e.message);
  process.exit(1);
});
