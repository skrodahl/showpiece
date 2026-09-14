'use strict';
const T = require(__dirname + '/../game.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(a ^ (a >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function analyze(mode, seed, N) {
  const draw = T.makeRandomizer(mode, mulberry32(seed));
  const seq = [];
  const counts = {};
  for (let i = 0; i < N; i++) {
    const p = draw();
    seq.push(p);
    counts[p] = (counts[p] || 0) + 1;
  }
  const per = N / 7;
  const dist = T.TYPES.map(t => counts[t]).join(' ');

  // longest drought: max gap (in draws) between consecutive I's
  let last = -1, drought = 0, droughtAt = -1;
  for (let i = 0; i < N; i++) {
    if (seq[i] === 'I') {
      const gap = i - last - 1;
      if (gap > drought) { drought = gap; droughtAt = i; }
      last = i;
    }
  }
  drought = Math.max(drought, N - 1 - last);

  // sliding 14-piece window (2 bag-cycles): min/max I count the player "feels"
  let min14 = 14, max14 = 0, minAt = 0, maxAt = 0;
  let w = 0;
  for (let i = 0; i < N; i++) {
    if (seq[i] === 'I') w++;
    if (i >= 14 && seq[i - 14] === 'I') w--;
    if (i >= 13) {
      if (w < min14) { min14 = w; minAt = i; }
      if (w > max14) { max14 = w; maxAt = i; }
    }
  }
  // and the worst 7-piece window
  let w7 = 0, min7 = 7, max7 = 0;
  for (let i = 0; i < N; i++) {
    if (seq[i] === 'I') w7++;
    if (i >= 7 && seq[i - 7] === 'I') w7--;
    if (i >= 6) { if (w7 < min7) min7 = w7; if (w7 > max7) max7 = w7; }
  }

  console.log(mode.padEnd(8),
    'dist:', dist,
    '(expect ' + per.toFixed(0) + ' each)',
    '| I worst-14-window:', min14, '-', max14,
    '| I worst-7-window:', min7, '-', max7,
    '| I max drought:', drought);
}

const N = 21000; // 3000 bag-cycles
for (const seed of [1, 42, 20260818]) {
  console.log('--- seed', seed, '---');
  analyze('sliding', seed, N);
  analyze('seven', seed, N);
  analyze('random', seed, N);
}
