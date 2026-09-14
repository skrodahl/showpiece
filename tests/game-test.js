'use strict';
const assert = require('assert');
const T = require(__dirname + '/../game.js');

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name);
    console.error(e);
    process.exitCode = 1;
  }
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

test('SRS rotation states match guideline I states, O invariant, T spawn shape', () => {
  assert.strictEqual(T.SHAPES.I.length, 4);
  const set = (c) => c.map(([x, y]) => x + ',' + y).sort().join('|');
  assert.strictEqual(set(T.SHAPES.I[0]), '0,1|1,1|2,1|3,1');
  assert.strictEqual(set(T.SHAPES.I[1]), '2,0|2,1|2,2|2,3');
  assert.strictEqual(set(T.SHAPES.I[2]), '0,2|1,2|2,2|3,2');
  assert.strictEqual(set(T.SHAPES.I[3]), '1,0|1,1|1,2|1,3');
  assert.strictEqual(set(T.SHAPES.O[0]), set(T.SHAPES.O[3]));
  assert.strictEqual(set(T.SHAPES.T[0]), '0,1|1,0|1,1|2,1');
});

test('SRS kick tables are exact inverses', () => {
  const check = (table) => {
    const pairs = { '0>1': '1>0', '1>2': '2>1', '2>3': '3>2', '3>0': '0>3' };
    for (const k of Object.keys(pairs)) {
      const a = table[k], b = table[pairs[k]];
      assert.strictEqual(a.length, b.length);
      for (let i = 0; i < a.length; i++) {
        assert.ok(a[i][0] + b[i][0] === 0, k + '/' + pairs[k] + ' x' + i);
        assert.ok(a[i][1] + b[i][1] === 0, k + '/' + pairs[k] + ' y' + i);
      }
    }
  };
  check(T.KICKS_JLSTZ);
  check(T.KICKS_I);
});

test('7-bag: every 7 draws is a complete set', () => {
  const r = T.makeRandomizer('seven', mulberry32(1234));
  for (let block = 0; block < 200; block++) {
    const seen = {};
    for (let i = 0; i < 7; i++) {
      const p = r();
      seen[p] = (seen[p] || 0) + 1;
      assert.strictEqual(seen[p], 1, 'duplicate ' + p + ' within bag');
    }
    assert.strictEqual(Object.keys(seen).length, 7);
  }
});

test('sliding 21-bag: exact pool bookkeeping over 7 cycles', () => {
  const r = T.makeRandomizer('sliding', mulberry32(99));
  const pool = {};
  for (const t of T.TYPES) pool[t] = 3;
  for (let j = 0; j < 7; j++) {
    const p = r();
    assert.ok(pool[p] > 0, 'drew ' + p + ' with empty pool');
    pool[p]--;
    if (j === 6) for (const t of T.TYPES) pool[t]++;
    const size = Object.values(pool).reduce((a, b) => a + b, 0);
    assert.strictEqual(size, j === 6 ? 21 : 21 - j - 1, 'pool size after draw ' + j);
  }
});

test('sliding 21-bag: balanced distribution, droughts beyond 7-bag cap', () => {
  const r = T.makeRandomizer('sliding', mulberry32(99));
  const counts = {};
  for (const t of T.TYPES) counts[t] = 0;
  const since = {};
  for (const t of T.TYPES) since[t] = 0;
  let maxDrought = 0;
  for (let i = 0; i < 14000; i++) {
    const p = r();
    counts[p]++;
    since[p] = 0;
    for (const t of T.TYPES) {
      if (t === p) continue;
      since[t]++;
      maxDrought = Math.max(maxDrought, since[t]);
    }
  }
  const vals = T.TYPES.map((t) => counts[t]);
  assert.strictEqual(vals.reduce((a, b) => a + b, 0), 14000);
  const max = Math.max(...vals), min = Math.min(...vals);
  assert.ok(max - min <= 7, 'drift too large: ' + JSON.stringify(Object.assign({}, counts)));
  assert.ok(maxDrought > 12, 'expected drought beyond 7-bag cap 12, got ' + maxDrought);
});

