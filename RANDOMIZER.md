# The Sliding 21-Bag Randomizer

*A piece randomizer for Tetris-style games that is fair over time but allows short streaks and dry spells. By skrodahl, September 2026.*

---

## TL;DR

Keep a pool of 21 pieces, starting with 3 of each. Draw pieces from the pool at random. After every 7 draws, add one of each piece back.

The result falls between the 7-bag and pure random:

- **Fair over time:** as with the 7-bag, no piece can get more than 3 ahead of its share. It can also never fall more than 13 behind.
- **Streaky in the short term:** like pure random, you get repeats, floods and droughts. The 7-bag never produces these.

Unlike pure random, it pulls itself back to fair. The longer you wait for a piece, the more copies of it build up in the pool. When the drought ends, a flood of that piece often follows.

### Where it fits

Each of the established randomizers compared in section 4 is either fair over time or streaky in the short term, but none is both:

| | **Fair over time** (counts have a hard limit) | **Drifts** (counts have no limit) |
|---|---|---|
| **Streaky** (triples in 28–44% of 7-piece windows) | **Sliding 21-bag** | Pure random, NES |
| **Smooth** (triples in 0–10% of 7-piece windows) | 7-bag, 14-bag | TGM1, TGM2, TGM3 |

The sliding 21-bag is the only one of these that is both. Section 4 has the full numbers.

The mechanism itself has been proposed independently several times since 2015 (section 8). This document adds the exact limits, the comparisons and the analysis of the whole family.

---

## 1. The algorithm

```js
// pool starts with 3 of each piece: 21 pieces
let pool = [];
for (let i = 0; i < 3; i++) pool.push('I', 'O', 'T', 'S', 'Z', 'J', 'L');
let drawn = 0;

function next() {
  const piece = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
  if (++drawn % 7 === 0) pool.push('I', 'O', 'T', 'S', 'Z', 'J', 'L');
  return piece;
}
```

- **Draw:** pick uniformly at random from what is in the pool, without replacement.
- **Refill:** every 7th draw adds exactly one of each piece. The refill ignores what was drawn.
- **Pool size:** goes 21 → 15, then back to 21 at each refill. It never runs out.
- **Pool contents:** the mix drifts. A piece that hasn't come up keeps gaining a copy at each refill. At a refill, one piece can hold up to 15 of the 21 slots, since the refill always adds one of each of the other six.

It is called *sliding* because nothing is ever thrown away. Leftovers carry forward, so each draw depends on everything dealt before.

---

## 2. Design goals

The 7-bag is fair but mechanical: every 7 pieces contain one of each. Two of the same piece in a row can happen only across a bag boundary, and three in a row never happens. Pure random has variety but no memory, so a drought can go on without limit and the counts drift further from fair as the game goes on.

The sliding 21-bag was designed to have:

1. **Streaks and floods**, the variety that pure random has and the 7-bag doesn't.
2. **Long-run fairness with a hard limit**, like the 7-bag.
3. **Self-correction**, so that every drought makes the missing piece more likely.
4. **No bag rhythm to count**: no fixed point where the player knows a set is complete.

---

## 3. Guaranteed limits

I found these by exhaustively searching every reachable pool state for a single piece type. There are 111 such states. The limits are exact, not estimates.

| Property | Exact limit | How it happens |
|---|---|---|
| Most pieces ahead of fair share | **< 3** | A piece can only be dealt if it is in the pool, and the pool starts with 3 of each |
| Most pieces behind fair share | **< 13** | A piece can build up to 15 copies in the pool before it is dealt |
| Longest drought | **110 pieces** | See below |
| Longest same-piece run | **18 pieces** | See below |

**Why the longest drought is 110.** When the last I leaves the pool, at most 6 draws remain before the next refill. Each refill adds one I. The pool can keep avoiding I only while it still holds at least 7 other pieces at the start of a 7-draw cycle. That is possible while it holds 14 or fewer I's, which allows up to 14 full cycles. The total is 6 + 14×7 + 6 = 110. On the next draw an I is certain.

**Why the longest run is 18.** The pool can hold 15 I's and one of each other piece. If those 6 others are drawn first, 15 I's remain. Drawing I's from there gives 1 draw before the refill brings the count back to 15, then 7 + 7 + 3 more as refills keep adding one each: 18.

These are worst cases, not typical play. Over 14 million simulated pieces the longest drought was **56** and the longest run was **7**.

---

## 4. How it compares to existing randomizers

### Randomizers compared

