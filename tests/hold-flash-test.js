'use strict';
const fs = require('fs');
const vm = require('vm');

const ctxStub = new Proxy({}, {
  get(t, p) { if (p === 'createLinearGradient') return () => ({ addColorStop() {} }); return () => undefined; },
  set() { return true; }
});

const denied = { added: 0 };
function makeEl() {
  return {
    style: { setProperty() {} },
    classList: { add(c) { if (c === 'denied') denied.added++; }, remove() {}, toggle() {} },
    addEventListener() {}, appendChild() {}, remove() {},
    textContent: '', innerHTML: '', hidden: false, value: '', checked: false,
    getContext: () => ctxStub, width: 320, height: 640, offsetWidth: 100
  };
}

const els = {};
let rafCb = null;
const listeners = {};
global.window = {
  addEventListener: (t, f) => { (listeners[t] = listeners[t] || []).push(f); },
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
vm.runInThisContext(raw.replace(/\}\s*$/, '  globalThis.__game = game;\n}'), { filename: 'game.js' });

const key = (t, c) => listeners[t].forEach(f => f({ code: c, repeat: false, preventDefault() {} }));
let t = 0;
const frame = () => { t += 16.7; const cb = rafCb; rafCb = null; cb(t); };

key('keydown', 'Enter'); frame();
key('keydown', 'KeyC'); frame();
console.log('after first hold: held=' + __game.holdType() + ' denied flashes: ' + denied.added + ' (expect 0)');
key('keydown', 'KeyC'); frame();
console.log('after second hold: denied flashes: ' + denied.added + ' (expect 1)');
key('keydown', 'Space'); frame(); frame();
console.log('after lock: canHold=' + __game.canHold() + ' (expect true)');
key('keydown', 'KeyC'); frame();
console.log('hold after lock: denied flashes: ' + denied.added + ' (expect 1, no new flash)');
