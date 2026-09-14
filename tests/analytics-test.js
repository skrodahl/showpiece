'use strict';
// The analytics overlay must not change gameplay. The DOM layer of game.js can only be
// loaded once per process, so each scenario runs in a child process with Math.random
// seeded identically; the parent asserts both end states are identical.
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
const { execFileSync } = require('child_process');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function runChild(mode) {
  Math.random = mulberry32(42);
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
    const el = {
      id: '',
      listeners: {},
      style: { setProperty() {}, classList: { toggle() {} } },
      classList: { add() {}, remove() {}, toggle() {} },
      addEventListener(type, fn) { (el.listeners[type] = el.listeners[type] || []).push(fn); },
      removeEventListener() {},
      appendChild() {}, remove() {},
      textContent: '', innerHTML: '', hidden: false,
      value: '', checked: false,
      getContext: () => ctxStub,
      width: 320, height: 640, offsetWidth: 100,
      getBoundingClientRect: () => ({ left: 400, top: 100, right: 1160, bottom: 800, width: 760, height: 700 })
    };
    return el;
  }
  const els = {};
  let rafCb = null;
  const listeners = { keydown: [], keyup: [], blur: [], resize: [] };
  global.window = {
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); },
    removeEventListener() {},
    innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1,
    scrollX: 0, scrollY: 0,
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

  const raw = fs.readFileSync(__dirname + '/../game.js', 'utf8');
  const src = raw.replace(/\}\s*$/, '  globalThis.__game = game;\n}');
  vm.runInThisContext(src, { filename: 'game.js' });

  const fire = (type, ev) => listeners[type].forEach(fn => fn(ev));
  const key = (type, code) => fire(type, { code, repeat: false, preventDefault() {} });
  let now = 0;
  const step = ms => { now += ms; const cb = rafCb; rafCb = null; cb(now); };

  if (mode === 'on') {
    key('keydown', 'KeyA');
    assert.strictEqual(__game.status(), 'ready', 'KeyA must not start the game');
    assert.strictEqual(els.analytics.hidden, false, 'analytics must be shown after KeyA');
  }

  key('keydown', 'Enter');
  const codes = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'KeyZ', 'KeyX', 'Space', 'KeyC'];
  let k = 0;
  for (let i = 0; i < 2400; i++) {
    if (i % 12 === 0) {
      const c = codes[k++ % codes.length];
      key('keydown', c);
      if (i % 24 === 0) key('keyup', c);
    }
    if (i % 300 === 150) key('keydown', 'KeyP');
    if (i % 300 === 160) key('keydown', 'KeyP');
    step(16.7);
    if (__game.status() === 'over') { key('keydown', 'Enter'); }
  }

  if (mode === 'on') {
    assert.ok(els.analytics.innerHTML.indexOf('refill in') >= 0, 'analytics must render the refill line');
    process.stderr.write('ANALYTICS RENDER OK\n');
  }

  const grid = __game.grid().map(row => row.map(c => c || '.').join('')).join('|');
  console.log(JSON.stringify({
    status: __game.status(),
    score: __game.score(),
    lines: __game.lines(),
    level: __game.level(),
    queue: __game.queue().length,
    hold: __game.holdType(),
    grid: grid
  }));
}

if (process.argv[2] === 'off' || process.argv[2] === 'on') {
  runChild(process.argv[2]);
} else {
  const json = (mode) => execFileSync(process.execPath, [__filename, mode]).toString().trim().split('\n').pop();
  const off = json('off');
  const on = json('on');
  assert.strictEqual(off, on, 'the analytics overlay changed the game state');
  console.log('ANALYTICS OK');
}
