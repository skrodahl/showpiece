'use strict';
// Sliding 7n-bag family behind RANDOMIZER.md section 6 (not a test). Run: npm run stats:pools
// Pool of n copies of each type; after every 7k draws, add k of each (1 <= k <= n).
// k = n empties the pool exactly at each refill, i.e. a closed 7n-bag (k = n = 1 is the 7-bag).
const { TYPES, mulberry32, slidingPool, slidingExactBounds } = require(__dirname + '/randomizers.js');

const SEEDS = 20, N = 700000;
for (const n of [1, 2, 3, 4]) for (let k = 1; k <= n; k++) {
  const sets = [];
  for (let i = 0; i < k; i++) sets.push(...TYPES);
  let gaps = 0, ge20 = 0, maxGap = 0, run3 = 0, pieces = 0;
  const hist = new Array(200).fill(0);
  for (let s = 0; s < SEEDS; s++) {
    const draw = slidingPool(mulberry32(9000 + s), n, [7 * k], () => sets);
    const last = {};
    let prev = null, run = 0;
    for (let i = 0; i < N; i++) {
      const p = draw();
      pieces++;
      if (last[p] !== undefined) {
        const g = i - last[p] - 1;
        gaps++; hist[Math.min(g, 199)]++;
        if (g >= 20) ge20++;
        if (g > maxGap) maxGap = g;
      }
      last[p] = i;
      if (p === prev) run++; else { if (run >= 3) run3++; run = 1; }
      prev = p;
    }
  }
  let acc = 0, p99 = 0;
  for (let g = 0; g < 200; g++) { acc += hist[g]; if (acc / gaps >= 0.99) { p99 = g; break; } }
  const exact = slidingExactBounds(n, k);
  console.log(`n=${n} k=${k} (${String(7 * n).padStart(2)}-pool, ${String(7 * k).padStart(2)} per refill)`,
    `| p99 gap ${String(p99).padStart(2)} | gap>=20 ${(100 * ge20 / gaps).toFixed(2).padStart(5)}% | runs3+/10k ${(1e4 * run3 / pieces).toFixed(1).padStart(5)}`,
    `| worst drought seen ${String(maxGap).padStart(2)} | exact: drought ${String(exact.maxDrought).padStart(3)},`,
    `run ${String(exact.maxRun).padStart(2)}, ahead < ${exact.maxAhead.toFixed(2)}, behind < ${(-exact.maxBehind).toFixed(2)}`);
}