test('sliding 21-bag allows 3-in-a-row; 7-bag never does', () => {
  let three = false, run = 1, prev = null;
  const r = T.makeRandomizer('sliding', mulberry32(7));
  for (let i = 0; i < 3000; i++) {
    const p = r();
    run = prev === p ? run + 1 : 1;
    if (run >= 3) three = true;
    prev = p;
  }
  assert.ok(three, 'sliding bag should allow 3-in-a-row');
  let bad = false, run2 = 1, prev2 = null;
  const r2 = T.makeRandomizer('seven', mulberry32(7));
  for (let i = 0; i < 3000; i++) {
    const p = r2();
    run2 = prev2 === p ? run2 + 1 : 1;
    if (run2 >= 3) bad = true;
    prev2 = p;
  }
  assert.ok(!bad, '7-bag must never produce 3 in a row');
});

test('golden: randomizer sequences are unchanged', () => {
  const GOLDEN = {
    sliding: { first40: 'TLILTZTTOISLOJZJOJJOSSTLZIIZSIIZOJSIOTOS', hash: '7d366128' },
    seven: { first40: 'SOLTIZJZLOISJTTIJOSLZSIOZTLJLZOJSITZJOSI', hash: '4c8d7abd' },
    random: { first40: 'STZZOOZJTIIZTIOTTLSIOOJLLJOOTTZJTLIITJJT', hash: '64aa9243' }
  };
  for (const mode of ['sliding', 'seven', 'random']) {
    const r = T.makeRandomizer(mode, mulberry32(2026));
    let seq = '';
    for (let i = 0; i < 10000; i++) seq += r();
    assert.strictEqual(seq.slice(0, 40), GOLDEN[mode].first40, mode + ': first 40 pieces');
    assert.strictEqual(fnv1a(seq), GOLDEN[mode].hash, mode + ': fingerprint of 10000 pieces');
  }
});

test('sliding n,k: default params equal explicit {n:3,k:1}', () => {
  const a = T.makeRandomizer('sliding', mulberry32(42));
  const b = T.makeRandomizer('sliding', mulberry32(42), { n: 3, k: 1 });
  for (let i = 0; i < 5000; i++) assert.strictEqual(a(), b());
});

test('sliding n,k: pool bookkeeping via inspect', () => {
  for (let n = 1; n <= 4; n++) {
    for (let k = 1; k <= n; k++) {
      const r = T.makeRandomizer('sliding', mulberry32(5), { n, k });
      const dealt = {};
      for (const t of T.TYPES) dealt[t] = 0;
      for (let i = 0; i < 700; i++) {
        const info = r.inspect();
        assert.strictEqual(info.size, T.TYPES.reduce((a, t) => a + info.counts[t], 0), n + ',' + k + ': size != sum(counts)');
        for (const t of T.TYPES) assert.ok(info.counts[t] >= 0, n + ',' + k + ': negative count ' + t);
        const p = r();
        assert.ok(info.counts[p] >= 1, n + ',' + k + ': drew ' + p + ' that was not in the pool');
        dealt[p]++;
        const refills = Math.floor((i + 1) / (7 * k));
        const after = r.inspect();
        for (const t of T.TYPES) {
          assert.strictEqual(dealt[t] + after.counts[t], n + k * refills, n + ',' + k + ': bookkeeping broken for ' + t);
        }
        assert.ok(after.drawsUntilRefill >= 1 && after.drawsUntilRefill <= 7 * k, n + ',' + k + ': drawsUntilRefill out of range');
      }
    }
  }
});

