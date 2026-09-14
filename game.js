'use strict';

const COLS = 10;
const VISIBLE_ROWS = 20;
const HIDDEN_ROWS = 4;
const ROWS = VISIBLE_ROWS + HIDDEN_ROWS;
const DAS = 0.2;
const ARR = 0.033;
const LOCK_DELAY = 0.5;
const MIN_LOCK_DELAY = 0.2;
const LOCK_DECAY = 0.03;
const MIN_SPEED = 0.08;
const SOFT_DROP_HOLD = 0.15;
const CLEAR_TIME = 0.22;

const PIECES = {
  I: { n: 4, cells: [[0, 1], [1, 1], [2, 1], [3, 1]] },
  O: { n: 2, cells: [[0, 0], [1, 0], [0, 1], [1, 1]] },
  T: { n: 3, cells: [[1, 0], [0, 1], [1, 1], [2, 1]] },
  S: { n: 3, cells: [[1, 0], [2, 0], [0, 1], [1, 1]] },
  Z: { n: 3, cells: [[0, 0], [1, 0], [1, 1], [2, 1]] },
  J: { n: 3, cells: [[0, 0], [0, 1], [1, 1], [2, 1]] },
  L: { n: 3, cells: [[2, 0], [0, 1], [1, 1], [2, 1]] }
};
const TYPES = Object.keys(PIECES);

const COLORS = {
  I: '#4dd8f0',
  O: '#f8c844',
  T: '#b57bee',
  S: '#5fd492',
  Z: '#f4737c',
  J: '#6193f0',
  L: '#f5a054'
};

const SHAPES = {};
for (const t of TYPES) {
  const n = PIECES[t].n;
  const states = [PIECES[t].cells.map(c => c.slice())];
  for (let i = 1; i < 4; i++) {
    states.push(states[i - 1].map(([x, y]) => [n - 1 - y, x]));
  }
  SHAPES[t] = states;
}

const KICKS_JLSTZ = {
  '0>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '1>0': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '1>2': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
  '2>1': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
  '2>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
  '3>2': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '3>0': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
  '0>3': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]]
};

const KICKS_I = {
  '0>1': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '1>0': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '1>2': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]],
  '2>1': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '2>3': [[0, 0], [2, 0], [-1, 0], [2, -1], [-1, 2]],
  '3>2': [[0, 0], [-2, 0], [1, 0], [-2, 1], [1, -2]],
  '3>0': [[0, 0], [1, 0], [-2, 0], [1, 2], [-2, -1]],
  '0>3': [[0, 0], [-1, 0], [2, 0], [-1, -2], [2, 1]]
};

function makeRandomizer(mode, rng, params = {}) {
  if (mode === 'random') {
    const draw = () => TYPES[(rng() * TYPES.length) | 0];
    draw.inspect = () => ({ mode: 'random', n: null, k: null, counts: null, size: null, drawsUntilRefill: null });
    return draw;
  }
  if (mode === 'seven') {
    let bag = [];
    const draw = () => {
      if (!bag.length) {
        bag = TYPES.slice();
        for (let i = bag.length - 1; i > 0; i--) {
          const j = (rng() * (i + 1)) | 0;
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
      }
      return bag.pop();
    };
    draw.inspect = () => {
      const counts = {};
      for (const t of TYPES) counts[t] = 0;
      for (const t of bag) counts[t]++;
      return { mode: 'seven', n: 1, k: 1, counts, size: bag.length, drawsUntilRefill: bag.length };
    };
    return draw;
  }
  const n = params.n ?? 3;
  const k = params.k ?? 1;
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 1 || n > 8 || k < 1 || k > n)
    throw new RangeError('sliding: n and k must be integers with 1 <= k <= n <= 8');
  let pool = [];
  for (let i = 0; i < n; i++) for (const t of TYPES) pool.push(t);
  let drawn = 0;
  const draw = () => {
    const p = pool.splice((rng() * pool.length) | 0, 1)[0];
    if (++drawn % (7 * k) === 0) for (let s = 0; s < k; s++) for (const t of TYPES) pool.push(t);
    return p;
  };
  draw.inspect = () => {
    const counts = {};
    for (const t of TYPES) counts[t] = 0;
    for (const t of pool) counts[t]++;
    return { mode: 'sliding', n, k, counts, size: pool.length, drawsUntilRefill: 7 * k - (drawn % (7 * k)) };
  };
  return draw;
}

function slidingBounds(n, k) {
  if (!Number.isInteger(n) || !Number.isInteger(k) || n < 1 || n > 8 || k < 1 || k > n)
    throw new RangeError('slidingBounds: n and k must be integers with 1 <= k <= n <= 8');
  const J = Math.floor((7 * n) / k) - 7;
  return {
    maxDrought: 7 * n + 5 * k + 6 * k * J,
    maxRun: 7 * n - 5 * k + k * Math.floor((7 * (n - k)) / (6 * k)),
    maxAhead: n - k / 7,
    maxBehind: 6 * (n - k) + 6 * k / 7
  };
}

function createRandomizerStats() {
  let total = 0;
  const counts = {};
  const lastSeen = {};
  for (const t of TYPES) { counts[t] = 0; lastSeen[t] = -1; }
  let longestDrought = { length: 0, piece: null };
  let longestRun = { length: 0, piece: null };
  let runPiece = null;
  let runLen = 0;
  let biggestFlood = { count: 0, piece: null };
  let recent = [];
  const recentCounts = {};
  for (const t of TYPES) recentCounts[t] = 0;

  function reset() {
    total = 0;
    for (const t of TYPES) { counts[t] = 0; lastSeen[t] = -1; }
    longestDrought = { length: 0, piece: null };
    longestRun = { length: 0, piece: null };
    runPiece = null;
    runLen = 0;
    biggestFlood = { count: 0, piece: null };
    recent = [];
    for (const t of TYPES) recentCounts[t] = 0;
  }

  function observe(piece) {
    total++;
    counts[piece]++;
    lastSeen[piece] = total;
    if (piece === runPiece) runLen++;
    else { runPiece = piece; runLen = 1; }
    if (runLen > longestRun.length) longestRun = { length: runLen, piece: runPiece };
    recent.push(piece);
    recentCounts[piece]++;
    if (recent.length > 7) recentCounts[recent.shift()]--;
    for (const t of TYPES) if (recentCounts[t] > biggestFlood.count) biggestFlood = { count: recentCounts[t], piece: t };
    let maxSince = 0;
    let maxPiece = null;
    for (const t of TYPES) {
      const since = lastSeen[t] === -1 ? total : total - lastSeen[t];
      if (since > maxSince) { maxSince = since; maxPiece = t; }
    }
    if (maxSince > longestDrought.length) longestDrought = { length: maxSince, piece: maxPiece };
  }

  function snapshot() {
    const c = {};
    const since = {};
    for (const t of TYPES) {
      c[t] = counts[t];
      since[t] = lastSeen[t] === -1 ? total : total - lastSeen[t];
    }
    return {
      total,
      counts: c,
      sinceLastSeen: since,
      longestDrought: { length: longestDrought.length, piece: longestDrought.piece },
      longestRun: { length: longestRun.length, piece: longestRun.piece },
      biggestFlood: { count: biggestFlood.count, piece: biggestFlood.piece }
    };
  }

  return { observe, reset, snapshot };
}

