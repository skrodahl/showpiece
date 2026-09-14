# Showpiece — Specification

Single-file-logic, no-dependency HTML5 falling-block puzzle game. Vanilla JS, canvas rendering, WebAudio.
Tagline: **sliding-bag edition · strict rotation**.

## Files

| File | Role |
|---|---|
| `index.html` | Page shell: masthead (MUSIC/SOUND toggles), left panel (Hold, Score, Controls), board canvas + overlay, right panel (Next, Settings) |
| `style.css` | Visual design (dark theme, glassmorphism cards, animations) |
| `game.js` | Pure game logic (`createGame`, `makeRandomizer`, `slidingBounds`, `createRandomizerStats`) + DOM/audio/render layer. Exports `{ createGame, makeRandomizer, slidingBounds, createRandomizerStats, PIECES, SHAPES, ... }` when loaded under Node |
| `package.json` | `npm test` runs the five test suites; `npm run stats` and `npm run stats:*` run the randomizer studies |
| `RANDOMIZER.md` | Write-up of the sliding 21-bag: algorithm, exact bounds, comparison with 7-bag/14-bag/random/NES/TGM1–3, pros & cons, reproduction commands |
| `tests/game-test.js` | 29 headless logic tests (rotation, bags, randomizer params/inspect/bounds/deal events/preview, scoring, speed curve, random-play invariants) |
| `tests/smoke.js` | Stubbed-DOM render smoke: 2400 frames of random input through the real DOM layer, plus preview-length and sliding-pool-settings plumbing checks |
| `tests/music-test.js` | Headless music/tempo/lifetime test under a stubbed `AudioContext` |
| `tests/hold-flash-test.js` | Hold-lockout denial flash regression test |
| `tests/analytics-test.js` | Analytics-overlay non-interference test: the real DOM layer run twice in child processes (overlay off / on) with identically-seeded input; end states must be identical |
| `tests/i-pieces.js` | Quick randomizer statistics (distributions, worst windows, droughts over 21k pieces; seeded PRNGs) — not a test, run via `npm run stats` |
| `tests/randomizers.js` | Shared code for the randomizer studies: mulberry32 PRNG, reimplemented comparison randomizers (14-bag, NES, TGM1–3), exact-bound search for sliding pools |
| `tests/randomizer-compare.js` | 14M-piece comparison of all randomizers + per-game drought odds + exact 21-bag bounds — `npm run stats:compare` |
| `tests/randomizer-floods.js` | Flood-after-drought study — `npm run stats:floods` |
| `tests/randomizer-pool-size.js` | Sliding 7n-bag family (pool n = 1–4 copies, refill k ≤ n sets every 7k draws) with exact bounds — `npm run stats:pools` |
| `tests/randomizer-variants.js` | Rejected sliding-bag variants (alternating refills, drip refill, reset) — `npm run stats:variants` |

---

## Board & pieces

- **Board:** 10 columns × 20 visible rows + 4 hidden rows above (24 total).
- **Pieces:** standard 7 tetrominoes, spawn centered at `x = floor((10 - n)/2)`, `y = HIDDEN_ROWS - 2` (row 2), rotation 0, then immediately drop one row if unobstructed so the piece's bottom row is visible the moment it enters play.
- **Colors:** I `#4dd8f0`, O `#f8c844`, T `#b57bee`, S `#5fd492`, Z `#f4737c`, J `#6193f0`, L `#f5a054`.
- **Rotation states:** spawn state is state 0; each CW rotation applies `(x, y) → (n-1-y, x)` on the piece's bounding box (I: 4×4, O: 2×2, rest 3×3). O is invariant.

## Rotation

- **Default: strict (no wall kicks).** A rotation only succeeds if the rotated position fits as-is — no translation attempts. This is the house style of this build and is stated in the UI.
- **Optional: SRS kicks** (settings toggle, persisted). Full SRS kick tables for JLSTZ and I; `[0,0]` is always tried first, so SRS mode is a strict superset of strict mode.
- O piece rotation is a no-op (returns success).

## Randomizer (piece ordering)

Three modes, selectable in Settings, persisted, switchable mid-game (queue refills immediately):