test('inspect never changes the sequence', () => {
  const cases = [
    ['sliding', { n: 3, k: 1 }],
    ['sliding', { n: 4, k: 2 }],
    ['seven', {}],
    ['random', {}]
  ];
  for (const [mode, params] of cases) {
    const a = T.makeRandomizer(mode, mulberry32(777), params);
    const b = T.makeRandomizer(mode, mulberry32(777), params);
    for (let i = 0; i < 5000; i++) {
      a.inspect();
      assert.strictEqual(a(), b(), mode + ' params ' + JSON.stringify(params) + ': inspect() changed the sequence at ' + i);
    }
  }
});

test('seven inspect exposes counts only', () => {
  const r = T.makeRandomizer('seven', mulberry32(31));
  for (let i = 0; i < 30; i++) {
    r();
    const info = r.inspect();
    for (const t of T.TYPES) assert.ok(info.counts[t] === 0 || info.counts[t] === 1, 'seven count not 0/1');
    for (const key of Object.keys(info)) assert.ok(!Array.isArray(info[key]), 'seven inspect leaked array ' + key);
  }
});

test('slidingBounds matches the table', () => {
  const TABLE = [
    [1, 1, 12, 2, 0.857, 0.857],
    [2, 1, 61, 10, 1.857, 6.857],
    [2, 2, 24, 4, 1.714, 1.714],
    [3, 1, 110, 18, 2.857, 12.857],
    [3, 2, 67, 11, 2.714, 7.714],
    [3, 3, 36, 6, 2.571, 2.571],
    [4, 1, 159, 26, 3.857, 18.857],
    [4, 2, 122, 20, 3.714, 13.714],
    [4, 3, 79, 13, 3.571, 8.571],
    [4, 4, 48, 8, 3.429, 3.429]
  ];
  for (const [n, k, drought, run, ahead, behind] of TABLE) {
    const b = T.slidingBounds(n, k);
    assert.strictEqual(b.maxDrought, drought, n + ',' + k + ' drought');
    assert.strictEqual(b.maxRun, run, n + ',' + k + ' run');
    assert.ok(Math.abs(b.maxAhead - ahead) < 0.001, n + ',' + k + ' ahead');
    assert.ok(Math.abs(b.maxBehind - behind) < 0.001, n + ',' + k + ' behind');
  }
});

test('slidingBounds agrees with exhaustive search', () => {
  const { slidingExactBounds } = require(__dirname + '/randomizers.js');
  for (let n = 1; n <= 7; n++) {
    for (let k = 1; k <= n; k++) {
      const exact = slidingExactBounds(n, k);
      const b = T.slidingBounds(n, k);
      assert.strictEqual(b.maxDrought, exact.maxDrought, n + ',' + k + ' drought vs exhaustive');
      assert.strictEqual(b.maxRun, exact.maxRun, n + ',' + k + ' run vs exhaustive');
      assert.ok(Math.abs(b.maxAhead - exact.maxAhead) < 1e-9, n + ',' + k + ' ahead vs exhaustive');
      assert.ok(Math.abs(b.maxBehind - -exact.maxBehind) < 1e-9, n + ',' + k + ' behind vs exhaustive');
    }
  }
});

test('makeRandomizer rejects invalid n,k', () => {
  const bad = [{ n: 2, k: 3 }, { n: 0, k: 0 }, { n: 3, k: 1.5 }, { n: 9, k: 1 }];
  for (const p of bad) {
    assert.throws(() => T.makeRandomizer('sliding', mulberry32(1), p), RangeError, JSON.stringify(p));
  }
});

test('slidingBounds rejects invalid n,k', () => {
  const bad = [{ n: 2, k: 3 }, { n: 0, k: 0 }, { n: 3, k: 1.5 }, { n: 9, k: 1 }];
  for (const p of bad) {
    assert.throws(() => T.slidingBounds(p.n, p.k), RangeError, JSON.stringify(p));
  }
});

