# Prior Art Research: the Sliding 7n-Bag

*Has the sliding bag been described or implemented before? A search of Tetris sources, game code, game design and other fields. September 2026.*

---

## TL;DR

**The sliding bag has been done before.** At least four independent sources describe or implement it, the earliest in 2015. None of them names it, analyses it, or turned it into a known randomizer:

| When | Who, where | What | Parameters |
|---|---|---|---|
| Mar 2015 | Ilmari Karonen, Game Development Stack Exchange | Described, with its hard bound, for coin flips | 2 types, *n* = 20, *k* = 10 |
| **May 2015** | **Okey_Dokey, Hard Drop forums** | **Described and implemented in Java as a Tetris randomizer** | ***n* = 2, *k* = 1** |
| Sep 2019 | PavlikPaja, Hacker News | Described as a Tetris randomizer | *n* = 5, *k* = 1 |
| Sep 2024 | Strophox, *tetrs* (Rust) | Implemented as a generic `Stock` randomizer, benchmarked | *n* = 3, *k* = 2 benchmarked; any *n*, *k* possible |

The flagship *n* = 3, *k* = 1 configuration was not found anywhere, but it is a parameter choice, not a different mechanism.

What does still appear to be new in [RANDOMIZER.md](RANDOMIZER.md): the exact limits and general formulas for the whole (*n*, *k*) family, the comparisons with established randomizers, and the analysis of floods after droughts. The earlier sources give only rough estimates. Okey_Dokey gave a longest drought of "around 60 pieces" for *n* = 2, *k* = 1, where the exact figure is 61. Karonen gave the exact bound for his 2-type example.

RANDOMIZER.md section 8 originally said there was "no published description of the sliding members of this family". It has been corrected to credit these sources.

The closest relatives in another field come from clinical trial randomization:

The closest relatives in another field come from clinical trial randomization:

- **The block urn design** (Zhao & Weng, 2011) uses the same urn: several balls of each type, draws without replacement, one of each returned, leftovers kept. Only the refill *trigger* differs. BUD refills when every type has been drawn again. The sliding bag refills on a fixed schedule.
- **The mass weighted urn design** (Zhao, 2015) uses the same fixed, history-blind refill. It spreads the refill over every draw as fractional weight instead of adding whole pieces every 7 draws.

---

## 1. What counts as a match

The sliding 7*n*-bag (see [RANDOMIZER.md](RANDOMIZER.md), section 6):

- Start with *n* copies of each of the 7 pieces.
- Draw uniformly at random, **without replacement**.
- After every 7*k* draws, add *k* copies of **every** piece (1 ≤ *k* < *n*), **regardless of what was drawn**. Leftovers are kept.

A match needs all three parts: multiple copies per piece, drawing without replacement, and a complete-set top-up on a **fixed schedule** before the pool runs out.

These are **not** matches:

