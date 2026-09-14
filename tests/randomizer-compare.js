'use strict';
// Randomizer comparison study behind RANDOMIZER.md sections 3 and 4 (not a test). Run: npm run stats:compare
const { TYPES, mulberry32, RANDOMIZERS, slidingExactBounds } = require(__dirname + '/randomizers.js');

const SEEDS = 20, N = 700000, GAPMAX = 120, GAMES = 20000;
const pct = x => (100 * x).toFixed(2) + '%';

function study(name) {
  const gapHist = new Array(GAPMAX + 1).fill(0);
  const runHist = new Array(20).fill(0);
  const win14Hist = new Array(15).fill(0);
  const drift = { 700: [], 7000: [], 70000: [], 700000: [] };
  let pieces = 0, gaps = 0, maxGap = 0, maxRun = 0, sameAsPrev = 0, win7with3 = 0, win7total = 0;
  for (let s = 0; s < SEEDS; s++) {
    const draw = RANDOMIZERS[name](mulberry32(9000 + s));
    const last = {}, counts = {}, w7 = {}, w14 = {};
    TYPES.forEach(t => { last[t] = -1; counts[t] = 0; w7[t] = 0; w14[t] = 0; });
    const seq = new Array(N);
    let run = 0, prev = null;
    for (let i = 0; i < N; i++) {
      const p = draw();
      seq[i] = p; counts[p]++; pieces++;
      if (last[p] >= 0) {
        const g = i - last[p] - 1;
        gapHist[Math.min(g, GAPMAX)]++; gaps++;
        if (g > maxGap) maxGap = g;
      }
      last[p] = i;
      if (p === prev) { run++; sameAsPrev++; } else { if (prev !== null) runHist[Math.min(run, 19)]++; run = 1; }
      prev = p;
      if (run > maxRun) maxRun = run;
      w7[p]++; if (i >= 7) w7[seq[i - 7]]--;
      w14[p]++; if (i >= 14) w14[seq[i - 14]]--;
      if (i >= 6) { win7total++; if (TYPES.some(t => w7[t] >= 3)) win7with3++; }
      if (i >= 13) for (const t of TYPES) win14Hist[w14[t]]++;
      if (drift[i + 1]) for (const t of TYPES) drift[i + 1].push(counts[t] - (i + 1) / 7);
    }
  }
  const atLeast = k => gapHist.slice(k).reduce((a, b) => a + b, 0) / gaps;
  let acc = 0, p99 = 0;
  for (let g = 0; g <= GAPMAX; g++) { acc += gapHist[g]; if (acc / gaps >= 0.99) { p99 = g; break; } }
  const w14tot = win14Hist.reduce((a, b) => a + b, 0);
  return {
    maxGap, maxRun, p99,
    gap20: atLeast(20),
    sameAsPrev: sameAsPrev / pieces,
    runs3per10k: 1e4 * runHist.slice(3).reduce((a, b) => a + b, 0) / pieces,
    win7with3: win7with3 / win7total,
    win14: [0, 1, 2, 3].map(k => win14Hist[k] / w14tot).concat(win14Hist.slice(4).reduce((a, b) => a + b, 0) / w14tot),
    drift: Object.keys(drift).map(n => Math.sqrt(drift[n].reduce((a, d) => a + d * d, 0) / drift[n].length)),
  };
}

// Chance that a single game of `len` pieces has an I-drought of at least each threshold
function gameScale(name, len) {
  const hits = [13, 20, 30, 40].map(() => 0);
  for (let g = 0; g < GAMES; g++) {
    const draw = RANDOMIZERS[name](mulberry32(500000 + g * 7919 + len));
    let last = -1, worst = 0;
    for (let i = 0; i < len; i++) if (draw() === 'I') { worst = Math.max(worst, i - last - 1); last = i; }
    worst = Math.max(worst, len - 1 - last);
    [13, 20, 30, 40].forEach((d, k) => { if (worst >= d) hits[k]++; });
  }
  return hits.map(h => pct(h / GAMES)).join(' / ');
}

console.log(`${SEEDS} seeds x ${N} pieces per randomizer\n`);
console.log('name      maxGap  maxRun  p99gap  gap>=20   same-prev  runs3+/10k  7win-triple  14win count 0/1/2/3/4+              drift rms @700/7k/70k/700k');
for (const name of Object.keys(RANDOMIZERS)) {
  const r = study(name);
  console.log(name.padEnd(9),
    String(r.maxGap).padStart(6), String(r.maxRun).padStart(7), String(r.p99).padStart(7),
    pct(r.gap20).padStart(8), pct(r.sameAsPrev).padStart(10), r.runs3per10k.toFixed(1).padStart(11),
    pct(r.win7with3).padStart(12), ' ', r.win14.map(pct).join(' / ').padEnd(38),
    r.drift.map(d => d.toFixed(1)).join(' / '));
}

console.log(`\nI-drought per game (${GAMES} games), thresholds >=13 / >=20 / >=30 / >=40`);
for (const len of [100, 400]) for (const name of Object.keys(RANDOMIZERS)) {
  console.log(`${String(len).padStart(3)} pieces  ${name.padEnd(9)} ${gameScale(name, len)}`);
}

console.log('\nExact worst cases, sliding 21-bag:', slidingExactBounds(3));