1. **Sliding 7n-bag (default: the 21-bag, *n* = 3, *k* = 1).** The pool starts with *n* copies of each piece (7*n* pieces). Each draw picks one piece uniformly at random from the pool, *without* replacement. After every 7*k* draws, *k* copies of each piece (7*k* pieces) are pushed back in, so the pool size oscillates 7*n* → 7(*n*−*k*) → 7*n*. Per-type counts in the pool drift: a type that is rarely drawn accumulates copies while a heavily-drawn type depletes, so the mix skews between refills.
   - **Parameters.** `makeRandomizer('sliding', rng, { n, k })` with 1 ≤ *k* ≤ *n* ≤ 8 (a `RangeError` otherwise); defaults *n* = 3, *k* = 1. The Settings UI offers *n* ∈ {2, 3, 4} (labelled 14 / 21 / 28) and *k* ∈ 1…*n*; *n* = 1 is just the 7-bag (its own mode), and *k* = *n* is a closed refill-everything bag. Changing the setting mid-game rebuilds the pool and clears the queue, like a mode switch.
   - **Exact bounds** — closed form in the exported `slidingBounds(n, k)`; for the default 21-bag the values were verified by exhaustive state search: a type's dealt count stays hard-bounded around its fair share (long-run distribution exactly 1/7); for *n* = 3, *k* = 1: max drought **110** pieces, max same-piece run **18**. Both are theoretical: over 14M pieces / 20 seeds the worst seen were a 56-piece drought and a run of 7. The Settings note under the controls shows the exact worst-case drought and run for the chosen setting.
   - Typical (14M pieces): same piece back-to-back 11.9%; 99th-percentile gap 23; gap ≥ 20 in 2.74% of gaps; ~32% of 7-piece windows contain a triple; a given piece is absent from 7.3% of 14-piece windows.
   - Known trade-off: short-term droughts are real — in a 100-piece game (≈40 lines) there is a 29% chance of an I-drought ≥ 20 and 1.7% of ≥ 30. After a drought the pool is loaded with that piece, so floods follow (after a 30+ drought, 53% chance of 2+ more in the next 7).
   - Full analysis and comparison with other randomizers: `RANDOMIZER.md`.
2. **7-bag.** Classic Fisher–Yates bag of 7. Max drought 12, max run 2 (exact). The *n* = *k* = 1 member of the sliding family, kept as its own mode for players who dislike sliding's short-term droughts.
3. **Pure random.** Independent uniform draws per piece. Unbounded droughts (worst seen 109 over 14M pieces); per-piece counts drift without bound (±297 after 700k pieces).

**Read-only inspection.** Every randomizer carries an `inspect()` accessor that reports its internal state without consuming RNG or touching the pool/bag — the deal sequence is provably identical with or without it (tested):
- **sliding** → `{ mode, n, k, counts, size, drawsUntilRefill }` — copies of each piece in the pool right now, the pool length, and the draws until the next refill.
- **seven** → the same shape with **counts only** — never the bag order, since the order *is* the future sequence.
- **random** → a fixed all-null shape.

`createGame` adds `randomizerInfo()`, which passes `inspect()` through and folds the *hidden* queue pieces (those past the visible preview) back into `counts` / `size`, plus `hidden` — how many such pieces there are; the panel never reveals more than the preview shows. `setRandomizerMode(mode, params)` rebuilds the randomizer (sliding takes `{ n, k }`) and clears the queue; `previewLength()` / `setPreviewLength(len)` (0–5, clamped; `createGame` default 5, UI default 3) re-top-up the queue, and shrinking keeps pieces already queued.

**Deal event.** `createGame` emits `onEvent({ type: 'deal', piece })` each time a piece leaves the Next queue and enters play (`spawn()`, when no type is passed); hold swaps are not deals. This event is the single feed the analytics overlay observes — all its numbers count deals. The observer itself is the exported pure `createRandomizerStats()`: `observe(piece)` / `reset()` / `snapshot()` → since-last-seen per type, longest drought (and which piece), longest same-piece run, biggest flood (most of one piece within 7), and total dealt.

## Input & movement