test('deal events follow randomizer order', () => {
  const deals = [];
  const g = T.createGame({
    randomizerMode: 'sliding',
    rng: mulberry32(2026),
    onEvent: (ev) => { if (ev.type === 'deal') deals.push(ev.piece); }
  });
  const ref = T.makeRandomizer('sliding', mulberry32(2026));
  g.start();
  const grid = g.grid();
  while (deals.length < 60) {
    g.hardDrop();
    g.tick(0.3);
    for (let r = 0; r < T.ROWS; r++) for (let c = 0; c < T.COLS; c++) grid[r][c] = null;
  }
  let expected = '';
  for (let i = 0; i < 60; i++) expected += ref();
  assert.strictEqual(deals.join(''), expected, 'deal sequence must equal the randomizer sequence');
  assert.strictEqual(expected.slice(0, 40), 'TLILTZTTOISLOJZJOJJOSSTLZIIZSIIZOJSIOTOS', 'first 40 of the golden sequence');
});

test('hold does not deal', () => {
  let deals = 0;
  const g = T.createGame({
    randomizerMode: 'sliding',
    rng: mulberry32(2026),
    onEvent: (ev) => { if (ev.type === 'deal') deals++; }
  });
  g.start();
  assert.strictEqual(deals, 1, 'start deals the first piece');
  g.holdPiece();
  assert.strictEqual(deals, 2, 'hold with empty hold deals the queued piece');
  g.hardDrop();
  assert.strictEqual(deals, 3, 'locking the piece deals the next one');
  g.holdPiece();
  assert.strictEqual(deals, 3, 'hold swap must not deal');
});

test('preview length and randomizerInfo never change the sequence', () => {
  const run = (hook) => {
    const deals = [];
    const g = T.createGame({
      randomizerMode: 'sliding',
      rng: mulberry32(2026),
      onEvent: (ev) => { if (ev.type === 'deal') deals.push(ev.piece); }
    });
    g.start();
    const grid = g.grid();
    let i = 0;
    while (deals.length < 300) {
      hook(g, i++);
      g.hardDrop();
      g.tick(0.3);
      for (let r = 0; r < T.ROWS; r++) for (let c = 0; c < T.COLS; c++) grid[r][c] = null;
    }
    return deals.join('');
  };
  const plain = run(() => {});
  const fancy = run((g, i) => { g.setPreviewLength(i % 6); g.randomizerInfo(); });
  assert.strictEqual(plain, fancy, 'preview length changes and randomizerInfo must not alter the deal sequence');
});

test('randomizerInfo hides nothing beyond the preview', () => {
  const g0 = T.createGame({ randomizerMode: 'sliding', rng: mulberry32(4242), previewLength: 0 });
  g0.start();
  const info0 = g0.randomizerInfo();
  assert.strictEqual(info0.hidden, 1, 'with preview 0 the single queued piece is hidden');
  const ref0 = T.makeRandomizer('sliding', mulberry32(4242));
  ref0();
  ref0();
  assert.strictEqual(info0.size, ref0.inspect().size + 1, 'hidden pieces count back into the pool size');
  const g5 = T.createGame({ randomizerMode: 'sliding', rng: mulberry32(4242), previewLength: 5 });
  g5.start();
  assert.strictEqual(g5.randomizerInfo().hidden, 0, 'with preview 5 nothing is hidden');
});

test('setPreviewLength shrinks without discarding', () => {
  const deals = [];
  const g = T.createGame({
    randomizerMode: 'sliding',
    rng: mulberry32(31337),
    previewLength: 5,
    onEvent: (ev) => { if (ev.type === 'deal') deals.push(ev.piece); }
  });
  g.start();
  assert.strictEqual(g.queue().length, 5, 'queue is topped up to the preview length');
  g.setPreviewLength(1);
  assert.strictEqual(g.queue().length, 5, 'shrinking must not discard queued pieces');
  const grid = g.grid();
  while (deals.length < 5) {
    g.hardDrop();
    g.tick(0.3);
    for (let r = 0; r < T.ROWS; r++) for (let c = 0; c < T.COLS; c++) grid[r][c] = null;
  }
  assert.strictEqual(g.queue().length, 1, 'after 4 more deals the queue holds only the new target');
});

