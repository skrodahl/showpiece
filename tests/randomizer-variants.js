'use strict';
// Rejected sliding-bag variants from RANDOMIZER.md section 6 (not a test). Run: npm run stats:variants
const { TYPES, mulberry32, shuffled, slidingPool, RANDOMIZERS } = require(__dirname + '/randomizers.js');

const VARIANTS = {
  'sliding 21-bag': RANDOMIZERS.sliding,
  // draw 4 -> add 4 unique random types; draw 7 -> add all 7; alternate
  'alternate 4 random / 7': rng => slidingPool(rng, 3, [4, 7], k => k === 7 ? TYPES : shuffled(rng, TYPES).slice(0, 4)),
  // draw 4 -> add the first 4 of a shuffled bag; draw 3 -> add the other 3
  'alternate 4 / 3 from a 7-bag': rng => {
    let bag = [];
    return slidingPool(rng, 3, [4, 3], k => { if (!bag.length) bag = shuffled(rng, TYPES); return bag.splice(0, k); });
  },
  // after every draw, add the next piece of a 7-bag
  'drip 1 per draw from a 7-bag': rng => {
    let bag = [];
    return slidingPool(rng, 3, [1], () => { if (!bag.length) bag = shuffled(rng, TYPES); return [bag.pop()]; });
  },
  // every 7 draws, discard the pool and start over with 3 of each
  'reset to 3 of each every 7': rng => {
    let pool = [], n = 0;
    const fill = () => { pool = []; for (let i = 0; i < 3; i++) pool.push(...TYPES); };
    fill();
    return () => {
      const p = pool.splice((rng() * pool.length) | 0, 1)[0];
      if (++n % 7 === 0) fill();
      return p;
    };
  },
  'pure random': RANDOMIZERS.random,
};

const SEEDS = 20, N = 700000;
for (const [name, make] of Object.entries(VARIANTS)) {
  let maxGap = 0, gaps = 0, ge20 = 0, driftSq = 0;
  for (let s = 0; s < SEEDS; s++) {
    const draw = make(mulberry32(9000 + s));
    const last = {}, counts = {};
    TYPES.forEach(t => { counts[t] = 0; });
    for (let i = 0; i < N; i++) {
      const p = draw();
      counts[p]++;
      if (last[p] !== undefined) {
        const g = i - last[p] - 1;
        gaps++; if (g >= 20) ge20++;
        if (g > maxGap) maxGap = g;
      }
      last[p] = i;
    }
    for (const t of TYPES) driftSq += (counts[t] - N / 7) ** 2;
  }
  console.log(name.padEnd(30), `| worst drought ${String(maxGap).padStart(3)}`,
    `| gap>=20 ${(100 * ge20 / gaps).toFixed(2)}%`,
    `| drift rms after ${N}: ${Math.sqrt(driftSq / (SEEDS * 7)).toFixed(1)}`);
}