| Randomizer | Used in | How it works |
|---|---|---|
| **Sliding 21-bag** | this game | Pool of 21. After every 7 draws, add one of each piece |
| **7-bag** | Modern guideline Tetris | Shuffle all 7 pieces and deal them. Repeat |
| **14-bag** | Some fan games | Shuffle 2 of each piece (14 total) and deal them all before reshuffling |
| **Pure random** | Early and casual games | Each piece chosen independently, uniformly at random |
| **NES** (idealized) | NES Tetris (1989) | Roll 1 of 8 options. If it's the 8th, unused option or repeats the previous piece, roll once more (1 of 7) and accept the result |
| **TGM1** | Tetris: The Grand Master | Remembers the last 4 pieces. Rolls up to 4 times for a piece not among them; if all rolls fail, keeps the last roll |
| **TGM2** | TGM2: The Absolute Plus | Same as TGM1 with up to 6 rolls |
| **TGM3** | TGM3: Terror-Instinct | Pool of 35 (5 of each), remembers the last 4 pieces, up to 6 rolls. The slot a drawn piece came from is refilled with whichever piece has gone unseen the longest |

The NES, TGM1, TGM2 and TGM3 versions are reimplementations based on public descriptions. They use an ideal uniform random number generator, so the hardware biases of the real NES generator and the special first-piece rules are left out.

### Droughts and repeats

"Gap" is the number of pieces between two appearances of the same piece. The results are averaged over all 7 piece types, from 14 million pieces per randomizer over 20 seeds.

| Randomizer | Longest possible drought | Longest drought seen | Gap exceeded 1% of the time | Gap ≥ 20 | Same piece twice in a row | Runs of 3+ per 10,000 pieces | 7-piece windows with a triple | Longest run seen |
|---|---|---|---|---|---|---|---|---|
| **Sliding 21-bag** | **110** | **56** | **23** | **2.74%** | **11.9%** | **107** | **31.9%** | **7** |
| 7-bag | 12 | 12 | 12 | 0% | 2.0% | 0 | 0% | 2 |
| 14-bag | 24 | 24 | 18 | 0.42% | 8.2% | 15 | 9.8% | 4 |
| Pure random | no limit | 109 | 29 | 4.59% | 14.3% | 175 | 43.7% | 9 |
| NES | no limit | 99 | 27 | 3.46% | 3.6% | 12 | 28.0% | 6 |
| TGM1 | no limit | 52 | 17 | 0.41% | 2.4% | 2.7 | 2.6% | 4 |
| TGM2 | no limit | 50 | 16 | 0.22% | 0.8% | 0.2 | 0.7% | 3 |
| TGM3 | not proven | 20 | 12 | ~0% | 1.0% | 0.2 | 0.7% | 3 |

How to read the table:

- **Repeats:** the sliding 21-bag repeats pieces nearly as often as pure random (11.9% vs 14.3% back-to-back). NES and all three TGM randomizers deliberately suppress repeats.
- **Droughts:** its drought tail is clearly shorter than pure random's (gap ≥ 20 in 2.7% vs 4.6% of cases) but longer than the other randomizers'.
- **Closest relative:** TGM3 is the only other one built on a refilling pool, and it points the opposite way. Its refill fills the pool with the pieces you are waiting for, which removes droughts.

### Fairness over time

This is how far a piece's count strays from its fair share (1/7 of all pieces dealt), as the root-mean-square across pieces and seeds.

| Randomizer | After 700 pieces | After 7,000 | After 70,000 | After 700,000 | Bounded? |
|---|---|---|---|---|---|
| **Sliding 21-bag** | **±0.9** | **±1.0** | **±1.0** | **±1.0** | **yes (< 3 ahead, < 13 behind)** |
| 7-bag | 0 | 0 | 0 | 0 | yes (< 1) |
| 14-bag | 0 | 0 | 0 | 0 | yes (< 2) |
| Pure random | ±9.6 | ±28 | ±96 | ±297 | no |
| NES | ±8.4 | ±29 | ±80 | ±254 | no |
| TGM1 | ±4.7 | ±14 | ±44 | ±134 | no |
| TGM2 | ±4.1 | ±11 | ±35 | ±123 | no |
| TGM3 | ±2.3 | ±7.2 | ±19 | ±66 | no |

(For the bags, the value at an exact multiple of the bag size is 0.)

The TGM randomizers feel very even in the short term, but their long-run counts still drift. The sliding 21-bag is the reverse: streaky in the short term, but fairness is guaranteed at every length of play.

### How many copies of a piece show up in 14 pieces

This is the share of all 14-piece windows that contain a given piece 0, 1, 2, 3, or 4+ times. A fair share is 2.