test('setRandomizerMode with params', () => {
  const g = T.createGame({ randomizerMode: 'sliding', rng: mulberry32(777) });
  g.start();
  g.setRandomizerMode('sliding', { n: 2, k: 2 });
  const info = g.randomizerInfo();
  assert.strictEqual(info.mode, 'sliding');
  assert.strictEqual(info.n, 2);
  assert.strictEqual(info.k, 2);
  const g2 = T.createGame({ randomizerMode: 'sliding', rng: mulberry32(778), randomizerParams: { n: 4, k: 1 } });
  g2.start();
  assert.strictEqual(g2.randomizerInfo().n, 4, 'createGame accepts randomizerParams');
  assert.strictEqual(g2.randomizerInfo().k, 1);
});

test('restart starts a fresh 7-bag', () => {
  const deals = [];
  let capturing = false;
  const g = T.createGame({
    randomizerMode: 'seven',
    rng: mulberry32(4242),
    previewLength: 3,
    onEvent: (ev) => { if (capturing && ev.type === 'deal') deals.push(ev.piece); }
  });
  g.start();
  g.hardDrop();
  g.tick(0.3);
  g.hardDrop();
  g.tick(0.3);
  g.setPreviewLength(5);
  g.setPreviewLength(3);
  capturing = true;
  g.start();
  const info = g.randomizerInfo();
  assert.strictEqual(info.drawsUntilRefill, 3, 'fresh 7-bag after start (preview 3) refills after 3 more draws');
  const grid = g.grid();
  for (let i = 0; i < 6; i++) {
    g.hardDrop();
    g.tick(0.3);
    for (let r = 0; r < T.ROWS; r++) for (let c = 0; c < T.COLS; c++) grid[r][c] = null;
  }
  assert.strictEqual(deals.length, 7, 'start + 6 drops deal 7 pieces');
  assert.strictEqual(new Set(deals).size, 7, 'the first 7 pieces of a restarted 7-bag are a complete set');
});

test('restart starts a fresh sliding pool', () => {
  const g = T.createGame({
    randomizerMode: 'sliding',
    rng: mulberry32(4243),
    previewLength: 3
  });
  g.start();
  g.hardDrop();
  g.tick(0.3);
  g.hardDrop();
  g.tick(0.3);
  g.setPreviewLength(5);
  g.setPreviewLength(3);
  g.start();
  const info = g.randomizerInfo();
  assert.strictEqual(info.size, 17, 'fresh 21-bag after start (preview 3) holds 21 - 4 = 17 pieces');
  assert.strictEqual(info.drawsUntilRefill, 3, 'refill countdown of a fresh pool');
  const ref = T.createGame({ randomizerMode: 'sliding', rng: mulberry32(4244), previewLength: 3 });
  ref.start();
  assert.strictEqual(info.size, ref.randomizerInfo().size, 'restart state matches a newly created game');
  assert.strictEqual(info.drawsUntilRefill, ref.randomizerInfo().drawsUntilRefill);
});

