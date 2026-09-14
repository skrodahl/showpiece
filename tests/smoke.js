'use strict';
const fs = require('fs');
const vm = require('vm');
const assert = require('assert');
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
    width: 320, height: 640, offsetWidth: 100
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

key('keydown', 'Enter');
console.log('status after Enter:', __game.status());

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
const s = JSON.stringify({ status: __game.status(), score: __game.score(), lines: __game.lines(), level: __game.level(), queue: __game.queue().length, hold: __game.holdType() });
console.log('after 2400 frames + random input:', s);
console.log('SMOKE OK');

els.previewSel.value = '2';
(els.previewSel.listeners.change || []).forEach(fn => fn());
for (let i = 0; i < 300; i++) step(16.7);
assert.strictEqual(__game.previewLength(), 2, 'preview length must reach the game');
console.log('PREVIEW OK');

els.poolSel.value = '4';
(els.poolSel.listeners.change || []).forEach(fn => fn());
for (let i = 0; i < 300; i++) step(16.7);
assert.strictEqual(__game.randomizerInfo().n, 4, 'pool size must reach the randomizer');
console.log('POOL OK');