| Randomizer | 0 | 1 | 2 | 3 | 4+ |
|---|---|---|---|---|---|
| **Sliding 21-bag** | **7.3%** | **26.6%** | **35.3%** | **22.2%** | **8.7%** |
| 7-bag | 0% | 16.3% | 67.3% | 16.3% | 0% |
| 14-bag | 2.6% | 20.3% | 54.3% | 20.3% | 2.6% |
| Pure random | 11.6% | 26.9% | 29.2% | 19.5% | 12.8% |
| NES | 8.8% | 26.6% | 32.9% | 21.6% | 10.1% |
| TGM1 | 1.5% | 21.2% | 54.6% | 21.1% | 1.6% |
| TGM2 | 1.0% | 18.7% | 60.1% | 19.7% | 0.5% |
| TGM3 | 0.05% | 15.7% | 68.8% | 15.2% | 0.3% |

### What a player experiences in one game

This is the chance that a single game has **at least one I-piece drought** of the given length, from 20,000 simulated games per cell. A 40-line sprint takes about 100 pieces, and 400 pieces is roughly 160 lines.

| Randomizer | 100 pieces: ≥13 | ≥20 | ≥30 | ≥40 | 400 pieces: ≥13 | ≥20 | ≥30 | ≥40 |
|---|---|---|---|---|---|---|---|---|
| **Sliding 21-bag** | **93%** | **29%** | **1.7%** | **0.02%** | **100%** | **82%** | **8.5%** | **0.28%** |
| 7-bag | 0% | 0% | 0% | 0% | 0% | 0% | 0% | 0% |
| 14-bag | 71% | 4.9% | 0% | 0% | 99.6% | 21% | 0% | 0% |
| Pure random | 92% | 48% | 10% | 2.1% | 100% | 95% | 43% | 11% |
| NES | 88% | 38% | 6.3% | 0.9% | 99.98% | 88% | 29% | 5.4% |
| TGM1 | 45% | 4.8% | 0.14% | 0.01% | 92% | 20% | 0.7% | 0.03% |
| TGM2 | 35% | 2.6% | 0.06% | <0.01% | 85% | 12% | 0.3% | 0% |
| TGM3 | 6.5% | 0% | 0% | 0% | 27% | <0.01% | 0% | 0% |

(A drought of 13 or more is impossible with the 7-bag, which is why 13 is the first threshold.)

---

## 5. Floods follow droughts

A drought builds up copies of the missing piece in the pool, so when it ends, more copies tend to follow. The table shows how many more of the same piece arrive in the next 7 pieces after a drought ends:

| Drought that just ended | Sliding 21-bag: average more | Sliding 21-bag: chance of 2+ more | Pure random: average more | Pure random: chance of 2+ more |
|---|---|---|---|---|
| 0–6 pieces | 0.78 | 16.4% | 1.00 | 26.3% |
| 7–19 pieces | 0.96 | 23.9% | 1.00 | 26.4% |
| 20–29 pieces | 1.30 | 38.7% | 1.00 | 26.4% |
| 30+ pieces | **1.62** | **53.0%** | 1.00 | 26.5% |

Pure random has no memory, so its numbers don't change. In the sliding 21-bag, the piece you waited longest for is the one most likely to arrive in a burst. The reverse also holds: when a piece has been arriving often (gaps of 0–6), *fewer* than average follow, because its copies in the pool have been used up.

---

## 6. Pool size controls how streaky it is

The 21-bag is one member of a family, the **sliding 7n-bag**, which has two parameters:

- ***n*, the pool size:** the pool starts with *n* copies of each piece (7*n* pieces). Draws are uniform, without replacement.
- ***k*, the refill size:** after every 7*k* draws, *k* of each piece are added (1 ≤ *k* ≤ *n*).

The number of pieces going in always equals the number coming out, so every member stays fair over time. The two ends of *k* are:

- ***k* = *n*:** the pool is empty exactly when it is refilled, so this is an ordinary **closed bag**: the 7-bag at *n* = 1, the 14-bag at *n* = 2.
- ***k* = 1:** the most sliding version. The production randomizer is *n* = 3, *k* = 1.

Every bag randomizer is therefore a special case of this family. A smaller *k* keeps more leftovers in the pool between refills, so the result is streakier.