test('settings outside a game draw nothing', () => {
  const deals1 = [];
  const deals2 = [];
  let phase = 1;
  let calls = 0;
  const base = mulberry32(2026);
  const g = T.createGame({
    randomizerMode: 'sliding',
    previewLength: 3,
    rng: () => { calls++; return base(); },
    onEvent: (ev) => { if (ev.type === 'deal') (phase === 1 ? deals1 : deals2).push(ev.piece); }
  });
  g.setPreviewLength(5);
  g.setRandomizerMode('seven');
  g.setRandomizerMode('sliding', { n: 2, k: 2 });
  g.setRandomizerMode('sliding');
  g.setPreviewLength(3);
  assert.strictEqual(calls, 0, 'ready-screen settings changes draw no pieces');
  assert.strictEqual(g.queue().length, 0, 'no pieces are queued before a game starts');
  g.start();
  while (g.status() === 'playing') g.hardDrop();
  assert.strictEqual(g.status(), 'over', 'hardDrops fill the tower to the top');
  const ref1 = T.makeRandomizer('sliding', mulberry32(2026));
  let exp1 = '';
  for (let i = 0; i < deals1.length; i++) exp1 += ref1();
  assert.strictEqual(deals1.join(''), exp1, 'game 1 pieces match the untouched stream');
  const saved = calls;
  g.setRandomizerMode('sliding');
  g.setPreviewLength(3);
  assert.strictEqual(calls, saved, 'settings after game over draw no pieces');
  phase = 2;
  g.start();
  g.hardDrop();
  const adv = mulberry32(2026);
  for (let i = 0; i < saved; i++) adv();
  const ref2 = T.makeRandomizer('sliding', adv);
  assert.strictEqual(deals2.join(''), ref2() + ref2(), 'game 2 picks up the stream where game 1 stopped');
});

test('stats tracker: vectors', () => {
  const VECTORS = [
    {
      seq: 'IIIOTSZJLI',
      total: 10,
      counts: { I: 4, O: 1, T: 1, S: 1, Z: 1, J: 1, L: 1 },
      sinceLastSeen: { I: 0, O: 6, T: 5, S: 4, Z: 3, J: 2, L: 1 },
      longestDrought: { length: 8, piece: 'L' },
      longestRun: { length: 3, piece: 'I' },
      biggestFlood: { count: 3, piece: 'I' }
    },
    {
      seq: 'SZSZOOOOTJLLIOOTSZ',
      total: 18,
      counts: { I: 1, O: 6, T: 2, S: 3, Z: 3, J: 1, L: 2 },
      sinceLastSeen: { I: 5, O: 3, T: 2, S: 1, Z: 0, J: 8, L: 6 },
      longestDrought: { length: 13, piece: 'S' },
      longestRun: { length: 4, piece: 'O' },
      biggestFlood: { count: 4, piece: 'O' }
    },
    {
      seq: 'TTTTTTTIOTSZJL',
      total: 14,
      counts: { I: 1, O: 1, T: 8, S: 1, Z: 1, J: 1, L: 1 },
      sinceLastSeen: { I: 6, O: 5, T: 4, S: 3, Z: 2, J: 1, L: 0 },
      longestDrought: { length: 13, piece: 'L' },
      longestRun: { length: 7, piece: 'T' },
      biggestFlood: { count: 7, piece: 'T' }
    },
    {
      seq: 'IOTSZJLIOTSZJLOOIIOIOSZSZSZSZSZSZJ',
      total: 34,
      counts: { I: 5, O: 6, T: 2, S: 8, Z: 8, J: 3, L: 2 },
      sinceLastSeen: { I: 14, O: 13, T: 24, S: 2, Z: 1, J: 0, L: 20 },
      longestDrought: { length: 24, piece: 'T' },
      longestRun: { length: 2, piece: 'O' },
      biggestFlood: { count: 4, piece: 'O' }
    }
  ];
  for (const v of VECTORS) {
    const s = T.createRandomizerStats();
    for (const p of v.seq) s.observe(p);
    assert.deepStrictEqual(s.snapshot(), {
      total: v.total,
      counts: v.counts,
      sinceLastSeen: v.sinceLastSeen,
      longestDrought: v.longestDrought,
      longestRun: v.longestRun,
      biggestFlood: v.biggestFlood
    }, v.seq);
  }
});