| Key | Action |
|---|---|
| ← / → | Move (DAS/ARR) |
| ↓ | Soft drop (tap = 1 row; hold = continuous) |
| ↑ / X | Rotate CW |
| Z | Rotate CCW |
| Space | Hard drop (locks immediately) |
| C / Shift | Hold |
| P / Esc | Pause |
| K | Toggle music |
| M | Toggle sound (mute) |
| A | Toggle the analytics overlay (works in every state; never starts a game) |
| Enter | Start / restart |
| R | Restart (from game over) |

- **DAS = 200 ms, ARR = 33 ms.** A key press moves once immediately; after 200 ms held, the piece auto-shifts at one cell per 33 ms. Opposing-direction keys cancel each other (last press wins).
- **Soft drop:** tap moves one row (+1 point). Holding ↓ for 150 ms then switches to continuous drop at `min(gravity, 0.1 s/row)`.
- **Hard drop:** +2 points per row fallen, board shake, locks on the same frame (no lock delay).
- **Lock delay = 0.5 s**, decaying by 0.03 s per level to a **0.2 s floor**. The timer resets on a successful move/rotation while grounded, up to **15 resets**; after that the piece locks on the next grounding.
- **Auto-pause** when the window loses focus.

## Gravity & speed curve

Seconds per gravity row:

```
speed = max(0.08, (0.8 − (level−1)·0.007)^(level−1))
```

| Level | 1 | 5 | 10 | 15+ |
|---|---|---|---|---|
| Gravity | 0.80 s | 0.64 s | 0.34 s | 0.08 s (floor) |

- Floor is **0.08 s = 12.5 rows/s** — playable ceiling, never instant.
- Lock delay: `max(0.2, 0.5 − (level−1)·0.03)` → 0.2 s from level ~17.
- **Deliberately unchanged with level:** DAS, ARR, soft-drop rate, lines-per-level (10). The difficulty ramp comes purely from gravity + lock delay; controls keep their feel.
- `level = floor(lines / 10) + 1`.

## Scoring

| Action | Points |
|---|---|
| Single / Double / Triple / Quad | 100 / 300 / 500 / 800 × level |
| T-spin (no lines) | 400 × level |
| T-spin mini (no lines) | 100 |
| T-spin single / double / triple | 800 / 1200 / 1600 × level |
| T-spin mini single / double | 200 / 400 × level |
| Combo (n ≥ 2) | +50 × (n−1) × level |
| Back-to-back (Quad or full T-spin) | ×1.5 on the base clear value |
| Soft drop / hard drop | +1 / +2 per row |

- **T-spin detection:** T piece, last successful move was a rotation, ≥ 3 of 4 diagonal corners around the T's center blocked. *Mini* if both "front" corners (relative to spawn-facing direction) are open.
- Line clears resolve after a 0.22 s clear animation; `lines`/score/level update when the clear completes.
- Score popups show label + points (T-SPIN purple, QUAD cyan, others blue, B2B prefix, combo count), plus a level-up popup.

## Hold

- One hold per piece (lockout until the next piece locks).
- On lockout attempt: rejection sound + hold card flashes red.
- Held piece spawns at the standard spawn position; hold slot resets per game.

## Game flow

- **States:** `ready → playing ⇄ paused → over`.
- **Game over:** a piece locks entirely inside the hidden rows (*top-out*) — checked *after* the full-row check, so a top-out lock that completes rows still clears first — or a spawned piece collides.
- On game over: music stops, descending SFX, then (after 450 ms) the overlay shows the session + all-time stats.
- Any key from `ready` starts the game, **except `A`** (which only toggles the analytics overlay); Enter/R from `over` restarts.
- Every game — including a restart — starts with a fresh randomizer: a new shuffled 7-bag, or a full sliding pool. Changing settings outside a game (ready screen, game over) draws no pieces; the queue fills when the game starts. Consecutive games share one random stream, so a game's pieces depend only on the stream's state at its start.

## Visual design