function createGame(opts = {}) {
  const rng = opts.rng || Math.random;
  const onEvent = opts.onEvent || (() => {});
  let randomizerMode = opts.randomizerMode || 'sliding';
  let randomizerParams = opts.randomizerParams || {};
  let randomizer = makeRandomizer(randomizerMode, rng, randomizerParams);
  let kicks = opts.kicks === true;

  function clampPreview(len) {
    const v = Math.round(len);
    return Number.isFinite(v) ? Math.max(0, Math.min(5, v)) : 5;
  }
  let previewLength = clampPreview(opts.previewLength === undefined ? 5 : opts.previewLength);

  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(null));

  let queue = [];
  let holdType = null;
  let canHold = true;
  let current = null;
  let status = 'ready';
  let clearing = null;
  let score = 0;
  let lines = 0;
  let level = 1;
  let combo = 0;
  let b2b = false;
  let lockTimer = 0;
  let lockResets = 0;
  let gravityAcc = 0;
  let softDrop = false;
  let softDropHoldT = 0;
  let prevSoftActive = false;
  let lastMoveWasRotation = false;

  function cellsOf(p) {
    return SHAPES[p.type][p.rot].map(([x, y]) => [p.x + x, p.y + y]);
  }

  function collides(cells) {
    for (const [x, y] of cells) {
      if (x < 0 || x >= COLS || y >= ROWS) return true;
      if (y >= 0 && grid[y][x]) return true;
    }
    return false;
  }

  function canFall() {
    if (!current) return false;
    return !collides(cellsOf(current).map(([x, y]) => [x, y + 1]));
  }

  function refillQueue() {
    while (queue.length < Math.max(1, previewLength)) queue.push(randomizer());
  }

  function gameOver() {
    status = 'over';
    onEvent({ type: 'gameover', score, lines, level });
  }

  function inGame() {
    return status === 'playing' || status === 'paused';
  }

  function spawn(type) {
    const t = type === undefined ? queue.shift() : type;
    if (type === undefined) {
      refillQueue();
      onEvent({ type: 'deal', piece: t });
    }
    const n = PIECES[t].n;
    current = { type: t, rot: 0, x: Math.floor((COLS - n) / 2), y: HIDDEN_ROWS - 2 };
    canHold = true;
    lockTimer = 0;
    lockResets = 0;
    gravityAcc = 0;
    lastMoveWasRotation = false;
    if (collides(cellsOf(current))) {
      gameOver();
      return;
    }
    // Drop one row immediately so the piece's bottom row is visible on entry
    if (canFall()) current.y++;
    onEvent({ type: 'spawn' });
  }

  function detectTSpin() {
    if (!current || current.type !== 'T' || !lastMoveWasRotation) return null;
    const cx = current.x + 1;
    const cy = current.y + 1;
    const filled = (x, y) => x < 0 || x >= COLS || y >= ROWS || (y >= 0 && grid[y][x]);
    const corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
    const count = corners.filter(([dx, dy]) => filled(cx + dx, cy + dy)).length;
    if (count < 3) return null;
    const front = {
      0: [[-1, -1], [1, -1]],
      1: [[1, -1], [1, 1]],
      2: [[-1, 1], [1, 1]],
      3: [[-1, -1], [-1, 1]]
    }[current.rot];
    return { mini: front.every(([dx, dy]) => !filled(cx + dx, cy + dy)) };
  }

  function applyLockScore(nLines, tspin) {
    let gained = 0;
    let label = null;
    let b2bHit = false;
    const names = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'];
    if (nLines === 0) {
      if (tspin) {
        gained = tspin.mini ? 100 : 400 * level;
        label = tspin.mini ? 'T-SPIN MINI' : 'T-SPIN';
      }
      combo = 0;
    } else {
      const difficult = nLines === 4 || (tspin && !tspin.mini);
      if (tspin) {
        gained = tspin.mini
          ? (nLines === 1 ? 200 : 400) * level
          : [0, 800, 1200, 1600][nLines] * level;
        label = (tspin.mini ? 'T-SPIN MINI ' : 'T-SPIN ') + names[nLines];
      } else {
        gained = [0, 100, 300, 500, 800][nLines] * level;
        label = names[nLines];
      }
      if (difficult) {
        if (b2b) {
          gained = Math.round(gained * 1.5);
          b2bHit = true;
        }
        b2b = true;
      } else {
        b2b = false;
      }
      combo += 1;
      if (combo >= 2) gained += 50 * (combo - 1) * level;
    }
    score += gained;
    if (gained > 0 || label) {
      onEvent({ type: 'score', gained, label, b2b: b2bHit, combo: combo >= 2 ? combo : 0, lines: nLines });
    }
  }

  function finishClear() {
    const rows = clearing.rows.slice().sort((a, b) => a - b);
    const tspin = clearing.tspin;
    for (const r of rows) {
      grid.splice(r, 1);
      grid.unshift(new Array(COLS).fill(null));
    }
    clearing = null;
    lines += rows.length;
    const prevLevel = level;
    level = Math.floor(lines / 10) + 1;
    applyLockScore(rows.length, tspin);
    if (level > prevLevel) onEvent({ type: 'levelup', level });
    spawn();
  }

  function lockPiece() {
    const cells = cellsOf(current);
    const topOut = cells.every(([x, y]) => y < HIDDEN_ROWS);
    const tspin = detectTSpin();
    for (const [x, y] of cells) if (y >= 0) grid[y][x] = current.type;
    current = null;
    canHold = false;
    let full = [];
    for (let r = 0; r < ROWS; r++) if (grid[r].every(Boolean)) full.push(r);
    if (full.length) {
      clearing = { rows: full, t: 0, tspin };
      onEvent({ type: 'clearing', rows: full });
      return;
    }
    onEvent({ type: 'lock' });
    applyLockScore(0, tspin);
    if (topOut) {
      gameOver();
      return;
    }
    spawn();
  }

  function commitShift() {
    if (!canFall()) {
      if (lockResets < 15) {
        lockTimer = 0;
        lockResets++;
      } else {
        lockPiece();
      }
    } else {
      lockTimer = 0;
      lockResets = 0;
    }
  }

  function move(dx) {
    if (status !== 'playing' || !current || clearing) return false;
    if (collides(cellsOf(current).map(([x, y]) => [x + dx, y]))) return false;
    current.x += dx;
    lastMoveWasRotation = false;
    commitShift();
    return current !== null;
  }

  function rotate(dir) {
    if (status !== 'playing' || !current || clearing) return false;
    if (current.type === 'O') return true;
    const from = current.rot;
    const to = (from + dir + 4) % 4;
    const table = current.type === 'I' ? KICKS_I : KICKS_JLSTZ;
    const offsets = kicks ? table[from + '>' + to] : [[0, 0]];
    for (const [ox, oy] of offsets) {
      const cells = SHAPES[current.type][to].map(([x, y]) => [current.x + x + ox, current.y + y + oy]);
      if (!collides(cells)) {
        current.rot = to;
        current.x += ox;
        current.y += oy;
        lastMoveWasRotation = true;
        commitShift();
        return current !== null;
      }
    }
    return false;
  }

  function hardDrop() {
    if (status !== 'playing' || !current || clearing) return 0;
    let d = 0;
    while (canFall()) {
      current.y++;
      d++;
    }
    score += d * 2;
    onEvent({ type: 'harddrop', d });
    lockPiece();
    return d;
  }

  function holdPiece() {
    if (status !== 'playing' || !current || clearing || !canHold) return false;
    const t = current.type;
    const prev = holdType;
    holdType = t;
    canHold = false;
    onEvent({ type: 'hold' });
    if (prev) spawn(prev);
    else spawn();
    canHold = false;
    return true;
  }

  function softDropStep() {
    if (status !== 'playing' || !current || clearing) return;
    if (canFall()) {
      current.y++;
      score += 1;
      lockTimer = 0;
      lockResets = 0;
      lastMoveWasRotation = false;
    }
  }

  function tick(dt) {
    if (status !== 'playing') return;
    if (clearing) {
      clearing.t += dt;
      if (clearing.t >= CLEAR_TIME) finishClear();
      return;
    }
    if (!current) return;
    const speed = Math.max(MIN_SPEED, Math.pow(0.8 - (level - 1) * 0.007, level - 1));
    if (softDrop) softDropHoldT += dt;
    else softDropHoldT = 0;
    const softActive = softDrop && softDropHoldT >= SOFT_DROP_HOLD;
    if (softActive !== prevSoftActive) {
      gravityAcc = 0;
      prevSoftActive = softActive;
    }
    const interval = softActive ? Math.min(speed, 0.1) : speed;
    gravityAcc += dt;
    let moved = false;
    while (gravityAcc >= interval) {
      gravityAcc -= interval;
      if (canFall()) {
        current.y++;
        moved = true;
        if (softActive) score += 1;
      } else break;
    }
    if (moved) {
      lockTimer = 0;
      lockResets = 0;
      lastMoveWasRotation = false;
    }
    if (!canFall() && !moved) {
      lockTimer += dt;
      const lockDelay = Math.max(MIN_LOCK_DELAY, LOCK_DELAY - (level - 1) * LOCK_DECAY);
      if (lockTimer >= lockDelay) lockPiece();
    }
  }

  function resetAll() {
    randomizer = makeRandomizer(randomizerMode, rng, randomizerParams);
    for (let r = 0; r < ROWS; r++) grid[r].fill(null);
    queue = [];
    refillQueue();
    holdType = null;
    canHold = true;
    current = null;
    clearing = null;
    score = 0;
    lines = 0;
    level = 1;
    combo = 0;
    b2b = false;
    lockTimer = 0;
    lockResets = 0;
    gravityAcc = 0;
    softDrop = false;
    softDropHoldT = 0;
    prevSoftActive = false;
    lastMoveWasRotation = false;
    spawn();
  }

  function start() {
    resetAll();
    status = 'playing';
    onEvent({ type: 'start' });
  }

  function pause() {
    if (status === 'playing') {
      status = 'paused';
      onEvent({ type: 'pause' });
    }
  }

  function resume() {
    if (status === 'paused') {
      status = 'playing';
      onEvent({ type: 'resume' });
    }
  }

  function randomizerInfo() {
    const info = randomizer.inspect();
    const hidden = queue.slice(previewLength);
    info.hidden = hidden.length;
    if (info.counts) {
      const counts = {};
      for (const t of TYPES) counts[t] = info.counts[t];
      for (const t of hidden) counts[t]++;
      info.counts = counts;
      info.size += hidden.length;
    }
    return info;
  }

  return {
    status() { return status; },
    grid: () => grid,
    current() { return current; },
    queue: () => queue.slice(),
    holdType() { return holdType; },
    canHold() { return canHold; },
    score() { return score; },
    lines() { return lines; },
    level() { return level; },
    clearing() { return clearing; },
    kicks() { return kicks; },
    start,
    pause,
    resume,
    tick,
    move,
    rotate,
    hardDrop,
    softDropStep,
    holdPiece,
    setSoftDrop(v) { softDrop = !!v; },
    setKicks(v) { kicks = !!v; },
    setRandomizerMode(mode, params = {}) {
      randomizerMode = mode;
      randomizerParams = params;
      randomizer = makeRandomizer(mode, rng, randomizerParams);
      queue = [];
      if (inGame()) refillQueue();
    },
    previewLength() { return previewLength; },
    setPreviewLength(len) { previewLength = clampPreview(len); if (inGame()) refillQueue(); },
    randomizerInfo
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { createGame, makeRandomizer, slidingBounds, createRandomizerStats, PIECES, SHAPES, TYPES, COLORS, KICKS_JLSTZ, KICKS_I, COLS, ROWS, HIDDEN_ROWS, VISIBLE_ROWS };
}