| Mechanism | Why not |
|---|---|
| Closed bags (7-bag, 14-bag, The New Tetris' 63-bag) | Refilled only when empty. This is the *k* = *n* case, which is well known. |
| Partial deal, then reshuffle | Leftovers are thrown away, so the pool has no memory. |
| TGM3's 35-piece pool | Each drawn piece is replaced by the most droughted piece, which depends on history. |
| History and reroll randomizers (TGM1/2, NES) | These have no pool of copies. |
| Pólya urns | The drawn ball goes back, plus extra copies. |
| Pseudo-random distribution, pity timers | The probability rises after misses, but there is no pool. |

---

## 2. Tetris community and documentation

**Verdict: exact match, described and implemented in 2015.**

### 2.1 Hard Drop forums, May 2015: exact match with code

Okey_Dokey (a Hard Drop moderator), post #19 in the thread [*Randomizers*](https://harddrop.com/forums/index.php?topic=7323.15), May 13, 2015:

> "Here are 2 ideas for randomizers: a bag-alike randomizer that is refilled before it is emptied, and a randomizer using weights."

> "Example 2: Add 7 pieces to bag when 7 pieces are left in the bag. This randomizer is a bit harder than 14-bag (double bag) randomizer. Initially, the bag is filled with 14 pieces, 2 of each kind. […] Now pieces are drawn until 7 pieces remain in the bag. Let's say they are: IIOOTLJ. Now, the 7 different pieces are added to the bag: IIIOOOTTLLJJSZ […] In this example, no I piece was handed out. The longest possible drought is around 60 pieces, but it's very very unlikely that a drought will take longer than 25 pieces."

This is the sliding bag with *n* = 2, *k* = 1, leftovers carried forward. RANDOMIZER.md section 6 gives the exact longest drought for that configuration as 61.

"Example 1: Add 7 pieces to bag when 1 piece is left in the bag" uses the same mechanism with a pool that cycles 8 → 1. Only one leftover carries over, and the stated longest drought is "around 20 pieces".

The post links a Java randomizer class on [Pastebin](https://pastebin.com/Nxh3aBRh), dated May 14, 2015, which implements both:

```java
RAND_REFILL7 = 2, // 14-bag randomizer that refills 7 pieces when 7 pieces are left in the bag
...
public int nextrefill7()
{
    if ( left == 0 )
    {
        insertbag(); insertbag(); // fill in 14 pieces
    }
    else if ( left == numpieces )
        insertbag(); // fill in 7 pieces
    return takefrombag();
}
```

`takefrombag()` picks `r.nextInt( left )` and removes that piece, a uniform draw without replacement.

The thread discussed the difference from existing bags. On page 3, Kitaru (May 14, 2015) quotes Arcorann: "in the proposed 1+7-bag only 7 pieces from the bag are dealt before replenishment, which provides a correlation of sorts not seen in 8-bag". Kitaru replies that it depends on whether you treat it as a 7+x bag "or a separate Bag from which x pieces are interleaved without discarding the remainder."

### 2.2 Hacker News, September 2019: exact match, described

PavlikPaja, [comment 20877468](https://news.ycombinator.com/item?id=20877468) on the Hacker News thread for [*A history of Tetris randomizers*](https://simon.lc/the-history-of-tetris-randomizers) (simon.lc, 2018), 2019-09-04:

> "I think the best compromise would be a bag with let's say five of each piece; every time 7 pieces are dealt, you add a whole set to the bag. No need for unnecessary complications - the pice becomes less numerous and less likely to come when there was a flood, and more common and more likely to come when there was a drought. You can even add a set aften less than seven pieces, to increase randomness (and thus difficulty) over time."

This is *n* = 5, *k* = 1. It also describes the self-correction in section 5 of RANDOMIZER.md. The last sentence describes adding complete sets faster than pieces are dealt, so the pool keeps growing. RANDOMIZER.md doesn't test this variant. The "refilling more often" variants in its section 6 either add random pieces or keep pieces in equal to pieces out.

### 2.3 Other community sources

- **TetrisConcept, "Randomizer theory" thread:** all 14 pages scanned. It covers 7*n*-bag drought maths and history/distance randomizers, with no top-up before empty. **Not a match.**
- **Tetrevil** (TetrisConcept, 2012): "The default in bag mode is a bag of size 21". A closed 21-bag where an AI picks the worst piece. **Not a match.**
- **Chinese Tetris wiki** ([包随机器](https://tetris.huijiwiki.com/wiki/包随机器)): "14-Bag、21-Bag 等：七种方块各两个或各三个，组成一包" ("14-bag, 21-bag, etc.: two or three of each of the seven pieces make up one bag"). Closed bags. **Not a match.**
- **Hard Drop wiki, tetris.wiki and tetris.fandom.com full-text searches** ("refill", "of each piece", "reshuffle", "21 bag"): nothing beyond the pages below.
- **Reddit:** only shallow coverage. old.reddit needs a login and its JSON endpoints are blocked.

### 2.4 tetris.wiki

- **[Blackjack](https://tetris.wiki/Blackjack)** (tetris.wiki) is a notation for randomizers, proposed by Lardarse and extended by Tepples. Its `number bag of list` form will "deal the first number in random sequence, then reshuffle", as in its example "14-piece bag, dealt halfway: `7 bag of I,I,J,J,L,L,O,O,S,S,T,T,Z,Z`". That is a partial deal followed by a reset. The notation has no way to carry leftovers into the next deal, so it cannot express the sliding bag. **Not a match.**
- **[Random Generator](https://tetris.wiki/Random_Generator)** (tetris.wiki) lists the 7-bag, an 8-bag (the Tetris Online Japan beta), TGM3's "35-bag variant of the TGM randomizer" and The New Tetris' original bag "of 63—nine of each piece—to allow for streaks". All of these are closed bags or history-based. **Not a match.**
- The tetris.wiki category [Randomizers](https://tetris.wiki/Category:Randomizers) contains only four pages: Blackjack, Random Generator, Sega Randomizer and TGM randomizer.

---

## 3. Game source code

**Verdict: exact match, in *tetrs*.** Everything else checked is a closed bag, a history or weight randomizer, or a near miss.

### 3.1 tetrs / falling-tetromino-engine: exact match in code

Strophox, [tetrs](https://github.com/Strophox/tetro-tui) (since renamed *tetro-tui*), a terminal Tetris clone in Rust. The `Stock` generator was introduced in commit `e944363` on 2024-09-08, in `tetrs_engine/src/piece_generation.rs`:

```rust
/// Stock works by picking `n` copies of each [`Tetromino`] type, and then uniformly randomly
/// handing them out until a lower stock threshold is reached and restocked with `n` copies.
/// A multiplicity of `1` and restock threshold of `0` corresponds to the common 7-Bag.
```

The same code shipped in the [`falling-tetromino-engine`](https://crates.io/crates/falling-tetromino-engine) crate. Version 1.0.0 was published on 2026-02-16, a date crates.io confirms independently. From `src/tetromino_generator.rs`:

```rust
let idx = WeightedIndex::new(weights).unwrap().sample(&mut self.rng);
pieces_left[idx] -= 1;
if pieces_left.iter().sum::<u32>() == *refill_threshold {
    for cnt in pieces_left {
        *cnt += multiplicity.get();
    }
}
```

Mapping it onto the sliding 7*n*-bag:

- A draw weighted by `pieces_left` is a uniform draw without replacement.
- `multiplicity` is *k*. When the pool reaches `refill_threshold` (*T*), *k* of each piece are added, and the next refill comes 7*k* draws later. The pool cycles between *T* + 7*k* and *T*, so *n* = *k* + *T*/7.
- The `stock(multiplicity, threshold)` constructor requires *T* < 7*k*, which limits it to *k* > *n*/2. The enum fields are public, though, so `Stock { pieces_left: [3; 7], multiplicity: 1, restock_threshold: 14 }` builds this game's *n* = 3, *k* = 1 exactly. The constructor's check only protects the starting state. (If the pool started at or below the threshold, the threshold would never be hit exactly and the pool would run out.)
- Only the constructor's starting pool differs: *k* of each instead of *n*. The first refill therefore comes early, and from then on it runs as the sliding bag.

It was used, not just written. Commit `62ad4b1` (2024-09-08) adds `TetrominoSource::stock(NonZeroU32::MIN.saturating_add(1), 7)` to the combo bot's benchmarks as `"bag-2_restock-on-7"`: *k* = 2, *T* = 7, which gives *n* = 3, *k* = 2 in steady state. Commit `04c3ca6` (2024-09-08) publishes its results in the README. A second entry labelled `"bag-3_restock-on-7"` uses identical parameters, apparently a copy-paste slip.

By version 2.0.0 (2026-04-02) the generator was removed, and later versions only refill when empty.

### 3.2 Other code checked

| Source | Randomizers | Verdict |
|---|---|---|
| [Cambridge](https://github.com/cambridge-stacker/cambridge) core, `tetris/randomizers/` | always, bag, bag7, bag7noSZOstart, fixed_sequence, history_4rolls, history_6rolls, memoryless, sakura, **history_6rolls_35bag** | The 35-bag is TGM3's pool (`self.pool[index]=self:getMostDroughtedPiece()`): a near miss. The rest are not relevant. |
| Cambridge modpack | **recursive_bag**, **masterofbags**, **bag8**, bag63, dtet, bag5, bag5alt, bag_konoha, ex, history, split_history, kamui_sequence, poweron, sakura, sega, nes, mirror, tetra | Near misses: *recursive_bag* adds a full set before the bag empties and keeps leftovers, but the trigger is a random "refill token", not a schedule. *masterofbags* is a 28-bag that can reset at ≤ 14 left, discarding the leftovers. *bag8* is a 7+1 bag. |
| TETR.IO (via the `halp1/triangle` replica) | 7-bag, 14-bag, classic, pairs, total mayhem, 7+1, 7+2, 7+X | 7+X is a near miss: extra pieces come from a second 7-bag whose leftovers are kept. |
| Jstris (offline mirror) | 7-bag, 14-bag, Classic, C2Sim, One/Two block, Repeat, BSblock, BigBlock | Refills only when empty. Not a match. |
| HeborisCE | random, TGM, TGM3, Sakura, 7-bag, partial bags, SEGA, Bloxeed, power-on | Not a match. |
| Lockjaw (`gimmicks.c`) | 7/14/6/10-piece bags, move-to-back, history with 6 rolls, memoryless, SZSZ | Not a match. |
| Tetr.js, four-tris, blockstacker, cold-clear, and three small randomizer libraries | 7-bag, 14-bag, random | Not a match. |
| Techmino, NullpoMino | (checked before this research, see RANDOMIZER.md section 8) | Not a match. |

Not reachable or closed source: Apotris (its GitLab needs a login), Shiro, Cultris II, Blockbox, Nuketris, Tetra Legends / Tetra Online, Tetris Effect, Puyo Puyo Tetris.

---

## 4. Game design outside Tetris

**Verdict: exact match, for two outcomes, in 2015.** This is a few weeks before the Hard Drop post in section 2.1, and in another community.

### 4.1 Game Development Stack Exchange, 2015: exact match for two outcomes

Ilmari Karonen, answer to [*How can I make a "random" generator that is biased by prior events?*](https://gamedev.stackexchange.com/questions/95675) (answer 95696). The answer was posted on 2015-02-25, and the part quoted here was added on 2015-03-02. The dates and text were read through the Stack Exchange API.

The answer compares deck strategies for coin flips, each starting from 20 "heads" and 20 "tails":

> "Purple line, fill when half empty: Cards are drawn at random until the deck has 20 cards left; then the deck is topped up with 10 "heads" cards and 10 "tails" cards."

That is the sliding bag with 2 piece types, *n* = 20 and *k* = 10. The answer gives its hard limit:

> "the deviation of the blue, purple and cyan lines away from zero is strictly bounded by the deck size: the blue line can never drift more than 10 steps away from zero, the purple line can only get 15 steps away from zero"

This agrees with the general formulas in RANDOMIZER.md, section 6, for 2 types: at most *n* − *k*/2 = 15 ahead and (*n* − *k*) + *k*/2 = 15 behind. The answer also explains why:

> "the important feature that keeps their variation bounded is the fact that, while the cards are drawn from the deck randomly, the deck is refilled deterministically."

In a comment the same day, on Philipp's answer, he described the scheme generically: "maintaining a shuffled deck of up to 2*N cards, and shuffling in a fixed N-card set whenever the deck gets down to N cards". Earlier, on 2015-02-25, he wrote: "it's perfectly fine to mix in new cards before the deck is emptied (and, in fact, I'd recommend doing this to make the outcomes more natural and harder to predict)."

The same thread shows the opposite view: "It's important to empty the bag/deck as Philipp suggests before inserting new cards if you want to control the occurrences over a set interval" (DMGregory, 2015-02-25).

### 4.2 Near misses

| Source | Mechanism | Verdict |
|---|---|---|
| Jeff Gates, [gamedev.SE answer 62606](https://gamedev.stackexchange.com/a/62606) (2013-09-23) | Shuffle bag: "To add back in randomness, refill the bag when it only has X items remaining." | **Possibly the earliest mention**, but it is a single sentence and doesn't say whether leftovers are kept. |
| Karonen, same answer (2015) | "Cyan line, fill continuously": each draw is replaced immediately, alternating heads and tails. | Same principle, but refilled one item at a time instead of in complete sets. |
| Aaganrmu, [gamedev.SE answer 201831](https://gamedev.stackexchange.com/a/201831) (2022-07-19) | "A shufflebag that is kept at a constant size and refilled using a predictable series": draw at random, then add the next item from a fixed cycle. | Same principle, refilled one item at a time. |
| BlueRaja, gamedev.SE answer 95690 (2015); Tim, Stack Overflow answer 926538 (2009); D_M_Gregory's "dueness" (quoted in gamedev.SE answer 201823) | Every option gains weight each draw, and the chosen one loses the total. | The with-replacement, continuous version, the same as MWUD (section 5.2). |
| Philipp, gamedev.SE answer 201817 (2022) | "discard and recreate the shufflebag before it is empty" | Throws the leftovers away. Not a match. |
| Catan *Traders & Barbarians* event cards | The deck is reshuffled when the "New Year" card appears, with 5 cards below it. | Full reshuffle, so the deck has no memory. Not a match. |
| Puyo Puyo Tsu | A shuffled pool of 256 puyos, dealt in order and repeated. | Not a match. |
| Spotify shuffle (2014) | Spreads each artist's songs evenly. There is no pool. | Not relevant. |

Not verified from sources: Dr. Mario, Columns, Lumines, Meteos, Panel de Pon, Bejeweled, Candy Crush, MTG Arena, Hearthstone, Balatro, gacha pity systems, and bag-building board games.

---

## 5. Mathematics, statistics and other fields

**Verdict: partially.** No source describes this exact scheme, but clinical trial randomization has two very close relatives. Both are by Wenle Zhao. The quotes below were checked against the full text on PubMed Central.

Clinical trials face the same problem as a piece randomizer. Patients must be assigned to treatments unpredictably, while the group sizes never drift far apart. The 7-bag's counterpart there is the **permuted block design**.

### 5.1 Block urn design (BUD): same urn, different trigger

Zhao W, Weng Y. *Block urn design – a new randomization algorithm for sequential trials with two or more treatments and balanced or unbalanced allocation.* Contemporary Clinical Trials 32 (2011), 953–961. [PMC3206733](https://pmc.ncbi.nlm.nih.gov/articles/PMC3206733/)

> "After each treatment allocation, the selected ball is placed in the inactive urn. Repeat steps 2 and 3 until a minimal balanced set is collected in the inactive urn. These W balls are returned to the active urn immediately. Other balls, if any, stay in the inactive urn."

| | Sliding 7*n*-bag | BUD (equal allocation) |
|---|---|---|
| Starting pool | *n* of each | λ of each |
| Draw | Uniform, without replacement | Uniform, without replacement |
| Refill contents | One of each (*k* of each) | One of each |
| Leftovers | Kept | Kept |
| **Refill trigger** | **Every 7*k* draws, fixed** | **When every type has been drawn again** (depends on history) |
| Copies of a piece in the pool | Can grow past *n* (up to 15 at *n* = 3) | Never more than λ |
| Imbalance limit | *n* − *k*/7 ahead, 6(*n* − *k*) + 6*k*/7 behind fair share | No type more than λ ahead of the least-drawn type (the paper's "maximum tolerated imbalance") |

With λ = 1, BUD becomes the permuted block design, just as the sliding bag becomes the 7-bag at *n* = *k* = 1.

The trigger is the whole difference. In BUD, a treatment that hasn't been drawn *blocks* the refill, so no other treatment can pull further ahead. In the sliding bag, the refill comes regardless, so a droughted piece builds up extra copies. That buildup produces the floods that follow droughts (RANDOMIZER.md, section 5), which BUD cannot produce. The sliding bag is effectively **BUD with its history-driven trigger replaced by a clock**.

### 5.2 Mass weighted urn design (MWUD): same fixed refill, spread over every draw

Zhao W. *Mass weighted urn design – a new randomization algorithm for unequal allocations.* Contemporary Clinical Trials 43 (2015), 209–216. [PMC4522356](https://pmc.ncbi.nlm.nih.gov/articles/PMC4522356/)

> "One unit mass is taken from the selected ball, and redistributed among the m balls, including the selected ball, based on the target allocation ratio. Then, the selected ball is returned to the urn."

Each treatment starts with mass αw<sub>j</sub>. Each draw takes 1 from the selected treatment and adds w<sub>j</sub> to every treatment. So after *i* draws, treatment *j* has mass αw<sub>j</sub> + *i*·w<sub>j</sub> − (times *j* was drawn).

With 7 types, w<sub>j</sub> = 1/7 and α = 7*n*, that is *n* + *i*/7 − (times drawn). **At every refill point, this equals the sliding bag's pool count exactly.** The refill is also fixed and ignores history. The differences:

- MWUD adds fractional mass after **every** draw. The sliding bag adds **whole pieces in batches** every 7*k* draws, which gives the pool its sawtooth shape and the "no bag boundary" feel.
- MWUD's mass can go negative. The paper handles it this way: "negative values of x<sub>i–1,j</sub> is replaced by zero, and the remaining conditional allocation probability items are rescaled". Integer counts in the sliding bag can never go negative, so it needs no such correction.

The sliding bag can be read as a **batched, whole-piece version of MWUD**. A 2024 review ([PMC10925840](https://pmc.ncbi.nlm.nih.gov/articles/PMC10925840/)) notes that for two treatments, MWUD "is reduced to the EUD", Chen's Ehrenfest urn design (2000).

### 5.3 Other relatives

| Source | Mechanism | Verdict |
|---|---|---|
| Drop-the-loser urn with immigration (Ivanova 2003), as described in [PMC2911470](https://pmc.ncbi.nlm.nih.gov/articles/PMC2911470/) | "If an immigration ball is drawn, an additional ball of each type is added." The refill fires at random, and removal depends on patient response. | Close relative in form. No fixed schedule, no bound. |
| Ehrenfest urn design (Chen 2000) | A drawn ball is swapped for a ball of the other arm, so the urn size stays fixed. | Related only through MWUD. |
| Pólya urn with random immigration (Peköz, Röllin & Ross, *Bernoulli* 2019) | Reinforces the drawn color and adds a single color at random times. | Not relevant. |
| Deficit round robin, nginx smooth weighted round robin | A fixed quota per round with carry-over. The nginx update is the same as MWUD's mass update, but picks deterministically. | Analogue only: no random draw. |
| Lottery scheduling | Draws with replacement from a fixed ticket pool. | Not relevant. |
| Casino continuous shuffling machines | Discards are reinserted as they are played, not as complete sets on a schedule. | Not relevant. |

Not fetched as primary sources: Ivanova 2003, Soares & Wu's big stick design, Berger's maximal procedure and Chen 2000. The secondary descriptions consulted mention no scheduled refill.

---

## 6. Method

- **Tools:** pages were loaded in a local headless Chrome (Browserless) through its MCP tools and REST API. Four searches ran in parallel, one per area, each in its own browser session. Paper texts came from the NCBI BioC API.
- **Search engines:** Brave and Startpage returned results. Google, DuckDuckGo and Mojeek blocked the headless browser, and Bing ignored quoted phrases.
- **AI answers ignored:** Brave's AI summary claimed that TGM3 uses a "sliding bag randomizer". That is wrong, since TGM3 replaces each drawn piece by drought. Only text read on the source pages is quoted here.
- **Verification:** each match was checked at its primary source. The Hard Drop thread and Pastebin code were fetched directly, and Hacker News comments came from the HN Algolia API. For Stack Exchange, answer bodies, revision history and comments came from the Stack Exchange API. For tetrs, the git commits were read in a local clone and the crate source was downloaded from crates.io, whose API confirmed the publish dates. Commit dates alone can be changed; the crates.io dates cannot.
- **Limits:** a negative search cannot prove that something doesn't exist. An informal implementation, or a description in a source that couldn't be reached, may exist.