test('stats tracker: reset and snapshot independence', () => {
  const s = T.createRandomizerStats();
  const initial = s.snapshot();
  assert.strictEqual(initial.total, 0);
  assert.deepStrictEqual(initial.counts, { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 });
  assert.deepStrictEqual(initial.sinceLastSeen, { I: 0, O: 0, T: 0, S: 0, Z: 0, J: 0, L: 0 });
  assert.deepStrictEqual(initial.longestDrought, { length: 0, piece: null });
  assert.deepStrictEqual(initial.longestRun, { length: 0, piece: null });
  assert.deepStrictEqual(initial.biggestFlood, { count: 0, piece: null });

  s.observe('I');
  s.observe('I');
  s.observe('O');
  const live = s.snapshot();
  live.counts.I = 99;
  live.sinceLastSeen.I = 99;
  live.longestDrought.piece = 'O';
  live.biggestFlood.piece = 'J';
  const fresh = s.snapshot();
  assert.strictEqual(fresh.counts.I, 2, 'snapshot is a copy, not a live reference');
  assert.strictEqual(fresh.sinceLastSeen.I, 1);
  assert.strictEqual(fresh.longestDrought.piece, 'T');
  assert.strictEqual(fresh.biggestFlood.piece, 'I');

  s.reset();
  assert.deepStrictEqual(s.snapshot(), initial, 'reset returns the tracker to the initial snapshot');
});

test('game: single line clear scores and updates lines', () => {
  const g = T.createGame({ randomizerMode: 'random', rng: () => 0 });
  g.start();
  const cur0 = g.current();
  assert.strictEqual(cur0.type, 'I');
  const grid = g.grid();
  for (let c = 0; c < 10; c++) if (c < 3 || c > 6) grid[23][c] = 'J';
  const cur = g.current();
  cur.rot = 0;
  cur.x = 3;
  cur.y = 21;
  g.hardDrop();
  g.tick(0.3);
  assert.strictEqual(g.lines(), 1);
  assert.ok(g.score() >= 102, 'score should include single (100) + hard drop, got ' + g.score());
  assert.ok(g.grid()[23].every((c) => c === null), 'cleared row should be empty');
});

test('game: T-spin single detected, labeled, scored 800', () => {
  const events = [];
  const g = T.createGame({
    randomizerMode: 'random',
    rng: () => 2 / 7,
    onEvent: (ev) => events.push(ev)
  });
  g.start();
  const cur0 = g.current();
  assert.strictEqual(cur0.type, 'T');
  const grid = g.grid();
  for (let c = 0; c < 10; c++) grid[23][c] = 'J';
  grid[23][5] = null;
  for (let c = 0; c < 3; c++) grid[22][c] = 'J';
  grid[22][8] = 'J';
  grid[22][9] = 'J';
  grid[21][4] = 'J';
  const cur = g.current();
  cur.x = 4;
  cur.y = 20;
  cur.rot = 1;
  g.tick(1.05);
  let cur2 = g.current();
  assert.strictEqual(cur2.rot, 1);
  assert.strictEqual(cur2.y, 21);
  assert.strictEqual(g.rotate(1), true, 'in-place rotation into the slot must succeed');
  cur2 = g.current();
  assert.strictEqual(cur2.rot, 2);
  g.hardDrop();
  g.tick(0.3);
  assert.strictEqual(g.lines(), 1);
  const scoreEv = events.find((e) => e.type === 'score');
  assert.ok(scoreEv, 'expected a score event');
  assert.strictEqual(scoreEv.label, 'T-SPIN SINGLE');
  assert.strictEqual(scoreEv.gained, 800);
});

test('game: strict rotation refuses kick-dependent rotation', () => {
  const g = T.createGame({ randomizerMode: 'random', rng: () => 0, kicks: false });
  g.start();
  const cur = g.current();
  assert.strictEqual(cur.type, 'I');
  cur.x = -1;
  cur.y = 8;
  cur.rot = 3;
  assert.strictEqual(g.rotate(1), false, 'I at left wall: rot0 needs a kick');
  assert.strictEqual(g.current().rot, 3);
});

