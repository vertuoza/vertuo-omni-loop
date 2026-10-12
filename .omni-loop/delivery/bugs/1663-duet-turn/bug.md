# Bug 1663: OMNI DUET — the turn is too fast and the waves only fit perfect inputs

## Triage

- **Domain:** OMNI DUET, the arcade's fourth game: the turn and the waves (`apps/galaxy/src/arcade/duet/rules.ts`, `waves.ts`, PRD 1633)
- **Risk:** medium — the game is not playable as meant: holding ◀ or ▶ swings the pair too far to steer, so play comes down to nudges, and the waves were only proven passable with perfect, instant inputs.
- **Regression:** new bug — found playing after #1659, which had slowed the turn from 1.75 to 1.25 turns a second

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/rules.test.ts`
- **Red:** `× turns the pair at 0.6 turns a second: a half turn in about 0.83 s, a quarter in about 0.42 s` — `AssertionError: expected 7.853981633974483 to be close to 3.7699111843077517`

## Fix

The pair turns at 0.6 turns a second: a half turn held takes about 0.83 s, so the game is played by
holding real rotations. The passability check now plays a person: a change of what is held comes no
sooner than 0.25 s after the last, the turn never beats ◀ or ▶, and a wave passes only from every angle,
whatever is held. The four chapters are rewritten for that turn: slower falls (chapter I at 52–70 px/s),
rows that ask a swing standing 6–10 rows apart, difficulty from chained rotations and moving blocks
rather than tight gaps. Endless mode keeps its rule, one to three of chapter IV's own rows from a fixed
seed, 10 rows apart, from 108 px/s up to a ceiling of 120.

## Guard

`waveProblems` names any wave no person reacting in 0.25 s gets through, and a test shows a wave that
only perfect inputs pass. Room to spare: every chapter wave and the first 200 endless waves pass for a
person reacting in 0.4 s with orbs 2 px wider. Chapter I never puts two rows closer than 6.

## Mutation

mutation: not run (arcade only, no delivery-core file changed)
