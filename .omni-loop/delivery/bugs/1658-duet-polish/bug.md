# Bug 1658: OMNI DUET — its cabinet shows Space Invaders, the crest distracts, and the orbs turn too fast

## Triage

- **Domain:** OMNI DUET, the arcade's fourth game (`apps/galaxy/src/arcade/duet/`, `games/stills.ts`, PRD 1633)
- **Risk:** low — the game plays; its cabinet shows another game's picture, its centre draws the eye from the orbs, and the turn is too quick to steer comfortably.
- **Regression:** new bug — found in the first play after PRD 1633 shipped

## Reproduction

- **File:** `apps/galaxy/src/arcade/duet/art.test.ts`
- **Red:** `× leaves the circle's centre empty: nothing but the field's dark is drawn there` — `AssertionError: expected [ '#07061c', '#1a2170' ] to deeply equal [ '#07061c' ]`
- **Poster:** `STILLS` (`games/stills.ts`) held no `duet` entry, so the lit cabinet fell back to the Invaders formation.
- **Crest:** `drawField` (`duet/art.ts`) drew the Omni Loop mark at the circle's centre.
- **Turn:** `RULES.turnsPerSecond` was 1.75, a half turn in about 0.29 s.

## Fix

`stills.test.ts` draws OMNI DUET's still from the game's own `drawField`: the two orbs on their circle,
clear of a falling wave of chapter III, and `stills.ts` is regenerated. `drawField` no longer draws the
crest. The pair turns at 1.25 turns a second, a half turn in 0.4 s. At that speed chapter II's wave 7
had no way through, so its still top bar is two cells instead of four.

## Guard

`art.test.ts` checks nothing but the field's dark is drawn at the circle's centre. `stills.test.ts`
checks every still, OMNI DUET's included, against the game's art. `waveProblems` keeps every chapter
wave and the first 200 endless waves passable at the new speed.

## Mutation

mutation: not run (arcade only, no delivery-core file changed)