test('game: with kicks enabled, same rotation succeeds via kick', () => {
  const g = T.createGame({ randomizerMode: 'random', rng: () => 0, kicks: true });
  g.start();
  const cur = g.current();
  cur.x = -1;
  cur.y = 8;
  cur.rot = 3;
  assert.strictEqual(g.rotate(1), true, 'I at left wall should rotate via SRS kick');
  assert.strictEqual(g.current().rot, 0);
  assert.strictEqual(g.current().x, 0);
});

test('headless: 3 modes, 30s random play, invariants hold', () => {
  for (const mode of ['sliding', 'seven', 'random']) {
    const g = T.createGame({ randomizerMode: mode, rng: mulberry32(1111) });
    g.start();
    for (let i = 0; i < 1800; i++) {
      if (g.status() !== 'playing') { g.start(); continue; }
      const roll = ((i * 2654435761) % 97) / 97;
      if (roll < 0.25) g.move(-1);
      else if (roll < 0.5) g.move(1);
      else if (roll < 0.65) g.rotate(1);
      else if (roll < 0.75) g.rotate(-1);
      else if (roll < 0.85) g.hardDrop();
      else if (roll < 0.9) g.holdPiece();
      g.tick(1 / 60);
      const grid = g.grid();
      assert.strictEqual(grid.length, T.ROWS);
      for (const row of grid) assert.strictEqual(row.length, T.COLS);
      assert.ok(g.score() >= 0);
    }
    assert.ok(g.score() > 0, mode + ': should have scored from hard drops');
  }
});

test('speed curve: lock delay is 0.5s at L1, gravity floors at 12.5 rows/s and lock delay scales at high levels', () => {
  // 'random' mode + rng()===0 draws TYPES[0] ('I') every time
  const g = T.createGame({ randomizerMode: 'random', rng: () => 0 });
  g.start();

  // L1: grounded piece must NOT lock before 0.5s
  let cur = g.current();
  cur.x = 3; cur.y = 22; cur.rot = 0; // I horizontal, cells on bottom row
  g.tick(0.45);
  assert.strictEqual(g.current(), cur, 'L1: 450ms grounded must not lock');
  g.tick(0.1);
  assert.notStrictEqual(g.current(), cur, 'L1: 550ms grounded must lock');

  // Rig rows 20-23 with a 1-wide gap (col 4): a vertical I clears 4 lines
  const grid = g.grid();
  const rig = () => {
    for (let r = 20; r < 24; r++)
      for (let c = 0; c < T.COLS; c++)
        grid[r][c] = (c === 4) ? null : 'J';
  };
  rig();
  for (let i = 0; i < 28; i++) {
    const p = g.current();
    p.x = 2; p.y = 0; p.rot = 1; // vertical I, cells at col x+2 = 4 (the gap)
    g.hardDrop();
    g.tick(0.3);
    rig();
  }
  assert.strictEqual(g.lines(), 112);
  assert.strictEqual(g.level(), 12);

  // L12 gravity: raw guideline formula is 0.030s/row (33 rows/s); floor is 0.08 (12.5 rows/s)
  cur = g.current();
  cur.x = 3; cur.y = 0; cur.rot = 0;
  const y0 = cur.y;
  g.tick(1.0);
  const dropped = g.current().y - y0;
  assert.ok(dropped >= 10 && dropped <= 14, 'L12 gravity ~12 rows/s, got ' + dropped + ' rows/s');

  // L12 lock delay: floored at 0.2s, so a grounded piece locks well before L1's 0.5s
  const c2 = g.current();
  c2.x = 2; c2.y = 20; c2.rot = 1; // vertical I seated in the gap, grounded
  g.tick(0.25);
  assert.notStrictEqual(g.current(), c2, 'L12: grounded piece must lock within 250ms');
});

console.log(process.exitCode ? 'SOME TESTS FAILED' : 'ALL TESTS PASSED');