if (typeof document !== 'undefined') {
  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v === null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, JSON.stringify(v));
      } catch (e) {}
    }
  };

  const boardCanvas = document.getElementById('board');
  const holdCard = document.getElementById('holdCard');
  const holdCanvas = document.getElementById('holdCanvas');
  const nextCanvas = document.getElementById('nextCanvas');
  const overlay = document.getElementById('overlay');
  const boardWrap = document.getElementById('boardWrap');
  const scoreEl = document.getElementById('scoreVal');
  const bestEl = document.getElementById('bestVal');
  const linesEl = document.getElementById('linesVal');
  const levelEl = document.getElementById('levelVal');
  const randSel = document.getElementById('randSel');
  const slidingOpts = document.getElementById('slidingOpts');
  const poolSel = document.getElementById('poolSel');
  const refillSel = document.getElementById('refillSel');
  const boundsNote = document.getElementById('boundsNote');
  const previewSel = document.getElementById('previewSel');
  const nextCard = document.getElementById('nextCard');
  const kicksChk = document.getElementById('kicksChk');
  const analytics = document.getElementById('analytics');
  const analyticsChk = document.getElementById('analyticsChk');
  const playfield = document.getElementById('playfield');
  const controlsCard = document.getElementById('controlsCard');
  const newGameBtn = document.getElementById('newGameBtn');
  const soundBtn = document.getElementById('soundBtn');
  const musicBtn = document.getElementById('musicBtn');

  const CELL = 32;
  const BW = COLS * CELL;
  const BH = VISIBLE_ROWS * CELL;

  function setupCanvas(canvas, w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  let randMode = store.get('showpiece.randomizer', 'sliding');
  let slidingN = store.get('showpiece.slidingN', 3);
  if ([2, 3, 4].indexOf(slidingN) < 0) slidingN = 3;
  let slidingK = store.get('showpiece.slidingK', 1);
  if (!Number.isInteger(slidingK) || slidingK < 1 || slidingK > slidingN) slidingK = 1;
  let previewLen = store.get('showpiece.preview', 3);
  if (!Number.isInteger(previewLen) || previewLen < 0 || previewLen > 5) previewLen = 3;

  const bctx = setupCanvas(boardCanvas, BW, BH);
  const hctx = setupCanvas(holdCanvas, 92, 56);
  let nctx = setupCanvas(nextCanvas, 92, 56 * Math.max(1, previewLen));

  const P99_GAP = { seven: 12, random: 29, sliding: { '2,1': 21, '2,2': 18, '3,1': 23, '3,2': 22, '3,3': 21, '4,1': 25, '4,2': 24, '4,3': 23, '4,4': 22 } };

  const AC = window.AudioContext || window.webkitAudioContext;
  let actx = null;
  let master = null;
  let muted = store.get('showpiece.muted', false);

  function ensureAudio() {
    if (!AC || actx) return;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(actx.destination);
  }

  function beep(f, dur, type, vol, slideTo) {
    if (!actx || muted) return;
    const t0 = actx.currentTime;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol || 0.12, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.03);
  }

  const SFX = {
    move() { beep(250, 0.05, 'square', 0.05); },
    rotate() { beep(330, 0.08, 'square', 0.08, 520); },
    reject() { beep(120, 0.07, 'square', 0.05, 80); },
    drop() { beep(150, 0.1, 'triangle', 0.22, 60); },
    lock() { beep(180, 0.06, 'triangle', 0.1); },
    hold() { beep(500, 0.07, 'sine', 0.12, 660); },
    clear(n) {
      const notes = [523, 659, 784, 1047];
      for (let i = 0; i < Math.min(n + 1, 4); i++) {
        setTimeout(() => beep(notes[i], 0.12, 'square', 0.1), i * 55);
      }
      if (n >= 4) beep(65, 0.35, 'triangle', 0.3, 40);
    },
    tspin() {
      beep(880, 0.07, 'square', 0.1);
      setTimeout(() => beep(1175, 0.09, 'square', 0.1), 70);
    },
    levelup() {
      beep(330, 0.4, 'sawtooth', 0.08, 990);
    },
    over() {
      [392, 330, 262, 196].forEach((f, i) => setTimeout(() => beep(f, 0.22, 'triangle', 0.12), i * 160));
    }
  };

  // Korobeiniki, the original Russian folk song, scored in A minor.
  // Each entry: [freq, beats]; 32 beats per 8-bar loop.
  const MELODY = [
    [659.25, 1.5], [830.61, 0.5], [987.77, 1], [830.61, 0.5], [659.25, 0.5],
    [880, 1.5], [1046.5, 0.5], [1318.51, 1], [1174.66, 0.5], [1046.5, 0.5],
    [987.77, 1.5], [1046.5, 0.5], [1174.66, 1], [1318.51, 1],
    [1046.5, 1], [880, 1], [880, 2],
    [1244.51, 1.5], [1567.98, 0.5], [1760, 1], [1567.98, 0.5], [1244.51, 0.5],
    [1318.51, 1.5], [1244.51, 0.5], [1318.51, 1], [1174.66, 0.5], [1046.5, 0.5],
    [987.77, 1.5], [1046.5, 0.5], [1174.66, 1], [1318.51, 1],
    [1046.5, 1], [880, 1], [880, 2]
  ];
  // Eighth-note bass, one root per bar: Em Am Bm C F Am Bm C
  const BASS = [];
  for (const f of [329.63, 220, 246.94, 261.63, 349.23, 220, 246.94, 261.63])
    for (let i = 0; i < 8; i++) BASS.push([f, 0.5]);

  let musicOn = store.get('showpiece.music', true);

  function playNote(f, t, dur, type, vol) {
    if (!actx) return;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    const d = Math.max(0.09, dur * 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.setValueAtTime(vol, t + Math.min(d * 0.7, d - 0.03));
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g);
    g.connect(master);
    o.start(t);
    o.stop(t + d + 0.05);
  }

  const MUSIC = {
    on: false,
    timer: null,
    mIdx: 0,
    bIdx: 0,
    mAt: 0,
    bAt: 0,
    beat() { return Math.max(0.28, 0.42 / (1 + 0.06 * (game.level() - 1))); },
    schedule() {
      const ahead = actx.currentTime + 0.3;
      const bd = this.beat();
      while (this.mAt < ahead) {
        const n = MELODY[this.mIdx];
        const d = n[1] * bd;
        playNote(n[0], this.mAt, d, 'square', 0.05);
        this.mAt += d;
        this.mIdx = (this.mIdx + 1) % MELODY.length;
      }
      while (this.bAt < ahead) {
        const n = BASS[this.bIdx];
        const d = n[1] * bd;
        playNote(n[0], this.bAt, d, 'triangle', 0.1);
        this.bAt += d;
        this.bIdx = (this.bIdx + 1) % BASS.length;
      }
    },
    start() {
      if (this.on || !actx) return;
      this.on = true;
      this.mIdx = 0;
      this.bIdx = 0;
      const t0 = actx.currentTime + 0.08;
      this.mAt = t0;
      this.bAt = t0;
      this.schedule();
      this.timer = setInterval(() => this.schedule(), 50);
    },
    stop() {
      if (!this.on) return;
      this.on = false;
      clearInterval(this.timer);
      this.timer = null;
    }
  };

  const game = createGame({
    randomizerMode: randMode,
    randomizerParams: randMode === 'sliding' ? { n: slidingN, k: slidingK } : {},
    previewLength: previewLen,
    kicks: store.get('showpiece.kicks', false),
    onEvent: handleEvent
  });

  randSel.value = randMode;
  poolSel.value = String(slidingN);
  buildRefillOptions(slidingN);
  refillSel.value = String(slidingK);
  previewSel.value = String(previewLen);
  slidingOpts.hidden = randMode !== 'sliding';
  nextCard.hidden = previewLen === 0;
  updateBoundsNote();
  kicksChk.checked = store.get('showpiece.kicks', false);

  let analyticsOn = store.get('showpiece.analytics', false);
  const stats = createRandomizerStats();
  analyticsChk.checked = analyticsOn;
  analytics.hidden = !analyticsOn;
  if (analyticsOn) { placeAnalytics(); renderAnalytics(); }
  soundBtn.classList.toggle('off', muted);
  musicBtn.classList.toggle('off', !musicOn);
  bestEl.textContent = store.get('showpiece.best', 0);

  const LT_KEY = 'showpiece.lifetime';
  function getLifetime() {
    return Object.assign({ games: 0, lines: 0, tspins: 0, combo: 0, seconds: 0 }, store.get(LT_KEY, null));
  }
  function fmtTime(s) {
    s = Math.max(0, Math.round(s));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const r = s % 60;
    if (h > 0) return h + ':' + (m < 10 ? '0' : '') + m + ':' + (r < 10 ? '0' : '') + r;
    return m > 0 ? m + ':' + (r < 10 ? '0' : '') + r : r + 's';
  }
  let session = { tspins: 0, combo: 0, seconds: 0 };

  const parts = [];

  function popup(main, sub, color, comboN) {
    const el = document.createElement('div');
    el.className = 'popup';
    if (color) el.style.setProperty('--pc', color);
    const m = document.createElement('div');
    m.className = 'p-main';
    m.textContent = main;
    el.appendChild(m);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'p-sub';
      s.textContent = sub;
      el.appendChild(s);
    }
    if (comboN) {
      const c = document.createElement('div');
      c.className = 'p-combo';
      c.textContent = 'COMBO \u00D7' + comboN;
      el.appendChild(c);
    }
    boardWrap.appendChild(el);
    el.addEventListener('animationend', () => el.remove());
  }

  function buildRefillOptions(n) {
    refillSel.innerHTML = '';
    for (let k = 1; k <= n; k++) {
      const o = document.createElement('option');
      o.value = String(k);
      o.textContent = 7 * k + ' every ' + 7 * k;
      refillSel.appendChild(o);
    }
  }

  function updateBoundsNote() {
    if (randMode === 'sliding') {
      const b = slidingBounds(slidingN, slidingK);
      boundsNote.textContent = 'worst case: drought ' + b.maxDrought + ' \u00B7 run ' + b.maxRun;
    } else if (randMode === 'seven') {
      boundsNote.textContent = 'worst case: drought 12 \u00B7 run 2';
    } else {
      boundsNote.textContent = 'no worst case (memoryless)';
    }
  }

  function readySubtitle() {
    let label;
    if (randMode === 'sliding') {
      label = 'sliding ' + 7 * slidingN + '-bag' + (slidingK > 1 ? ' \u00B7 refill ' + 7 * slidingK : '');
    } else if (randMode === 'seven') {
      label = '7-bag';
    } else {
      label = 'pure random';
    }
    return label + ' \u00B7 strict rotation';
  }

  function showOverlay(kind) {
    let html;
    if (kind === 'ready') {
      html = '<div class="ov-card"><div class="ov-logo">SHOWPIECE</div>' +
        '<div class="ov-sub">' + readySubtitle() + '</div>' +
        '<div class="ov-hint">press any key to start</div></div>';
    } else if (kind === 'paused') {
      html = '<div class="ov-card"><div class="ov-h1">PAUSED</div>' +
        '<div class="ov-hint">P to resume</div></div>';
    } else {
      const best = store.get('showpiece.best', 0);
      const newBest = game.score() > best;
      const lt = getLifetime();
      html = '<div class="ov-card"><div class="ov-h1">GAME OVER</div>' +
        '<div class="ov-stats">' +
        '<span>Score</span><b>' + game.score() + '</b>' +
        '<span>Best</span><b>' + Math.max(best, game.score()) + (newBest ? '<span class="new">NEW</span>' : '') + '</b>' +
        '<span>Lines</span><b>' + game.lines() + '</b>' +
        '<span>Level</span><b>' + game.level() + '</b>' +
        '<span>Time</span><b>' + fmtTime(session.seconds) + '</b>' +
        '<div class="sep">All-time</div>' +
        '<span>Games</span><b>' + lt.games + '</b>' +
        '<span>Lines</span><b>' + lt.lines + '</b>' +
        '<span>T-spins</span><b>' + lt.tspins + '</b>' +
        '<span>Best combo</span><b>' + (lt.combo >= 2 ? '\u00D7' + lt.combo : '\u2014') + '</b>' +
        '<span>Time</span><b>' + fmtTime(lt.seconds) + '</b>' +
        '</div>' +
        '<div class="ov-hint">Enter to play again</div></div>';
    }
    overlay.innerHTML = html;
    overlay.hidden = false;
  }

  function hideOverlay() {
    overlay.hidden = true;
  }

  function handleEvent(ev) {
    switch (ev.type) {
      case 'clearing':
        for (const r of ev.rows) {
          for (let c = 0; c < COLS; c++) {
            const t = game.grid()[r][c];
            const col = COLORS[t] || '#ffffff';
            for (let i = 0; i < 3; i++) {
              parts.push({
                x: (c + 0.5) * CELL,
                y: (r - HIDDEN_ROWS + 0.5) * CELL,
                vx: (Math.random() - 0.5) * 300,
                vy: (Math.random() - 0.95) * 340,
                g: 780,
                life: 0.45 + Math.random() * 0.4,
                t: 0,
                size: 2 + Math.random() * 3.5,
                color: col
              });
            }
          }
        }
        break;
      case 'score': {
        const color = ev.label && ev.label.indexOf('T-SPIN') === 0 ? COLORS.T
          : ev.label === 'QUAD' ? COLORS.I
          : COLORS.J;
        let main = ev.label || '';
        if (ev.b2b && main) main = 'B2B ' + main;
        if (main) popup(main, '+' + ev.gained, color, ev.combo || 0);
        if (ev.label && ev.label.indexOf('T-SPIN') === 0) {
          session.tspins++;
          if (ev.lines === 0) SFX.tspin();
        }
        if (ev.lines > 0) SFX.clear(ev.lines);
        if (ev.combo > session.combo) session.combo = ev.combo;
        scoreEl.textContent = game.score();
        scoreEl.classList.remove('bump');
        void scoreEl.offsetWidth;
        scoreEl.classList.add('bump');
        linesEl.textContent = game.lines();
        levelEl.textContent = game.level();
        break;
      }
      case 'harddrop':
        SFX.drop();
        boardWrap.classList.remove('shake');
        void boardWrap.offsetWidth;
        boardWrap.classList.add('shake');
        break;
      case 'lock':
        if (!game.clearing()) SFX.lock();
        break;
      case 'levelup':
        popup('LEVEL ' + ev.level, null, COLORS.O);
        SFX.levelup();
        boardWrap.classList.remove('flash');
        void boardWrap.offsetWidth;
        boardWrap.classList.add('flash');
        break;
      case 'gameover': {
        MUSIC.stop();
        const best = store.get('showpiece.best', 0);
        if (game.score() > best) store.set('showpiece.best', game.score());
        bestEl.textContent = Math.max(best, game.score());
        const lt = getLifetime();
        lt.games += 1;
        lt.lines += game.lines();
        lt.tspins += session.tspins;
        lt.combo = Math.max(lt.combo, session.combo);
        lt.seconds += session.seconds;
        store.set(LT_KEY, lt);
        SFX.over();
        setTimeout(() => showOverlay('over'), 450);
        break;
      }
      case 'deal':
        try {
          stats.observe(ev.piece);
          if (analyticsOn) renderAnalytics();
        } catch (err) {
          console.error(err);
        }
        break;
      case 'start':
        hideOverlay();
        session = { tspins: 0, combo: 0, seconds: 0 };
        if (musicOn) MUSIC.start();
        try {
          if (analyticsOn) renderAnalytics();
        } catch (err) {
          console.error(err);
        }
        break;
      case 'pause':
        showOverlay('paused');
        MUSIC.stop();
        break;
      case 'resume':
        hideOverlay();
        if (musicOn) MUSIC.start();
        break;
      case 'hold':
        SFX.hold();
        break;
    }
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    if (amt >= 0) {
      r += (255 - r) * amt;
      g += (255 - g) * amt;
      b += (255 - b) * amt;
    } else {
      r *= 1 + amt;
      g *= 1 + amt;
      b *= 1 + amt;
    }
    return 'rgb(' + (r | 0) + ',' + (g | 0) + ',' + (b | 0) + ')';
  }

  function rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawTile(ctx, x, y, s, color, o) {
    o = o || {};
    const inset = s * 0.05;
    const x0 = x + inset, y0 = y + inset;
    const s2 = s - inset * 2;
    const r = s * 0.2;
    ctx.save();
    ctx.globalAlpha = o.alpha || 1;
    if (o.glow) {
      ctx.shadowColor = rgba(color, 0.85);
      ctx.shadowBlur = s * 0.55;
    }
    const g = ctx.createLinearGradient(0, y0, 0, y0 + s2);
    g.addColorStop(0, shade(color, 0.42));
    g.addColorStop(0.45, color);
    g.addColorStop(1, shade(color, -0.38));
    rr(ctx, x0, y0, s2, s2, r);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    const g2 = ctx.createLinearGradient(0, y0, 0, y0 + s2 * 0.55);
    g2.addColorStop(0, 'rgba(255,255,255,0.5)');
    g2.addColorStop(1, 'rgba(255,255,255,0)');
    rr(ctx, x0 + s2 * 0.12, y0 + s2 * 0.07, s2 * 0.76, s2 * 0.42, r * 0.8);
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1;
    rr(ctx, x0 + 0.5, y0 + 0.5, s2 - 1, s2 - 1, r);
    ctx.stroke();
    ctx.restore();
  }

  function drawMini(ctx, cw, ch, type, alpha) {
    ctx.clearRect(0, 0, cw, ch);
    if (!type) return;
    const cells = SHAPES[type][0];
    let minx = 9, maxx = -9, miny = 9, maxy = -9;
    for (const [x, y] of cells) {
      minx = Math.min(minx, x);
      maxx = Math.max(maxx, x);
      miny = Math.min(miny, y);
      maxy = Math.max(maxy, y);
    }
    const s = 13;
    const w = (maxx - minx + 1) * s;
    const h = (maxy - miny + 1) * s;
    const ox = (cw - w) / 2 - minx * s;
    const oy = (ch - h) / 2 - miny * s;
    for (const [x, y] of cells) {
      drawTile(ctx, ox + x * s, oy + y * s, s, COLORS[type], { alpha });
    }
  }

  function drawGhost(ctx, piece, gy) {
    const cells = SHAPES[piece.type][piece.rot];
    const color = COLORS[piece.type];
    for (const [x, y] of cells) {
      const px = (piece.x + x) * CELL;
      const py = (gy + y - HIDDEN_ROWS) * CELL;
      if (py < -CELL) continue;
      rr(ctx, px + 2.5, py + 2.5, CELL - 5, CELL - 5, CELL * 0.18);
      ctx.fillStyle = rgba(color, 0.08);
      ctx.fill();
      ctx.strokeStyle = rgba(color, 0.4);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function draw(pdt) {
    const ctx = bctx;
    ctx.clearRect(0, 0, BW, BH);
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(148,163,214,0.055)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let c = 1; c < COLS; c++) {
      ctx.moveTo(c * CELL + 0.5, 0);
      ctx.lineTo(c * CELL + 0.5, BH);
    }
    for (let r = 1; r < VISIBLE_ROWS; r++) {
      ctx.moveTo(0, r * CELL + 0.5);
      ctx.lineTo(BW, r * CELL + 0.5);
    }
    ctx.stroke();

    const grid = game.grid();
    const cl = game.clearing();
    for (let y = HIDDEN_ROWS; y < ROWS; y++) {
      const isClearing = cl && cl.rows.indexOf(y) >= 0;
      for (let x = 0; x < COLS; x++) {
        const t = grid[y][x];
        if (!t) continue;
        if (isClearing) {
          const half = CLEAR_TIME * 0.5;
          const a = cl.t < half ? 0.25 + 0.75 * (cl.t / half) : 1 - (cl.t - half) / half;
          ctx.globalAlpha = Math.max(0, a) * 0.9;
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x * CELL, (y - HIDDEN_ROWS) * CELL, CELL, CELL);
          ctx.globalAlpha = 1;
        } else {
          drawTile(ctx, x * CELL, (y - HIDDEN_ROWS) * CELL, CELL, COLORS[t], { alpha: 1 });
        }
      }
    }

    const cur = game.current();
    if (cur && !cl) {
      let gy = cur.y;
      while (true) {
        let hit = false;
        for (const [x, y] of SHAPES[cur.type][cur.rot]) {
          const bx = cur.x + x, by = gy + y + 1;
          if (bx < 0 || bx >= COLS || by >= ROWS || (by >= 0 && grid[by][bx])) {
            hit = true;
            break;
          }
        }
        if (hit) break;
        gy++;
      }
      if (gy > cur.y) drawGhost(ctx, cur, gy);
      for (const [x, y] of cellsOfCur(cur)) {
        if (y < HIDDEN_ROWS) continue;
        drawTile(ctx, x * CELL, (y - HIDDEN_ROWS) * CELL, CELL, COLORS[cur.type], { glow: true });
      }
    }

    for (let i = parts.length - 1; i >= 0; i--) {
      const pt = parts[i];
      pt.t += pdt;
      pt.x += pt.vx * pdt;
      pt.y += pt.vy * pdt;
      pt.vy += pt.g * pdt;
      if (pt.t > pt.life) {
        parts.splice(i, 1);
        continue;
      }
      const a = 1 - pt.t / pt.life;
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // Danger tint: red glow as the stack climbs
    let topRow = ROWS;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].some(Boolean)) { topRow = r; break; }
    }
    const danger = topRow <= 8 ? Math.min(1, (8 - topRow) / 4) : 0;
    if (danger > 0.02) {
      const pulse = 0.5 + 0.5 * Math.sin(performance.now() * 0.006);
      const a = danger * (0.13 + 0.08 * pulse);
      const dg = ctx.createLinearGradient(0, 0, 0, CELL * 9);
      dg.addColorStop(0, 'rgba(255,59,92,' + a.toFixed(3) + ')');
      dg.addColorStop(1, 'rgba(255,59,92,0)');
      ctx.fillStyle = dg;
      ctx.fillRect(0, 0, BW, CELL * 9);
    }
    boardWrap.classList.toggle('danger', danger >= 0.45);

    drawMini(hctx, 92, 56, game.holdType(), game.canHold() ? 1 : 0.35);
    const q = game.queue();
    const pLen = game.previewLength();
    for (let i = 0; i < pLen; i++) {
      nctx.save();
      nctx.translate(0, i * 56);
      drawMini(nctx, 92, 56, q[i] || null, i === 0 ? 1 : 0.75);
      nctx.restore();
      if (i < pLen - 1) {
        nctx.strokeStyle = 'rgba(148,163,214,0.08)';
        nctx.beginPath();
        nctx.moveTo(10, (i + 1) * 56 + 0.5);
        nctx.lineTo(82, (i + 1) * 56 + 0.5);
        nctx.stroke();
      }
    }
  }

  function cellsOfCur(p) {
    return SHAPES[p.type][p.rot].map(([x, y]) => [p.x + x, p.y + y]);
  }

  const keyState = { left: false, right: false };
  let dasDir = 0, dasT = 0, arrT = 0, dasPhase = 0;

  function doMove(d) {
    if (game.move(d)) SFX.move();
  }

  function tryRotate(d) {
    if (game.rotate(d)) SFX.rotate();
    else SFX.reject();
  }

  function tryHold() {
    if (game.holdPiece()) {
      SFX.hold();
    } else if (game.status() === 'playing' && game.current() && !game.clearing()) {
      SFX.reject();
      holdCard.classList.remove('denied');
      void holdCard.offsetWidth;
      holdCard.classList.add('denied');
    }
  }

  function p99Gap() {
    if (randMode === 'sliding') return P99_GAP.sliding[slidingN + ',' + slidingK];
    if (randMode === 'seven') return P99_GAP.seven;
    return P99_GAP.random;
  }

  function placeAnalytics() {
    const sx = window.scrollX, sy = window.scrollY;
    const r = playfield.getBoundingClientRect();
    if (window.innerWidth - r.right >= 236) {
      analytics.style.left = (r.right + 16 + sx) + 'px';
      analytics.style.top = (r.top + sy) + 'px';
      analytics.style.width = '';
      analytics.style.maxHeight = '';
      analytics.classList.remove('compact');
    } else if (r.left >= 236) {
      analytics.style.left = (r.left - 236 + sx) + 'px';
      analytics.style.top = (r.top + sy) + 'px';
      analytics.style.width = '';
      analytics.style.maxHeight = '';
      analytics.classList.remove('compact');
    } else {
      const c = controlsCard.getBoundingClientRect();
      analytics.style.left = (c.left + sx) + 'px';
      analytics.style.top = (c.top + sy) + 'px';
      analytics.style.width = c.width + 'px';
      analytics.style.maxHeight = c.height + 'px';
      analytics.classList.add('compact');
    }
  }

  function renderAnalytics() {
    const info = game.randomizerInfo();
    const snap = stats.snapshot();
    let head;
    if (info.mode === 'sliding') {
      head = 'Analytics \u00B7 sliding ' + 7 * info.n + '-bag (n=' + info.n + ', k=' + info.k + ')';
    } else if (info.mode === 'seven') {
      head = 'Analytics \u00B7 7-bag';
    } else {
      head = 'Analytics \u00B7 pure random';
    }
    let rows = '';
    const maxCount = info.counts ? Math.max(1, ...Object.values(info.counts)) : 1;
    for (const t of TYPES) {
      const since = snap.sinceLastSeen[t];
      const cls = 'an-since' + (since > 12 ? ' warn' : '') + (since >= p99Gap() ? ' hot' : '');
      if (info.counts) {
        const c = info.counts[t];
        rows += '<div class="an-row"><span class="an-swatch" style="background:' + COLORS[t] + '"></span>' +
          '<span class="an-name">' + t + '</span><span class="an-count">' + c + '</span>' +
          '<span class="an-bar"><i style="width:' + Math.round(c / maxCount * 100) + '%"></i></span>' +
          '<span class="' + cls + '">' + since + '</span></div>';
      } else {
        rows += '<div class="an-row"><span class="an-swatch" style="background:' + COLORS[t] + '"></span>' +
          '<span class="an-name">' + t + '</span><span class="an-count">\u2014</span><span class="an-bar"></span>' +
          '<span class="' + cls + '">' + since + '</span></div>';
      }
    }
    let refill = '';
    if (info.mode === 'sliding') {
      refill = '<div class="an-refill">refill in ' + info.drawsUntilRefill + '</div>';
    } else if (info.mode === 'seven') {
      refill = '<div class="an-refill">' + (info.drawsUntilRefill ? 'bag: ' + info.drawsUntilRefill + ' left' : 'new bag next') + '</div>';
    }
    let worstD, worstR;
    if (info.mode === 'sliding') {
      const b = slidingBounds(info.n, info.k);
      worstD = b.maxDrought;
      worstR = b.maxRun;
    } else if (info.mode === 'seven') {
      worstD = 12;
      worstR = 2;
    } else {
      worstD = 'no limit';
      worstR = 'no limit';
    }
    const statsHtml = '<div class="an-stats">' +
      '<div>drought ' + snap.longestDrought.length + ' (' + (snap.longestDrought.piece || '\u2014') + ') \u00B7 worst ' + worstD + '</div>' +
      '<div>run ' + snap.longestRun.length + ' (' + (snap.longestRun.piece || '\u2014') + ') \u00B7 worst ' + worstR + '</div>' +
      '<div>flood ' + snap.biggestFlood.count + ' of 7 (' + (snap.biggestFlood.piece || '\u2014') + ')</div>' +
      '<div>dealt ' + snap.total + '</div></div>';
    let pool = '';
    if (info.counts) {
      pool = '<div class="an-pool">';
      for (const t of TYPES) {
        let sq = '';
        for (let i = 0; i < info.counts[t]; i++) sq += '<i style="background:' + COLORS[t] + '"></i>';
        pool += '<div class="an-pool-row"><span class="an-name">' + t + '</span><span class="an-squares">' + sq + '</span></div>';
      }
      pool += '</div>';
    }
    analytics.innerHTML = '<div class="an-head">' + head + '</div>' + rows + refill + statsHtml + pool;
  }

  function toggleAnalytics() {
    analyticsOn = !analyticsOn;
    store.set('showpiece.analytics', analyticsOn);
    analyticsChk.checked = analyticsOn;
    analytics.hidden = !analyticsOn;
    if (analyticsOn) {
      placeAnalytics();
      renderAnalytics();
    }
  }

  function startGame() {
    ensureAudio();
    if (actx && actx.state === 'suspended') actx.resume();
    hideOverlay();
    stats.reset();
    game.start();
  }

  window.addEventListener('keydown', (e) => {
    const c = e.code;
    if (c === 'KeyA') {
      if (!e.repeat) toggleAnalytics();
      return;
    }
    if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', 'Space', 'KeyZ', 'KeyX', 'KeyC', 'ShiftLeft', 'ShiftRight', 'KeyP', 'KeyM', 'KeyK', 'Enter', 'Escape'].indexOf(c) >= 0) {
      e.preventDefault();
    }
    if (game.status() === 'ready') {
      startGame();
      return;
    }
    if (game.status() === 'over') {
      if (c === 'Enter' || c === 'KeyR') startGame();
      return;
    }
    if (e.repeat) return;
    if (game.status() === 'paused') {
      if (c === 'KeyP' || c === 'Escape') game.resume();
      return;
    }
    switch (c) {
      case 'ArrowLeft':
        keyState.left = true;
        doMove(-1);
        dasDir = -1;
        dasT = 0;
        arrT = 0;
        dasPhase = 1;
        break;
      case 'ArrowRight':
        keyState.right = true;
        doMove(1);
        dasDir = 1;
        dasT = 0;
        arrT = 0;
        dasPhase = 1;
        break;
      case 'ArrowDown':
        game.softDropStep();
        game.setSoftDrop(true);
        break;
      case 'ArrowUp':
      case 'KeyX':
        tryRotate(1);
        break;
      case 'KeyZ':
        tryRotate(-1);
        break;
      case 'Space':
        game.hardDrop();
        break;
      case 'KeyC':
      case 'ShiftLeft':
      case 'ShiftRight':
        tryHold();
        break;
      case 'KeyP':
      case 'Escape':
        game.pause();
        break;
      case 'KeyM':
        toggleMute();
        break;
      case 'KeyK':
        toggleMusic();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    switch (e.code) {
      case 'ArrowLeft':
        keyState.left = false;
        if (dasDir === -1) {
          dasDir = keyState.right ? 1 : 0;
          dasPhase = dasDir ? 2 : 0;
          dasT = 0;
          arrT = 0;
        }
        break;
      case 'ArrowRight':
        keyState.right = false;
        if (dasDir === 1) {
          dasDir = keyState.left ? -1 : 0;
          dasPhase = dasDir ? 2 : 0;
          dasT = 0;
          arrT = 0;
        }
        break;
      case 'ArrowDown':
        game.setSoftDrop(false);
        break;
    }
  });

  function updateInput(dt) {
    if (dasDir === 0) return;
    if (dasPhase === 1) {
      dasT += dt;
      if (dasT >= DAS) {
        dasPhase = 2;
        arrT = 0;
      }
    } else {
      arrT += dt;
      while (arrT >= ARR) {
        arrT -= ARR;
        doMove(dasDir);
      }
    }
  }

  window.addEventListener('blur', () => {
    if (game.status() === 'playing') game.pause();
  });

  function toggleMute() {
    muted = !muted;
    store.set('showpiece.muted', muted);
    if (master) master.gain.value = muted ? 0 : 0.5;
    soundBtn.classList.toggle('off', muted);
  }

  soundBtn.addEventListener('click', () => {
    ensureAudio();
    toggleMute();
  });

  function toggleMusic() {
    musicOn = !musicOn;
    store.set('showpiece.music', musicOn);
    musicBtn.classList.toggle('off', !musicOn);
    if (musicOn && game.status() === 'playing') MUSIC.start();
    else MUSIC.stop();
  }

  musicBtn.addEventListener('click', () => {
    ensureAudio();
    toggleMusic();
  });

  function applyRandomizerSettings() {
    stats.reset();
    updateBoundsNote();
    if (analyticsOn) renderAnalytics();
    if (game.status() === 'ready') showOverlay('ready');
  }

  randSel.addEventListener('change', () => {
    randMode = randSel.value;
    if (randMode === 'sliding') game.setRandomizerMode('sliding', { n: slidingN, k: slidingK });
    else game.setRandomizerMode(randMode);
    store.set('showpiece.randomizer', randMode);
    slidingOpts.hidden = randMode !== 'sliding';
    applyRandomizerSettings();
  });

  poolSel.addEventListener('change', () => {
    slidingN = Number(poolSel.value);
    slidingK = Math.min(slidingK, slidingN);
    buildRefillOptions(slidingN);
    refillSel.value = String(slidingK);
    game.setRandomizerMode('sliding', { n: slidingN, k: slidingK });
    store.set('showpiece.slidingN', slidingN);
    store.set('showpiece.slidingK', slidingK);
    applyRandomizerSettings();
  });

  refillSel.addEventListener('change', () => {
    slidingK = Number(refillSel.value);
    game.setRandomizerMode('sliding', { n: slidingN, k: slidingK });
    store.set('showpiece.slidingK', slidingK);
    applyRandomizerSettings();
  });

  previewSel.addEventListener('change', () => {
    previewLen = Number(previewSel.value);
    game.setPreviewLength(previewLen);
    store.set('showpiece.preview', previewLen);
    nextCard.hidden = previewLen === 0;
    nctx = setupCanvas(nextCanvas, 92, 56 * Math.max(1, previewLen));
    if (analyticsOn) placeAnalytics();
  });

  kicksChk.addEventListener('change', () => {
    game.setKicks(kicksChk.checked);
    store.set('showpiece.kicks', kicksChk.checked);
  });

  analyticsChk.addEventListener('change', () => {
    if (analyticsChk.checked !== analyticsOn) toggleAnalytics();
  });

  window.addEventListener('resize', () => {
    if (analyticsOn) placeAnalytics();
  });

  newGameBtn.addEventListener('click', () => startGame());

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.status() === 'playing') {
      updateInput(dt);
      session.seconds += dt;
    }
    game.tick(dt);
    draw(dt);
    requestAnimationFrame(frame);
  }

  showOverlay('ready');
  requestAnimationFrame(frame);
}
