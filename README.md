# Showpiece

A falling-block puzzle game in the style of Tetris, built around a new piece randomizer. Vanilla JavaScript, no dependencies, no build step.

## The sliding 21-bag

Modern Tetris games deal pieces from a **7-bag**, where every 7 pieces contain one of each. It's fair, but mechanical: no streaks, no dry spells. **Pure random** has variety, but no memory, so piece counts drift further from fair the longer you play.

The sliding 21-bag sits in between:

1. Start with a pool of 21 pieces, 3 of each.
2. Draw each piece at random from the pool.
3. After every 7 draws, add one of each piece back.

What that gives you:

- **Streaks:** the same piece comes twice in a row 11.9% of the time. That's 2% with the 7-bag and 14.3% with pure random.
- **Fairness with a hard limit:** a piece always stays less than 3 ahead of its fair share and less than 13 behind, however long you play.
- **Self-correction:** the longer you wait for a piece, the more copies of it build up in the pool. Droughts often end in a flood.

[RANDOMIZER.md](RANDOMIZER.md) has the exact limits, comparisons with the 7-bag, NES and TGM randomizers, and scripts that reproduce every number.

## Play

Open `index.html` in a browser.

| Key | Action |
|---|---|
| ← → | Move |
| ↓ | Soft drop |
| ↑ / X | Rotate clockwise |
| Z | Rotate counter-clockwise |
| Space | Hard drop |
| C / Shift | Hold |
| P / Esc | Pause |
| M | Sound |
| K | Music |
| A | Analytics |
| Enter / R | Restart after game over |

## Features

- Randomizer modes: sliding bag (pool size and refill size adjustable), 7-bag and pure random.
- Analytics overlay that shows the randomizer's pool live.
- Strict rotation by default. SRS wall kicks are optional.
- Hold, a 0–5 piece preview, T-spins, combos and back-to-back bonuses.

## Test

Requires Node.js 14 or later.

```sh
npm test            # test suites
npm run stats       # randomizer statistics
```

[SPEC.md](SPEC.md) has the full specification.

## License

BSD 3-Clause. See [LICENSE](LICENSE).