| *n* | *k* | Pool / refill | Gap exceeded 1% of the time | Gap ≥ 20 | Runs of 3+ per 10,000 pieces | Longest drought seen | Longest possible drought | Longest possible run | Most ahead / behind |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 | 7 / 7 = **7-bag** | 12 | 0% | 0 | 12 | 12 | 2 | 0.86 / 0.86 |
| 2 | 1 | 14 / 7 | 21 | 1.57% | 70 | 43 | 61 | 10 | 1.86 / 6.86 |
| 2 | 2 | 14 / 14 = **14-bag** | 18 | 0.42% | 15 | 24 | 24 | 4 | 1.71 / 1.71 |
| **3** | **1** | **21 / 7 (this game)** | **23** | **2.74%** | **107** | **56** | **110** | **18** | **2.86 / 12.86** |
| 3 | 2 | 21 / 14 | 22 | 2.14% | 90 | 49 | 67 | 11 | 2.71 / 7.71 |
| 3 | 3 | 21 / 21 = 21-bag (closed) | 21 | 1.40% | 60 | 36 | 36 | 6 | 2.57 / 2.57 |
| 4 | 1 | 28 / 7 | 25 | 3.30% | 125 | 58 | 159 | 26 | 3.86 / 18.86 |
| 4 | 2 | 28 / 14 | 24 | 3.02% | 117 | 55 | 122 | 20 | 3.71 / 13.71 |
| 4 | 3 | 28 / 21 | 23 | 2.61% | 105 | 55 | 79 | 13 | 3.57 / 8.57 |
| 4 | 4 | 28 / 28 = 28-bag (closed) | 22 | 2.05% | 86 | 44 | 48 | 8 | 3.43 / 3.43 |

The last column is the largest possible gap between a piece's dealt count and its fair share.

### General formulas

These give the exact worst cases for any *n* and *k*. They were checked against the exhaustive search for every combination with *n* ≤ 12.

- **Longest drought:** 7*n* + 5*k* + 6*k*·*J*, where *J* = ⌊7*n* / *k*⌋ − 7
- **Longest run:** 7*n* − 5*k* + *k*·⌊7(*n* − *k*) / 6*k*⌋
- **Most ahead of fair share:** *n* − *k*/7
- **Most behind fair share:** 6(*n* − *k*) + 6*k*/7

Special cases:

- **Closed bags (*k* = *n*):** longest drought 12*n*, longest run 2*n*, at most 6*n*/7 ahead or behind.
- ***k* = 1:** longest drought 49*n* − 37. Longest run 7*n* − 5 + ⌊7(*n* − 1)/6⌋, which equals 8*n* − 6 for *n* ≤ 6 and grows slightly faster after that.

### How the two parameters behave

- **Pool size *n*:** a larger pool is streakier.
- **Refill size *k*:** a smaller *k* is streakier, because more leftovers carry over from one refill to the next.

Neither parameter can break long-run fairness, because nothing is ever discarded and the refill always adds complete sets.

Two variations **don't work**, and both were tested:

- **Refilling more often** (for example, 4 random pieces, then 7, alternating) breaks fairness. Counts drift without limit (±114 after 700,000 pieces), and long droughts become *more* common (gap ≥ 20 in 3.19% of cases vs 2.74%). Even refills that keep the counts fair (4 then 3 from a shuffled 7-bag, or 1 piece from a 7-bag after every draw) raise that figure to 2.96% and 3.08%. The pool stays closer to full, so the self-correction weakens.
- **Resetting the pool** to 3 of each every 7 draws throws away its memory. The result is close to pure random: worst drought seen 88, gap ≥ 20 in 3.19% of cases, and drift of ±214 after 700,000 pieces.

---

## 7. Pros and cons

### Pros

- **Variety:** repeats, triples and floods happen regularly. The same piece comes twice in a row 11.9% of the time, and about a third of all 7-piece windows contain a triple.
- **Guaranteed fairness:** no piece can be more than 3 ahead or 13 behind its share, however long the game lasts. This is a stronger long-run guarantee than the NES and TGM randomizers give.
- **Self-correction:** every draw that misses a piece raises the odds of getting it. Droughts end with an increasing probability.
- **No bag boundary:** unlike the 7-bag, there is no point where a set is known to be complete.
- **Simple:** about 6 lines of code with no bookkeeping beyond the pool itself.
- **Adjustable:** pool size *n* and refill size *k* set how streaky it is, from the 7-bag (*n* = *k* = 1) upward, and the fairness guarantee holds for every setting.

### Cons

- **Droughts are real:** 29% of 100-piece games contain an I-drought of 20 or more, and 1.7% contain one of 30 or more. A hard limit exists, but at 110 pieces it is too high to matter to a player.
- **Not for competitive or guideline play:** openers and techniques that rely on the 7-bag (TKI, PCO, perfect-clear setups, bag reading) don't apply, and it would change the balance of versus play.
- **Pieces can be counted:** the pool's contents follow exactly from the dealt history, so a player who tracks every piece knows the exact odds of the next draw. This could also be seen as a skill element.
- **Floods arrive after droughts:** a 30-piece I drought is often followed by several I's in a short span. That suits the intent, but it can feel like "too late" to a player who needed the I earlier.
- **Worst cases far exceed typical play:** a drought of 110 or a run of 18 is technically possible, so its worst-case limits are weaker than the 7-bag's and 14-bag's.

