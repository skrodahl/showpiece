'use strict';
// Shared helpers for the randomizer studies (not a test). The sliding 21-bag, 7-bag and pure random
// come from game.js; the others are reimplementations from public descriptions, using an ideal
// uniform RNG (no NES LFSR bias, no TGM first-piece rules).
const G = require(__dirname + '/../game.js');
const TYPES = G.TYPES;

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(a ^ (a >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffled(rng, src) {
  const b = src.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

// Sliding pool with `copies` of each type; after every `every` draws, `refill(k)` pieces are added.
// copies = 3, every = 7, refill = one of each is the production sliding 21-bag.
function slidingPool(rng, copies, schedule = [7], refill = () => TYPES) {
  const pool = [];
  for (let i = 0; i < copies; i++) pool.push(...TYPES);
  let step = 0, left = schedule[0];
  return () => {
    const p = pool.splice((rng() * pool.length) | 0, 1)[0];
    if (--left === 0) {
      pool.push(...refill(schedule[step % schedule.length]));
      step++; left = schedule[step % schedule.length];
    }
    return p;
  };
}

function historyRandomizer(rng, init, rolls) {
  const history = init.slice();
  return () => {
    let p;
    for (let roll = 0; roll < rolls; roll++) {
      p = TYPES[(rng() * 7) | 0];
      if (!history.includes(p)) break;
    }
    history.shift(); history.push(p);
    return p;
  };
}

const RANDOMIZERS = {
  sliding: rng => G.makeRandomizer('sliding', rng),
  seven: rng => G.makeRandomizer('seven', rng),
  // 2 of each, shuffled, dealt until empty
  fourteen: rng => {
    let bag = [];
    return () => { if (!bag.length) bag = shuffled(rng, TYPES.concat(TYPES)); return bag.pop(); };
  },
  random: rng => G.makeRandomizer('random', rng),
  // Idealized NES: roll 0-7; if 7 ("dummy") or same as previous, reroll 0-6 once and accept.
  nes: rng => {
    let prev = -1;
    return () => {
      let r = (rng() * 8) | 0;
      if (r === 7 || r === prev) r = (rng() * 7) | 0;
      prev = r;
      return TYPES[r];
    };
  },
  // TGM1: history of 4 (starts Z,Z,Z,Z), up to 4 rolls
  tgm1: rng => historyRandomizer(rng, ['Z', 'Z', 'Z', 'Z'], 4),
  // TGM2: history of 4 (starts Z,S,S,Z), up to 6 rolls
  tgm2: rng => historyRandomizer(rng, ['Z', 'S', 'S', 'Z'], 6),
  // TGM3: pool of 35 (5 of each), history of 4, up to 6 rolls; each roll that hits history, and the
  // final pick, replaces its pool slot with the most-droughted piece
  tgm3: rng => {
    const pool = [];
    for (let i = 0; i < 5; i++) pool.push(...TYPES);
    const history = ['S', 'Z', 'S', 'Z'];
    const order = TYPES.slice(); // front = longest since last seen
    return () => {
      let i, p;
      for (let roll = 0; roll < 6; roll++) {
        i = (rng() * 35) | 0; p = pool[i];
        if (!history.includes(p) || roll === 5) break;
        pool[i] = order[0];
      }
      order.splice(order.indexOf(p), 1); order.push(p);
      pool[i] = order[0];
      history.shift(); history.push(p);
      return p;
    };
  },
};

// Exact worst cases for a sliding pool of `copies` of each type, refilled with `sets` of each every 7*sets draws.
// Exhaustive search over one type's state: m = its copies in the pool, pos = draws into the refill cycle.
function slidingExactBounds(copies, sets = 1) {
  const size = 7 * copies, cycle = 7 * sets;
  const key = (m, pos) => m * cycle + pos;
  const step = (m, pos, drewIt) => {
    const m2 = drewIt ? m - 1 : m;
    return pos === cycle - 1 ? [m2 + sets, 0] : [m2, pos + 1];
  };
  const reach = new Set([key(copies, 0)]);
  const stack = [[copies, 0]];
  while (stack.length) {
    const [m, pos] = stack.pop();
    const nexts = [];
    if (m > 0) nexts.push(step(m, pos, true));
    if (size - pos - m > 0) nexts.push(step(m, pos, false));
    for (const [a, b] of nexts) if (!reach.has(key(a, b))) { reach.add(key(a, b)); stack.push([a, b]); }
  }
  const without = new Map(), run = new Map();
  const longestWithout = (m, pos) => {
    const k = key(m, pos);
    if (!without.has(k)) without.set(k, size - pos - m > 0 ? 1 + longestWithout(...step(m, pos, false)) : 0);
    return without.get(k);
  };
  const longestRun = (m, pos) => {
    const k = key(m, pos);
    if (!run.has(k)) run.set(k, m > 0 ? 1 + longestRun(...step(m, pos, true)) : 0);
    return run.get(k);
  };
  const r = { maxDrought: 0, maxRun: 0, maxCopiesInPool: 0, maxAhead: -Infinity, maxBehind: Infinity, reachableStates: reach.size };
  for (const k of reach) {
    const m = Math.floor(k / cycle), pos = k % cycle;
    r.maxDrought = Math.max(r.maxDrought, longestWithout(m, pos));
    r.maxRun = Math.max(r.maxRun, longestRun(m, pos));
    r.maxCopiesInPool = Math.max(r.maxCopiesInPool, m);
    // after j cycles + pos draws: supplied = copies + j*sets, dealt = supplied - m, fair share = j*sets + pos/7
    const dev = copies - m - pos / 7;
    r.maxAhead = Math.max(r.maxAhead, dev);
    r.maxBehind = Math.min(r.maxBehind, dev);
  }
  return r;
}

module.exports = { TYPES, mulberry32, shuffled, slidingPool, RANDOMIZERS, slidingExactBounds };