- **Theme:** near-black `#070a12` with three slowly drifting radial color washes (indigo/sky/violet); glassmorphism cards (translucent, blurred, 14 px radius); Chakra Petch for display type, IBM Plex Mono for numbers.
- **Board:** 32 px cells, DPR-aware canvas, subtle grid, soft inner shadow, deep drop shadow under the well.
- **Feedback:** ghost piece, hold preview + next queue (0–5 pieces, default 3; the Next card hides at 0), line-clear particle burst (piece-colored), board shake on hard drop, white flash on level-up, score "bump" on change.
- **Danger tint:** when the top of the stack is within 8 visible rows of the ceiling, a red gradient fades in over the top of the board with a gentle pulse (intensity scales 8 → 4 rows); at top row ≤ 4 the board frame itself glows red.
- **Overlays:** ready (logo + "press any key"), paused, game over (see stats below).
- **Analytics overlay** (optional; `A` or the Settings switch; persisted, off by default): a compact glass panel, 220 px wide, `pointer-events: none` — input always passes through it. Contents: a header naming the active randomizer; one row per piece (swatch, live pool count, share bar, and a "since last seen" counter that turns amber past 12 and red at/above the mode's 99th-percentile gap — 23 for the default 21-bag, per-setting for other sliding n/k, 12 for 7-bag, 29 for random); the refill marker ("refill in N" for sliding; "bag: N left" for 7-bag, where N is the pieces actually left in the bag — hidden preview pieces are not counted); session randomizer stats (longest drought / run, biggest flood, total dealt, shown next to the exact worst cases of the current setting); and the full pool contents as colour squares.
  - **Placement:** right gutter, 16 px off the playfield, when that gutter is at least 236 px wide (panel + gap); else the left gutter; else compact mode docked over the static Controls card (Controls-card width, opaque background, pool and stats sections hidden, height capped to the Controls card's own height so the panel never covers more than the card). The panel is positioned in document coordinates — it scrolls with the page, never drifting from the playfield — and is re-placed on window resize and on preview-length changes. It never covers the board, Hold, Next, Score or Settings.
  - **Gameplay-neutral by construction:** it renders only on deal / toggle / settings-change / start events — never inside the frame loop — inside a try/catch, and the deal sequence is verified identical with the panel on or off (`analytics-test.js`). On game over the panel simply stays visible, showing its final numbers.

## Audio

All synthesized with WebAudio oscillators — no assets. Master gain 0.5; mute (`M` / SOUND button) and music toggle (`K` / MUSIC button) both persisted.

### SFX

Move, rotate (upward pitch slide), reject (downward slide), hard drop (thud + slide), lock tick, hold (slide up), line clear (arpeggio, length scales with line count, sub-bass added on a Quad), T-spin (two-note sting), level-up (sawtooth rise), game over (descending minor arpeggio).

### Background music — Korobeiniki

- The authentic Russian folk melody in **A minor, 4/4** (from the published score), 8-bar loop: 34 melody notes over 32 beats, plus an eighth-note bass on the bar roots (Em Am Bm C F Am Bm C).
- Melody: square wave, vol 0.05. Bass: triangle, vol 0.1. Both with short attack / exponential release envelopes.
- **Scheduler:** 50 ms timer with 0.3 s lookahead against `AudioContext.currentTime`; the beat duration is recomputed each tick, so tempo changes land mid-loop without drift.
- **Tempo scales with level:** `beat = max(0.28, 0.42 / (1 + 0.06·(level−1)))` → **143 BPM at level 1, ~177 at level 5, capped at 214 BPM from level 10** (0.28 s/beat floor keeps it playable).
- Music starts with the game, stops on pause and game over. On by default.
- Note: this is the *authentic score* arrangement, not the slightly different Game Boy arrangement — a documented swap option if preferred.

## Persistence (localStorage)

| Key | Value |
|---|---|
| `showpiece.best` | Best score |
| `showpiece.muted` | SFX mute |
| `showpiece.music` | Music on/off (default `true`) |
| `showpiece.randomizer` | `sliding` / `seven` / `random` (default `sliding`) |
| `showpiece.slidingN` | Sliding pool size *n* (default `3`) |
| `showpiece.slidingK` | Sliding refill *k* (default `1`) |
| `showpiece.preview` | Preview length, 0–5 (default `3`) |
| `showpiece.analytics` | Analytics overlay on/off (default `false`) |
| `showpiece.kicks` | SRS kicks on/off (default `false`) |
| `showpiece.lifetime` | `{ games, lines, tspins, combo, seconds }` — all-time totals |

**Game-over stats:** session score / best (with NEW flag) / lines / level / time, then an **All-time** section: games, lines, T-spins, best combo, time. Session stats are tracked in the DOM layer (T-spins counted from score labels, combo as the max reached, time accumulated per frame while playing) and folded into the all-time totals on game over.

## Testing

- `game-test.js` — 29 headless tests: SRS state correctness, kick-table inverses, bag invariants (7-bag completeness; sliding pool bookkeeping over 7 cycles; distribution/drought bounds; 3-in-a-row), the **golden sequence fingerprints** (see the rule below), sliding *n*/*k* parameterisation (defaults equal explicit `{n:3,k:1}`; pool bookkeeping via `inspect`), `inspect` never changes the sequence, seven's `inspect` exposes counts only, `slidingBounds` (matches the table, agrees with exhaustive search, rejects invalid *n*/*k*), `makeRandomizer` rejects invalid *n*/*k*, `deal` events follow randomizer order (hold does not deal), `previewLength`/`randomizerInfo` never change the sequence, `randomizerInfo` hides nothing beyond the preview, `setPreviewLength` shrinks without discarding, `setRandomizerMode` with params, the `createRandomizerStats` tracker (vectors; reset + snapshot independence), scoring (single clear, T-spin single 800), strict vs kicked rotation, 30 s random-play invariants across all three modes, and the full speed curve (locks a game to level 12 and asserts gravity floor 12.5 rows/s + scaled lock delay).
- **Golden-fingerprint rule:** `game-test.js` pins the *exact* deal sequence of each randomizer under fixed seeds to a fingerprint — FNV-1a of the first 10 000 pieces, plus a literal of the first 40: sliding `7d366128` / `TLILTZTTOISLOJZJOJJOSSTLZIIZSIIZOJSIOTOS`, seven `4c8d7abd`, random `64aa9243` (seed 2026). These are regression anchors: if one ever fails, a randomizer change altered the sequence and the change is wrong — fix the code, never the expected value.
- `smoke.js` — runs the real DOM layer under stubbed `document`/`window`/canvas for 2400 frames with random input; asserts no exceptions and a sane end state, that the persisted preview length reaches the game (`previewLength()`), and that the sliding pool/refill settings reach the randomizer (`randomizerInfo().n`).
- `analytics-test.js` — the analytics-overlay non-interference test. The DOM layer of `game.js` loads once per process, so it runs the real DOM layer **twice, in child processes**, with `Math.random` seeded identically: once with the overlay off, once with it on (pressing `A`, which must not start the game). Both run the same 2 400 frames of random input; the parent asserts the two end states (status, score, lines, level, queue length, hold, and the full grid) are **identical** — the overlay never changes gameplay. Prints `ANALYTICS RENDER OK` / `ANALYTICS OK`.
- `music-test.js` — runs the DOM layer under a stubbed `AudioContext` that captures every scheduled note; verifies the scheduled melody is the Korobeiniki A-phrase, L1 note gaps are beat-quantized, level-2 note durations match the scaled tempo, `K` toggling stops/resumes scheduling, the danger tint renders without throwing, and lifetime stats accumulate correctly on game over.
- `i-pieces.js` — quick statistical check of the three in-game randomizers (distributions, worst windows, droughts) with seeded PRNGs.
- `randomizer-*.js` — the studies behind `RANDOMIZER.md` (comparison, floods, pool sizes, rejected variants); not tests, run via `npm run stats:*`. All use seeds 9000–9019 and reproduce the document's numbers exactly.

---

## Design choices & rationale

- **Sliding 21-bag as the default** — the requested house rule: fairer than pure random over any window, smoother than 7-bag (repeats of 3+ allowed, no rigid bag rhythm). The burstiness is the point: repeats, floods and droughts that 7-bag never produces, while the long-run count stays hard-bounded (unlike pure random, NES or TGM history randomizers). Its short-term droughts (29% of 40-line games see an I-drought ≥ 20) were measured and accepted as fair play; the 7-bag option exists for players who dislike them. It is the n = 3, k = 1 member of the sliding 7n-bag family (pool of n of each, k of each added every 7k draws; k = n is a closed bag, so 7-bag = n = k = 1). Larger n or smaller k is burstier (n = 2: max drought 61; n = 4: 159) — see `RANDOMIZER.md` §6.
- **Strict rotation by default** — rotation is pure skill, no kick reliance; keeps the game honest and fast to read. Full SRS is one toggle away for players who want guideline play.
- **Speed curve with hard floors** — gravity floors at 0.08 s/row and lock delay at 0.2 s so high-level play is intense but never physically impossible; DAS/ARR are kept constant on purpose so muscle memory survives the ramp.
- **Authentic Korobeiniki, not the GB chip arrangement** — closer to the actual folk song; the chip-tune version can be swapped in if the retro sound is preferred.
- **Music tempo capped at 214 BPM** — the level curve keeps multiplying the tempo; the floor keeps the loop from becoming noise.
- **Music/SFX as one audio engine, two gates** — `M` mutes everything, `K` toggles only the music; both independent and persisted.
- **Lifetime stats, not just best score** — cheap (one localStorage key) and it gives the game-over screen something worth reading; session time is tracked in the DOM layer because the pure logic module is stateless per game.
- **No build step, no dependencies** — one script tag, runs from the filesystem; the module export exists purely so the logic is testable headlessly.

## Potential improvements & additions

### Sliding-bag showpiece (shipped in this build)

Goal: make the game a demonstration of the sliding 7n-bag randomizer (`RANDOMIZER.md`), so players can *see* the pool, the droughts and the floods rather than just experience them.

**Principle: it's a proper falling-block game first.** Everything that explains the randomizer is *analytics* and lives in an optional overlay. The overlay must not affect gameplay: off by default, no change to the board layout or panels, no pausing, no effect on timing, input or the piece sequence. The principle is now enforced in code: the overlay is off by default, renders only on deal/toggle/settings/start events, and the deal sequence is proven identical with it on or off (`analytics-test.js`).

The implemented parts — tunable *n*/*k* and preview length in Settings, the read-only `inspect` / `randomizerInfo` / `deal` API, and the analytics overlay itself — are documented in the Randomizer, Visual design, Persistence and Testing sections.

Still open:

- **Card counting (open question):** the pool view gives a player perfect card-counting information. Either accept that as part of the showcase, or note on the game-over screen / in lifetime stats that the overlay was on.
- **Game-over summary:** the session randomizer stats (longest drought/run, biggest flood) could be summarized on the game-over screen, inside the overlay's styling, shown only when the overlay is enabled — the game-over screen is unchanged for now.

Out of scope for this build: marking games played with the overlay on, per-randomizer lifetime stats (see Medium), kicks-aware ready text (the ready subtitle says e.g. "sliding 21-bag · strict rotation" but not whether SRS kicks are on), and touch controls (see Medium).

### Quick wins
- Quad moment: dedicated screen flash / special chord beyond the sub-bass thump.
- Combo counter shown on the right panel (currently only in the score popup).
- Settings toggles: ghost piece, grid lines, screen shake (accessibility), music volume separate from SFX volume.
- 180° rotation (double-tap X) — pairs naturally with the strict-rotation style.
- High-score list (top 5 with date) instead of a single best.

### Medium
- **Danger music layer** — add a tension ostinato / faster bass when the danger tint is active; drop it when the stack falls back down.
- **Per-level music variation** — add an ornamented second phrase or key change (A minor → C major) at higher levels rather than only speeding up.
- Touch controls for mobile (swipe to move/rotate, tap to hard-drop, on-screen hold button).
- Key remapping UI (persisted) — the handler already keys off `e.code` centrally.
- Per-randomizer lifetime stats (games/lines split by mode).
- Piece color themes / user-selectable palettes (colors are already centralized in `COLORS`).

### Bigger
- **Battle / attack mode** — a second well: your line clears send junk rows to an opponent (local hot-seat first). The grid is already 24 rows with hidden space, so junk insertion is cheap.
- **Statistics page** — per-game history (score, lines, T-spins, longest combo, randomizer used) from the same `showpiece.lifetime`-style store.
- **Local leaderboard** with name entry, exported/imported as JSON.
- Game Boy chiptune BGM preset (square-only, no bass) as a selectable music track.
- Accessibility pass: reduced-motion mode (no shake/particles), ARIA live region for score updates, full keyboard focus management.
- Multiplayer / online (would need a small server or WebRTC sync of input frames; the deterministic core makes lockstep feasible).