---

## 8. Prior art and related work

The mechanism is not new. A pool with several copies of each piece, drawn without replacement and topped up with complete sets on a fixed schedule before it empties, has been described or built independently at least four times before this document:

| When | Who, where | What | Setting |
|---|---|---|---|
| Mar 2015 | Ilmari Karonen, [Game Development Stack Exchange](https://gamedev.stackexchange.com/a/95696) | Described for coin flips, with its hard limit | 2 types: 20 of each, 10 of each added when 20 remain |
| May 2015 | Okey_Dokey, [Hard Drop forums](https://harddrop.com/forums/index.php?topic=7323.15) | Proposed as a Tetris randomizer, with [Java code](https://pastebin.com/Nxh3aBRh) | *n* = 2, *k* = 1: "Add 7 pieces to bag when 7 pieces are left in the bag" |
| Sep 2019 | PavlikPaja, [Hacker News](https://news.ycombinator.com/item?id=20877468) | Proposed as a Tetris randomizer | *n* = 5, *k* = 1: "every time 7 pieces are dealt, you add a whole set to the bag" |
| Sep 2024 | Strophox, [tetrs](https://github.com/Strophox/tetro-tui) (Rust) | Implemented as a general `Stock` generator, later shipped in the `falling-tetromino-engine` crate | Any *n* and *k*; *n* = 3, *k* = 2 was benchmarked |

None of these names the mechanism, analyses it in depth, or led to it becoming a known randomizer, and none of them uses *n* = 3, *k* = 1. The earlier sources give estimates at most. Okey_Dokey put the longest drought for *n* = 2, *k* = 1 at "around 60 pieces", and section 6 gives the exact figure as 61. What this document adds is:

- the exact limits and the general formulas for every *n* and *k*
- the comparison with established randomizers
- the analysis of floods after droughts
- the tested variants that don't work

Other close relatives:

- **TGM3's 35-piece pool:** also a pool that refills as it goes. Its refill is chosen by drought to *reduce* streaks, and it adds history-based rerolls.
- **Multi-copy closed bags** (the 14-bag, The New Tetris' 63-bag): several copies of each piece, but refilled only when the bag is empty, so they behave like a larger 7-bag.
- **Clinical trial randomization**, which has the same problem: assigning patients to treatments unpredictably while keeping the groups balanced. The **block urn design** (Zhao & Weng, 2011) uses the same urn and returns one of each treatment. It refills only once every treatment has been drawn again, though, so a missing treatment can never build up copies. The **mass weighted urn design** (Zhao, 2015) has the same fixed refill, but adds it as fractional weight after every draw rather than as whole pieces every 7 draws.

[RANDOMIZER-RESEARCH.md](RANDOMIZER-RESEARCH.md) has the full search, with quotes, code excerpts, dates and near misses.

---

## 9. Method

- **Simulation:** 20 seeds × 700,000 pieces per randomizer, using the mulberry32 pseudorandom number generator (seeds 9000–9019). Per-game drought figures come from 20,000 independent games per cell.
- **Metrics:** all per-piece metrics are averaged over the 7 piece types. A gap is the number of pieces between two consecutive appearances of the same piece. Windows slide one piece at a time.
- **Exact limits:** found by an exhaustive search over the reachable states of one piece type, described as (copies in the pool, position within the 7-draw cycle). The search then finds the longest path that avoids that piece, or keeps drawing it.
- **Implementation:** the sliding 21-bag, 7-bag and pure-random figures use the production randomizer from `game.js` (`makeRandomizer`). The other randomizers were reimplemented for comparison as described in section 4.

### Reproducing the numbers

Everything in this document comes from these scripts (plain Node, no dependencies):

| Command | Script | Sections |
|---|---|---|
| `npm run stats:compare` | `tests/randomizer-compare.js` | 3, 4 (≈35 s) |
| `npm run stats:floods` | `tests/randomizer-floods.js` | 5 |
| `npm run stats:pools` | `tests/randomizer-pool-size.js` | 6 (the *n*, *k* family and exact limits) |
| `npm run stats:variants` | `tests/randomizer-variants.js` | 6 (rejected variants) |

`tests/randomizers.js` holds the shared code: the seeded random number generator, the comparison randomizers, and the exact-limit search.
