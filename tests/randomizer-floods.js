'use strict';
// Flood-after-drought study behind RANDOMIZER.md section 5 (not a test). Run: npm run stats:floods
// When a piece's drought ends, how many more of it arrive in the next 7 pieces?
const { mulberry32, RANDOMIZERS } = require(__dirname + '/randomizers.js');

const SEEDS = 20, N = 700000;
const bucketOf = g => g < 7 ? 'gap 0-6' : g < 20 ? 'gap 7-19' : g < 30 ? 'gap 20-29' : 'gap 30+';
for (const name of ['sliding', 'random', 'seven']) {
  const buckets = {}; // bucket -> [events, total more, events with >= 2 more]
  for (let s = 0; s < SEEDS; s++) {
    const draw = RANDOMIZERS[name](mulberry32(9000 + s));
    const seq = new Array(N);
    for (let i = 0; i < N; i++) seq[i] = draw();
    const last = {};
    for (let i = 0; i < N - 7; i++) {
      const p = seq[i];
      if (last[p] !== undefined) {
        const b = buckets[bucketOf(i - last[p] - 1)] ||= [0, 0, 0];
        let more = 0;
        for (let j = 1; j <= 7; j++) if (seq[i + j] === p) more++;
        b[0]++; b[1] += more; if (more >= 2) b[2]++;
      }
      last[p] = i;
    }
  }
  console.log(name.padEnd(8), Object.entries(buckets)
    .sort(([a], [b]) => parseInt(a.slice(4)) - parseInt(b.slice(4)))
    .map(([k, [n, sum, two]]) => `${k}: avg ${(sum / n).toFixed(2)} more, >=2 more ${(100 * two / n).toFixed(1)}%`)
    .join(' | '));
}
